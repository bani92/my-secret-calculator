# Supabase Auth and Budget Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the owner's Supabase login and persist all budget data in user-owned Supabase rows so the Vercel app works across PC and mobile.

**Architecture:** A lazy Supabase client supplies an authentication Pinia store and a `SupabaseBudgetRepository`. The budget store keeps the existing domain model and computed values, but sends row-level repository commands before changing local state. PostgreSQL RLS enforces `auth.uid() = user_id` for every table.

**Tech Stack:** Vue 3, Vite 6, TypeScript, Pinia, Vitest, `@supabase/supabase-js` 2.110.2, Supabase PostgreSQL/Auth/RLS, Vercel

## Global Constraints

- Use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the browser.
- Never add a Supabase Secret key to source code, `.env.local`, or Vercel client environment variables.
- Keep `.env.local`, `node_modules/`, and `dist/` out of Git.
- Start with empty Supabase tables; do not migrate IndexedDB data.
- Keep JSON export/import, but do not add realtime subscriptions or offline synchronization.
- Do not add signup or password-reset UI.
- Persist remotely before committing a mutation to Pinia memory.
- Preserve unrelated working-tree changes.

---

### Task 1: Supabase schema and owner-only RLS

**Files:**
- Create: `supabase/schema.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Consumes: Supabase `auth.users` and `auth.uid()`.
- Produces: `month_incomes`, `expenses`, and `person_money_records` tables available to the `authenticated` role.

- [ ] **Step 1: Add the complete idempotent schema**

Create `supabase/schema.sql`. Since the user confirmed the existing tables are empty, explicitly replace the trial tables and policies:

```sql
drop table if exists public.person_money_records cascade;
drop table if exists public.expenses cascade;
drop table if exists public.month_incomes cascade;

create table public.month_incomes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  income integer not null check (income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id text not null check (
    category_id in ('lunch', 'living', 'fixed', 'dating', 'groceries', 'transport', 'health', 'gifts', 'other')
  ),
  amount integer not null check (amount > 0),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (month = to_char(date, 'YYYY-MM'))
);

create table public.person_money_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  person_name text not null check (length(trim(person_name)) > 0),
  direction text not null check (direction in ('receivable', 'payable')),
  amount integer not null check (amount > 0),
  memo text not null default '',
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, date desc);
create index person_money_records_user_date_idx on public.person_money_records (user_id, date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger month_incomes_set_updated_at before update on public.month_incomes
for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();
create trigger person_money_records_set_updated_at before update on public.person_money_records
for each row execute function public.set_updated_at();

alter table public.month_incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.person_money_records enable row level security;

create policy "owners manage month incomes" on public.month_incomes
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage expenses" on public.expenses
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage person money records" on public.person_money_records
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.month_incomes, public.expenses, public.person_money_records from anon;
grant select, insert, update, delete on public.month_incomes, public.expenses, public.person_money_records to authenticated;
```

- [ ] **Step 2: Add the operator instructions**

Create `supabase/README.md` with the exact external action and checks:

```markdown
# Supabase setup

1. Confirm `month_incomes`, `expenses`, and `person_money_records` contain no data.
2. Open Supabase Dashboard > SQL Editor.
3. Paste and run `schema.sql` once.
4. In Authentication > Providers > Email, keep new-user signup disabled.
5. Confirm the owner account exists in Authentication > Users.

Do not place a Secret key in this repository or in Vercel's browser environment variables.
The Vue app uses only the project URL and Publishable key.
```

- [ ] **Step 3: Validate the schema file statically**

Run:

```powershell
rg -n "enable row level security|auth.uid\(\)|to authenticated|settled boolean|primary key \(user_id, month\)" supabase/schema.sql
```

Expected: matches for all three RLS statements and policies, plus the `settled` column and composite month key.

- [ ] **Step 4: Commit the schema**

```powershell
git add supabase/schema.sql supabase/README.md
git commit -m "feat: add owner-scoped Supabase schema"
```

---

### Task 2: Lazy Supabase client and authentication store

**Files:**
- Create: `src/lib/supabaseClient.ts`
- Create: `src/lib/supabaseClient.test.ts`
- Create: `src/stores/authStore.ts`
- Create: `src/stores/authStore.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `@supabase/supabase-js`.
- Produces: `requireSupabaseClient(): SupabaseClient`, `createAuthStore(getClient?)`, and `useAuthStore` with `initialize()`, `login(email, password)`, `logout()`, `session`, `isInitialized`, `isLoading`, and `errorMessage`.

- [ ] **Step 1: Write failing client-configuration tests**

Create `src/lib/supabaseClient.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the client test and verify RED**

Run: `npm test -- src/lib/supabaseClient.test.ts`

Expected: FAIL because `src/lib/supabaseClient.ts` does not exist.

- [ ] **Step 3: Implement lazy client creation**

Create `src/lib/supabaseClient.ts`:

```ts
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
    const config = readSupabaseConfig(import.meta.env);
    client = createClient(config.url, config.publishableKey);
  }

  return client;
}
```

- [ ] **Step 4: Run the client test and verify GREEN**

Run: `npm test -- src/lib/supabaseClient.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 5: Write failing authentication-store tests**

