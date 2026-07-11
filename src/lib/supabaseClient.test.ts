import { describe, expect, test } from 'vitest';

import { readSupabaseConfig } from './supabaseClient';

describe('readSupabaseConfig', () => {
  test('returns the project URL and publishable key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key'
      })
    ).toEqual({ url: 'https://example.supabase.co', publishableKey: 'publishable-key' });
  });

  test('rejects missing browser configuration without exposing secrets', () => {
    expect(() => readSupabaseConfig({})).toThrow('Supabase 연결 환경변수가 설정되지 않았습니다.');
  });
});
