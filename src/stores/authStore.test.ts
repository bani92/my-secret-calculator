import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createAuthStore } from './authStore';

const session = { user: { id: 'owner-id', email: 'owner@example.com' } } as Session;
const loggedInSession = { user: { id: 'new-owner-id', email: 'new-owner@example.com' } } as Session;

type SessionResult = Awaited<ReturnType<SupabaseClient['auth']['getSession']>>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function sessionResult(nextSession: Session | null, error: Error | null = null): SessionResult {
  return { data: { session: nextSession }, error } as SessionResult;
}

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

  test('does not subscribe when disposed while initialization is pending', async () => {
    const pendingSession = createDeferred<SessionResult>();
    const { client } = createClient();
    vi.mocked(client.auth.getSession).mockReturnValue(pendingSession.promise);
    const store = createAuthStore(() => client)();

    const initialization = store.initialize();
    store.dispose();
    pendingSession.resolve(sessionResult(session));
    await initialization;

    expect(client.auth.onAuthStateChange).not.toHaveBeenCalled();
    expect(store.isInitialized).toBe(false);
  });

  test('subscribes again when initialized after disposal', async () => {
    const firstSession = createDeferred<SessionResult>();
    const secondSession = createDeferred<SessionResult>();
    const { client, unsubscribe } = createClient();
    vi.mocked(client.auth.getSession)
      .mockReturnValueOnce(firstSession.promise)
      .mockReturnValueOnce(secondSession.promise);
    const store = createAuthStore(() => client)();

    const firstInitialization = store.initialize();
    firstSession.resolve(sessionResult(session));
    await firstInitialization;
    store.dispose();

    const secondInitialization = store.initialize();
    secondSession.resolve(sessionResult(session));
    await secondInitialization;

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(client.auth.getSession).toHaveBeenCalledTimes(2);
    expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(2);
    expect(store.isInitialized).toBe(true);
  });

  test('retries initialization after a delayed session-load failure', async () => {
    const failedSession = createDeferred<SessionResult>();
    const { client } = createClient();
    vi.mocked(client.auth.getSession)
      .mockReturnValueOnce(failedSession.promise)
      .mockResolvedValueOnce(sessionResult(session));
    const store = createAuthStore(() => client)();

    const failedInitialization = store.initialize();
    failedSession.resolve(sessionResult(null, new Error('load failed')));
    await expect(failedInitialization).rejects.toThrow('load failed');

    await store.initialize();

    expect(client.auth.getSession).toHaveBeenCalledTimes(2);
    expect(client.auth.onAuthStateChange).toHaveBeenCalledOnce();
    expect(store.isInitialized).toBe(true);
  });

  test('keeps the newer login session when initialization finishes later', async () => {
    const pendingSession = createDeferred<SessionResult>();
    const { client } = createClient();
    vi.mocked(client.auth.getSession).mockReturnValue(pendingSession.promise);
    vi.mocked(client.auth.signInWithPassword).mockResolvedValue({
      data: { session: loggedInSession },
      error: null
    } as never);
    const store = createAuthStore(() => client)();

    const initialization = store.initialize();
    await store.login('new-owner@example.com', 'password');
    pendingSession.resolve(sessionResult(session));
    await initialization;

    expect(store.session?.user.id).toBe('new-owner-id');
  });

  test('keeps the logged-out state when initialization finishes later', async () => {
    const pendingSession = createDeferred<SessionResult>();
    const { client } = createClient();
    vi.mocked(client.auth.getSession).mockReturnValue(pendingSession.promise);
    const store = createAuthStore(() => client)();

    const initialization = store.initialize();
    await store.logout();
    pendingSession.resolve(sessionResult(session));
    await initialization;

    expect(store.session).toBeNull();
  });
});