Create `src/stores/authStore.test.ts` with a typed fake client cast only at the boundary:

```ts
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

  test('loads and subscribes to the current session', async () => {
    const { client } = createClient();
    const store = createAuthStore(() => client)();

    await store.initialize();

    expect(store.session?.user.id).toBe('owner-id');
    expect(store.isInitialized).toBe(true);
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
});
```

- [ ] **Step 6: Run the auth test and verify RED**

Run: `npm test -- src/stores/authStore.test.ts`

Expected: FAIL because `authStore.ts` does not exist.

- [ ] **Step 7: Implement the authentication store**

Create `src/stores/authStore.ts` with `defineStore`, a `Session | null` ref, one cached initialization promise, and one `Subscription`. `initialize()` must call `getSession()`, then register `onAuthStateChange`; its callback assigns the next session. `login()` calls `signInWithPassword`, stores only the returned session, and maps failures to `이메일 또는 비밀번호를 확인해주세요.`. `logout()` calls `signOut()` and clears the session. `dispose()` unsubscribes. Export the production store as:

```ts
export const useAuthStore = createAuthStore(requireSupabaseClient);
```

Do not retain the email or password in Pinia state.

- [ ] **Step 8: Run Task 2 tests and commit**

Run: `npm test -- src/lib/supabaseClient.test.ts src/stores/authStore.test.ts`

Expected: all Task 2 tests PASS.

```powershell
git add .gitignore package.json package-lock.json src/lib/supabaseClient.ts src/lib/supabaseClient.test.ts src/stores/authStore.ts src/stores/authStore.test.ts
git commit -m "feat: add Supabase authentication state"
```

---

### Task 3: Supabase row repository

**Files:**
- Create: `src/storage/supabaseBudgetRepository.ts`
- Create: `src/storage/supabaseBudgetRepository.test.ts`

**Interfaces:**
- Consumes: existing `BudgetData`, `MonthRecord`, `Expense`, `PersonMoneyRecord`, and `requireSupabaseClient()`.
- Produces: a Supabase repository with the existing `load`/`save` contract plus row commands `setIncome`, `addExpense`, `deleteExpense`, `addPersonRecord`, `setPersonRecordSettled`, and `replaceAll`. The temporary `save()` compatibility method delegates to `replaceAll()` and is removed in Task 4.

- [ ] **Step 1: Write repository mapping and mutation tests**

Create `src/storage/supabaseBudgetRepository.test.ts`. Build a fake fluent query whose `select`, `upsert`, `insert`, `delete`, `update`, `eq`, and `neq` calls are spies and whose awaited result is configurable. Cover these exact assertions:

```ts
expect(data.months['2026-07']).toEqual({ month: '2026-07', income: 3_000_000 });
expect(data.expenses[0]).toMatchObject({ categoryId: 'lunch', amount: 12_000 });
expect(data.personRecords[0]).toMatchObject({ personName: '민수', settled: false });
expect(from).toHaveBeenCalledWith('month_incomes');
expect(from).toHaveBeenCalledWith('expenses');
expect(from).toHaveBeenCalledWith('person_money_records');
```

For mutations, assert camelCase maps to snake_case:

```ts
expect(expenseInsert).toHaveBeenCalledWith({
  id: expense.id,
  date: expense.date,
  month: expense.month,
  category_id: expense.categoryId,
  amount: expense.amount,
  memo: expense.memo
});
```

