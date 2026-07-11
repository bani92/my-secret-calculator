import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export function readSupabaseConfig(environment: SupabaseEnvironment): {
  url: string;
  publishableKey: string;
} {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error('Supabase 연결 환경변수가 설정되지 않았습니다.');
  }

  return { url, publishableKey };
}

let client: SupabaseClient | undefined;

export function requireSupabaseClient(): SupabaseClient {
  if (!client) {
    const config = readSupabaseConfig({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    });
    client = createClient(config.url, config.publishableKey);
  }

  return client;
}
