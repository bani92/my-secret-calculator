import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { requireSupabaseClient } from '../lib/supabaseClient';

const LOGIN_ERROR_MESSAGE = '이메일 또는 비밀번호를 확인해주세요.';

type AuthSubscription = ReturnType<SupabaseClient['auth']['onAuthStateChange']>['data']['subscription'];

export function createAuthStore(getClient: () => SupabaseClient = requireSupabaseClient) {
  return defineStore('auth', () => {
    const session = ref<Session | null>(null);
    const isInitialized = ref(false);
    const isLoading = ref(false);
    const errorMessage = ref('');
    let initializePromise: Promise<void> | undefined;
    let subscription: AuthSubscription | undefined;

    const initialize = async (): Promise<void> => {
      initializePromise ??= (async () => {
        isLoading.value = true;
        errorMessage.value = '';

        try {
          const client = getClient();
          const { data, error } = await client.auth.getSession();

          if (error) {
            throw error;
          }

          session.value = data.session;
          subscription = client.auth.onAuthStateChange((_event, nextSession) => {
            session.value = nextSession;
          }).data.subscription;
          isInitialized.value = true;
        } catch (error) {
          initializePromise = undefined;
          isInitialized.value = false;
          throw error;
        } finally {
          isLoading.value = false;
        }
      })();

      await initializePromise;
    };

    const login = async (email: string, password: string): Promise<void> => {
      isLoading.value = true;
      errorMessage.value = '';

      try {
        const { data, error } = await getClient().auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        session.value = data.session;
      } catch {
        errorMessage.value = LOGIN_ERROR_MESSAGE;
        throw new Error(LOGIN_ERROR_MESSAGE);
      } finally {
        isLoading.value = false;
      }
    };

    const logout = async (): Promise<void> => {
      isLoading.value = true;
      errorMessage.value = '';

      try {
        const { error } = await getClient().auth.signOut();

        if (error) {
          throw error;
        }

        session.value = null;
      } finally {
        isLoading.value = false;
      }
    };

    const dispose = (): void => {
      subscription?.unsubscribe();
      subscription = undefined;
    };

    return {
      session,
      isInitialized,
      isLoading,
      errorMessage,
      initialize,
      login,
      logout,
      dispose
    };
  });
}

export const useAuthStore = createAuthStore(requireSupabaseClient);