Also verify any `{ error }` response rejects with `Supabase 가계부 요청이 실패했습니다.`.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm test -- src/storage/supabaseBudgetRepository.test.ts`

Expected: FAIL because `SupabaseBudgetRepository` does not exist.

- [ ] **Step 3: Implement Supabase mapping and commands**

Create `SupabaseBudgetRepository`. `load()` runs three selects with `Promise.all`, checks every response error, then returns:

```ts
{
  version: 1,
  months: Object.fromEntries(monthRows.map((row) => [row.month, { month: row.month, income: row.income }])),
  expenses: expenseRows.map((row) => ({
    id: row.id,
    date: row.date,
    month: row.month,
    categoryId: row.category_id,
    amount: row.amount,
    memo: row.memo
  })),
  personRecords: personRows.map((row) => ({
    id: row.id,
    date: row.date,
    personName: row.person_name,
    direction: row.direction,
    amount: row.amount,
    memo: row.memo,
    settled: row.settled
  }))
}
```

The mutation methods use these operations:

```ts
client.from('month_incomes').upsert({ month, income }, { onConflict: 'user_id,month' });
client.from('expenses').insert({ id, date, month, category_id, amount, memo });
client.from('expenses').delete().eq('id', id);
client.from('person_money_records').insert({ id, date, person_name, direction, amount, memo, settled });
client.from('person_money_records').update({ settled }).eq('id', id);
```

`replaceAll()` obtains `client.auth.getUser()`, deletes only rows with `.eq('user_id', user.id)` from all three tables, and inserts the replacement arrays. Check every response before continuing and reject with the generic repository error when a response fails.

Do not send `user_id` on inserts; the database default `auth.uid()` owns the row and RLS validates it.

- [ ] **Step 4: Keep the repository compatible while this task lands**

Implement `BudgetRepository` temporarily by retaining:

```ts
async save(data: BudgetData): Promise<void> {
  await this.replaceAll(data);
}
```

This keeps the existing budget store and full build working until Task 4 switches all mutations to row commands.

- [ ] **Step 5: Run repository tests and build**

Run:

```powershell
npm test -- src/storage/supabaseBudgetRepository.test.ts
npm run build
```

Expected: repository tests PASS and the complete build succeeds because the repository still supports `load()` and `save()`.

- [ ] **Step 6: Commit repository work**

```powershell
git add src/storage/supabaseBudgetRepository.ts src/storage/supabaseBudgetRepository.test.ts
git commit -m "feat: persist budget rows in Supabase"
```

---

### Task 4: Pinia row-level persistence and reset

**Files:**
- Modify: `src/storage/budgetRepository.ts`
- Modify: `src/storage/indexedDbBudgetRepository.ts`
- Modify: `src/storage/indexedDbBudgetRepository.test.ts`
- Modify: `src/storage/localStorageBudgetRepository.ts`
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/budgetStore.test.ts`

**Interfaces:**
- Consumes: the granular `BudgetRepository` contract from Task 3.
- Produces: existing budget actions plus `reset(): void`; production `useBudgetStore` uses `SupabaseBudgetRepository`.

- [ ] **Step 1: Replace the repository contract and adapt local implementations**

Change `BudgetRepository` to:

```ts
import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from '../domain/types';

export interface BudgetRepository {
  load(): Promise<BudgetData>;
  setIncome(record: MonthRecord): Promise<void>;
  addExpense(expense: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  addPersonRecord(record: PersonMoneyRecord): Promise<void>;
  setPersonRecordSettled(id: string, settled: boolean): Promise<void>;
  replaceAll(data: BudgetData): Promise<void>;
}
```

Remove the temporary public `save()` from `SupabaseBudgetRepository`. In IndexedDB and localStorage repositories, keep a private whole-document `write(data)` helper and implement every public command as load-clone-mutate-write. Update IndexedDB repository tests to call `replaceAll()` for full-document persistence and add one row-command assertion.

- [ ] **Step 2: Convert the memory test repository**

Replace `save()` in `MemoryBudgetRepository` with granular methods that update its cloned `data`. Keep counters or spies per method. `replaceAll()` replaces the clone. Make `FailingSaveBudgetRepository` reject every mutation with `new Error('save failed')`.

Add assertions that each action calls only its matching method:

```ts
expect(repository.setIncomeCount).toBe(1);
expect(repository.addExpenseCount).toBe(1);
expect(repository.deleteExpenseCount).toBe(1);
expect(repository.addPersonRecordCount).toBe(1);
expect(repository.setPersonRecordSettledCount).toBe(1);
```

