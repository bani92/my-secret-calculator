import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createAuthStore } from './authStore';

const session = { user: { id: 'owner-id', email: 'owner@example.com' } } as Session;

function createClient() {
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe } } })
    }
  } as unknown as SupabaseClient;

  return { client, unsubscribe };
}

describe('useAuthStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('loads and subscribes to the current session only once', async () => {
    const { client } = createClient();
    const store = createAuthStore(() => client)();

    await store.initialize();
    await store.initialize();

    expect(store.session?.user.id).toBe('owner-id');
    expect(store.isInitialized).toBe(true);
    expect(client.auth.getSession).toHaveBeenCalledOnce();
    expect(client.auth.onAuthStateChange).toHaveBeenCalledOnce();
  });

  test('logs in with email and password and clears credentials from state', async () => {
    const { client } = createClient();
    const store = createAuthStore(() => client)();

    await store.login('owner@example.com', 'password');

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'password'
    });
    expect(store.session?.user.id).toBe('owner-id');
  });

  test('shows a generic message when login fails', async () => {
    const { client } = createClient();
    vi.mocked(client.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('internal detail') as never
    });
    const store = createAuthStore(() => client)();

    await expect(store.login('owner@example.com', 'wrong')).rejects.toThrow();

    expect(store.errorMessage).toBe('이메일 또는 비밀번호를 확인해주세요.');
    expect(store.errorMessage).not.toContain('internal detail');
  });

  test('logs out and clears the session', async () => {
    const { client } = createClient();
    const store = createAuthStore(() => client)();
    await store.initialize();

    await store.logout();

    expect(client.auth.signOut).toHaveBeenCalledOnce();
    expect(store.session).toBeNull();
  });

  test('unsubscribes from auth state changes when disposed', async () => {
    const { client, unsubscribe } = createClient();
    const store = createAuthStore(() => client)();
    await store.initialize();

    store.dispose();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
