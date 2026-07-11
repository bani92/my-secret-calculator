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
    let lifecycleGeneration = 0;
    let operationGeneration = 0;

    const initialize = (): Promise<void> => {
      if (initializePromise) {
        return initializePromise;
      }

      const initializationLifecycle = lifecycleGeneration;
      const initializationOperation = ++operationGeneration;

      const promise = (async () => {
        isLoading.value = true;
        errorMessage.value = '';

        try {
          const client = getClient();
          const { data, error } = await client.auth.getSession();

          if (error) {
            throw error;
          }

          if (lifecycleGeneration !== initializationLifecycle) {
            return;
          }

          if (operationGeneration === initializationOperation) {
            session.value = data.session;
          }

          const nextSubscription = client.auth.onAuthStateChange((_event, nextSession) => {
            if (lifecycleGeneration === initializationLifecycle) {
              session.value = nextSession;
            }
          }).data.subscription;

          if (lifecycleGeneration !== initializationLifecycle) {
            nextSubscription.unsubscribe();
            return;
          }

          subscription = nextSubscription;
          isInitialized.value = true;
        } catch (error) {
          if (lifecycleGeneration === initializationLifecycle) {
            isInitialized.value = false;
            initializePromise = undefined;
          }
          throw error;
        } finally {
          if (operationGeneration === initializationOperation) {
            isLoading.value = false;
          }
        }
      })();

      initializePromise = promise;
      return promise;
    };

    const login = async (email: string, password: string): Promise<void> => {
      const loginOperation = ++operationGeneration;
      isLoading.value = true;
      errorMessage.value = '';

      try {
        const { data, error } = await getClient().auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        if (operationGeneration === loginOperation) {
          session.value = data.session;
        }
      } catch {
        if (operationGeneration === loginOperation) {
          errorMessage.value = LOGIN_ERROR_MESSAGE;
        }

        throw new Error(LOGIN_ERROR_MESSAGE);
      } finally {
        if (operationGeneration === loginOperation) {
          isLoading.value = false;
        }
      }
    };

    const logout = async (): Promise<void> => {
      const logoutOperation = ++operationGeneration;
      isLoading.value = true;
      errorMessage.value = '';

      try {
        const { error } = await getClient().auth.signOut();

        if (error) {
          throw error;
        }

        if (operationGeneration === logoutOperation) {
          session.value = null;
        }
      } finally {
        if (operationGeneration === logoutOperation) {
          isLoading.value = false;
        }
      }
    };

    const dispose = (): void => {
      lifecycleGeneration += 1;
      operationGeneration += 1;
      initializePromise = undefined;
      isInitialized.value = false;
      isLoading.value = false;
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