Add a reset test:

```ts
store.reset();
expect(store.isLoaded).toBe(false);
expect(store.data).toEqual(createEmptyBudgetData());
await store.initialize();
expect(repository.loadCount).toBe(2);
```

- [ ] **Step 3: Run store tests and verify RED**

Run: `npm test -- src/stores/budgetStore.test.ts`

Expected: FAIL because the store still calls `repository.save()` and has no `reset()`.

- [ ] **Step 4: Refactor each store action**

For every mutation, construct and validate the entity first, await the matching repository call, then update `data.value`:

```ts
const record = { month: selectedMonth.value, income };
await repository.setIncome(record);
data.value.months[record.month] = record;
```

Use the same sequence for expenses and person records. For settlement, compute `nextSettled`, await `setPersonRecordSettled(id, nextSettled)`, then assign it locally. `importJson()` calls `replaceAll(parsed)` before assigning parsed data.

Implement reset exactly as:

```ts
const reset = (): void => {
  data.value = createEmptyBudgetData();
  isLoaded.value = false;
  loadError.value = '';
  initializePromise = undefined;
};
```

Replace the production repository construction:

```ts
export const useBudgetStore = createBudgetStore(new SupabaseBudgetRepository(requireSupabaseClient));
```

- [ ] **Step 5: Run store and adapter tests and verify GREEN**

Run: `npm test -- src/stores/budgetStore.test.ts src/storage/indexedDbBudgetRepository.test.ts`

Expected: all store and adapter tests PASS, including failure-before-memory-update and reset/reload.

- [ ] **Step 6: Run the build and commit the atomic contract change**

Run: `npm run build`

Expected: PASS with every repository implementing the new contract.

```powershell
git add src/storage/budgetRepository.ts src/storage/supabaseBudgetRepository.ts src/storage/indexedDbBudgetRepository.ts src/storage/indexedDbBudgetRepository.test.ts src/storage/localStorageBudgetRepository.ts src/stores/budgetStore.ts src/stores/budgetStore.test.ts
git commit -m "refactor: save budget mutations by row"
```

---

### Task 5: Login UI and authenticated app lifecycle

**Files:**
- Create: `src/components/LoginForm.vue`
- Create: `src/components/LoginForm.test.ts`
- Modify: `src/App.vue`
- Modify: `src/App.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useAuthStore` from Task 2 and `budgetStore.reset()` from Task 4.
- Produces: email/password login form, logout command, authenticated budget initialization, and generic persistence errors.

- [ ] **Step 1: Write failing login-form tests**

Create `src/components/LoginForm.test.ts` and verify:

```ts
const wrapper = mount(LoginForm, { props: { loading: false, errorMessage: '' } });
await wrapper.get('[aria-label="이메일"]').setValue('owner@example.com');
await wrapper.get('[aria-label="비밀번호"]').setValue('password');
await wrapper.get('form').trigger('submit');
expect(wrapper.emitted('submit')?.[0]).toEqual([
  { email: 'owner@example.com', password: 'password' }
]);
```

Also verify the form has no signup control, displays `errorMessage` with `role="alert"`, and disables submit while `loading`.

- [ ] **Step 2: Run login-form tests and verify RED**

Run: `npm test -- src/components/LoginForm.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the login form**

Create a focused component with two local refs and this public contract:

```ts
defineProps<{ loading: boolean; errorMessage: string }>();
const emit = defineEmits<{
  submit: [credentials: { email: string; password: string }];
}>();
```

Render a compact panel titled `가계부 로그인`, email/password inputs, one `로그인` button, and the optional alert. Clear only the local password after a failed or completed submit; never store it outside this component.

- [ ] **Step 4: Replace App IndexedDB setup with auth/Supabase test doubles**

In `src/App.test.ts`, mock the auth and budget stores at module boundaries. Default tests to a valid owner session and an in-memory repository so existing feature tests remain unchanged semantically. Add these app-level cases:

```ts
expect(wrapper.text()).toContain('가계부 로그인');
expect(wrapper.text()).not.toContain('월 수입');
```

```ts
expect(authStore.login).toHaveBeenCalledWith('owner@example.com', 'password');
```

```ts
await logoutButton.trigger('click');
expect(authStore.logout).toHaveBeenCalledOnce();
expect(budgetStore.reset).toHaveBeenCalled();
```

Also verify authenticated initialization calls `budgetStore.initialize()` and a session change from owner to `null` removes the budget UI.

- [ ] **Step 5: Run App tests and verify RED**

Run: `npm test -- src/components/LoginForm.test.ts src/App.test.ts`

Expected: LoginForm tests PASS after Step 3; App auth cases FAIL because `App.vue` does not gate by session.

- [ ] **Step 6: Implement authenticated lifecycle in App**

On mount, call `authStore.initialize()`. Render in this order:

```vue
<section v-if="!authStore.isInitialized" class="panel">
  <p class="empty-copy">로그인 상태를 확인하는 중입니다.</p>
</section>
<LoginForm
  v-else-if="!authStore.session"
  :loading="authStore.isLoading"
  :error-message="authStore.errorMessage"
  @submit="login"
/>
<template v-else>
  <!-- existing budget loading state and tabs -->
</template>
```

Watch `authStore.session?.user.id`. When it becomes a user ID, call `budgetStore.reset()` and `budgetStore.initialize()`. When it becomes empty, call `budgetStore.reset()`. Add a `로그아웃` button to the authenticated header.

Wrap component-triggered persistence calls so rejected promises show `변경사항을 저장하지 못했습니다.` instead of producing unhandled promise rejections. Preserve the existing import-specific messages.

- [ ] **Step 7: Add restrained login styles**

In `src/styles.css`, add a centered login shell with the existing panel, form, input, and button visual language. Keep the login panel at `max-width: 420px`, maintain mobile padding, and add no marketing hero or signup copy.

- [ ] **Step 8: Run UI tests and commit**

Run: `npm test -- src/components/LoginForm.test.ts src/App.test.ts`

Expected: all login and existing app behavior tests PASS.

```powershell
git add src/components/LoginForm.vue src/components/LoginForm.test.ts src/App.vue src/App.test.ts src/styles.css
git commit -m "feat: require login for the budget app"
```

---

### Task 6: Full verification and deployment handoff

**Files:**
- Modify only files needed to fix verification failures caused by Tasks 1-5.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: passing tests/build and a concrete Supabase/Vercel/manual verification checklist.

- [ ] **Step 1: Run the entire unit suite**

Run: `npm test`

Expected: every Vitest file PASS. Fix only regressions introduced by this feature and rerun until green.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run build`

Expected: `vue-tsc --noEmit` and Vite production build complete successfully.

- [ ] **Step 3: Start the local app using the project command**

Run in a hidden PowerShell window:

```powershell
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','Set-Location "C:\Users\banse\OneDrive\바탕 화면\time-manager"; npm run dev -- --host 127.0.0.1' -WindowStyle Hidden
```

Then run:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.

- [ ] **Step 4: Verify browser behavior manually**

At `http://127.0.0.1:5173/` verify:

1. Logged out shows only the login experience.
2. Wrong credentials show a generic error.
3. Owner login opens an empty budget.
4. Income, expense, person record, settlement, and deletion survive refresh.
5. Logout hides budget data.
6. No Secret key appears in source or built environment configuration.

- [ ] **Step 5: Inspect final scope**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only intended implementation changes remain; no `node_modules/`, `dist/`, `.env.local`, or unrelated user files are staged.

- [ ] **Step 6: Commit verification fixes if any**

If verification required code changes, stage each concrete file by its actual path, inspect `git diff --cached`, and commit with `git commit -m "test: verify Supabase budget workflow"`. If no files changed, skip this step without creating an empty commit.

- [ ] **Step 7: External deployment checklist**

After local verification:

1. User runs `supabase/schema.sql` in Supabase SQL Editor.
2. Push implementation commits to GitHub.
3. Redeploy the latest Vercel deployment.
4. Log in on mobile and add one expense.
5. Refresh the PC app and confirm the same expense appears.
6. Confirm a logged-out browser cannot read any budget rows.

## Plan Self-Review

- Spec coverage: schema, `user_id` RLS, login/logout, row-level persistence, reset, JSON backup, generic errors, tests, build, and deployment validation each map to a task.
- Placeholder scan: every implementation step and file path is concrete; no unresolved markers remain.
- Type consistency: repository method names and domain types are identical in Tasks 3 and 4; auth store fields are identical in Tasks 2 and 5.
