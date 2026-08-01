# Recurring Fixed Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매달 반복되는 고정비 규칙을 관리하고, 앱을 열었을 때 오늘 날짜까지의 현재 월 고정비를 실제 지출로 자동 생성한다.

**Architecture:** 반복 고정비 규칙은 실제 지출과 분리해서 저장한다. Pinia store가 규칙 CRUD와 자동 생성 오케스트레이션을 맡고, repository는 local/IndexedDB/Supabase 저장소별 영속화를 맡는다. UI는 새 `고정비` 탭에서 규칙을 관리하고, 자동 생성된 지출은 기존 입력/대시보드/캘린더 흐름에 일반 지출처럼 표시한다.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, Supabase.

## Global Constraints

- 기본 작업 폴더는 `C:\Users\banse\OneDrive\바탕 화면\time-manager`이다.
- 프론트엔드는 현재 Vue 3 + Vite + TypeScript + Pinia + Vitest 구조를 유지한다.
- 새로운 백엔드나 서버 스케줄러를 추가하지 않는다.
- 자동 생성은 앱 데이터 로드 후 현재 월 기준으로만 실행한다.
- 반복일이 오늘 일자 이하이고 활성 상태인 규칙만 생성한다.
- 같은 규칙이 같은 월에 이미 생성된 경우 중복 생성하지 않는다.
- 규칙 수정은 앞으로 생성될 지출에만 적용하고, 이미 생성된 지출은 그대로 유지한다.
- 기존 백업 JSON에는 새 필드가 없을 수 있으므로 빈 배열로 보정한다.
- `node_modules/`와 `dist/`는 커밋하지 않는다.
- `npm audit fix --force`는 실행하지 않는다.
- 구현 완료 후 데스크톱과 모바일 화면 시안을 확인한 뒤 배포한다.

---

## File Structure

- Modify: `src/domain/types.ts`
  - `RecurringFixedExpenseRule` 타입 추가.
  - `Expense.recurringRuleId` 선택 필드 추가.
  - `BudgetData.recurringFixedExpenseRules` 배열 추가.

- Modify: `src/domain/calculations.ts`
  - `createEmptyBudgetData()`가 반복 고정비 규칙 빈 배열을 포함하도록 변경.
  - 현재 월과 오늘 날짜 기준으로 생성 대상 규칙을 계산하는 순수 함수 추가.

- Modify: `src/storage/exportImport.ts`
  - 백업 JSON 파서가 반복 고정비 규칙과 `Expense.recurringRuleId`를 검증하도록 변경.
  - 기존 JSON은 `recurringFixedExpenseRules: []`로 보정.

- Modify: `src/storage/budgetRepository.ts`
  - 반복 고정비 규칙 CRUD 메서드 추가.

- Modify: `src/storage/localStorageBudgetRepository.ts`
  - 전체 JSON 저장 방식이므로 타입 변경과 파서 변경에 맞춰 테스트만 보강한다.

- Modify: `src/storage/indexedDbBudgetRepository.ts`
  - 전체 JSON 저장 방식이므로 타입 변경과 파서 변경에 맞춰 테스트만 보강한다.

- Modify: `src/storage/supabaseBudgetRepository.ts`
  - 새 Supabase 테이블 로드와 규칙 CRUD 구현.
  - `expenses.recurring_rule_id` 매핑 추가.
  - `replace_budget_data` RPC payload 확장.

- Modify: `supabase/schema.sql`
  - `recurring_fixed_expense_rules` 테이블, RLS, 권한, replace RPC 확장.
  - `expenses.recurring_rule_id` 컬럼 추가.

- Modify: `supabase/README.md`
  - 기존 사용자가 적용할 마이그레이션 안내 추가.

- Create: `supabase/2026-08-01-add-recurring-fixed-expenses.sql`
  - 운영 Supabase에 적용할 증분 SQL.

- Create: `src/components/RecurringFixedExpenseTab.vue`
  - 고정비 규칙 목록, 추가/수정 다이얼로그, 활성 토글, 삭제, 이번 달 생성 상태 표시.

- Modify: `src/App.vue`
  - `고정비` 탭 추가.
  - 데이터 초기화 직후 자동 생성 실행.
  - 자동 생성 성공/실패 상태 메시지 표시.

- Modify: `src/styles.css`
  - 고정비 탭 목록과 모바일 레이아웃 스타일 추가.
  - 탭 개수 증가에 맞춰 desktop grid 조정.

- Test: `src/storage/exportImport.test.ts`
- Test: `src/stores/budgetStore.test.ts`
- Test: `src/storage/supabaseBudgetRepository.test.ts`
- Test: `src/App.test.ts`
- Test: `src/components/RecurringFixedExpenseTab.test.ts`

---

### Task 1: Domain Types, Empty Data, And Backup Compatibility

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/calculations.ts`
- Modify: `src/storage/exportImport.ts`
- Test: `src/storage/exportImport.test.ts`

**Interfaces:**
- Produces:
  - `interface RecurringFixedExpenseRule`
  - `Expense.recurringRuleId?: string`
  - `BudgetData.recurringFixedExpenseRules: RecurringFixedExpenseRule[]`
  - `createEmptyBudgetData(): BudgetData`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/storage/exportImport.test.ts`.

```ts
test('defaults missing recurring fixed expense rules to an empty array', () => {
  const raw = JSON.stringify({
    version: 1,
    months: {},
    expenses: [],
    incomeRecords: [],
    personRecords: []
  });

  expect(parseBudgetJson(raw).recurringFixedExpenseRules).toEqual([]);
});

test('preserves recurring fixed expense rules and expense source links', () => {
  const data = createEmptyBudgetData();

  data.recurringFixedExpenseRules.push({
    id: 'rule-id',
    dayOfMonth: 1,
    categoryId: 'fixed',
    amount: 10000,
    memo: '동양생명',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z'
  });
  data.expenses.push({
    id: 'expense-id',
    date: '2026-08-01',
    month: '2026-08',
    categoryId: 'fixed',
    amount: 10000,
    memo: '동양생명',
    recurringRuleId: 'rule-id'
  });

  expect(parseBudgetJson(stringifyBudgetData(data))).toEqual(data);
});

test('parseBudgetJson rejects an invalid recurring fixed expense rule', () => {
  const data = createEmptyBudgetData();

  data.recurringFixedExpenseRules.push({
    id: 'rule-id',
    dayOfMonth: 32,
    categoryId: 'fixed',
    amount: 10000,
    memo: '동양생명',
    active: true
  });

  expect(() => parseBudgetJson(JSON.stringify(data))).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- --run src/storage/exportImport.test.ts
```

Expected: TypeScript or assertion failures because `recurringFixedExpenseRules` and `recurringRuleId` are not supported yet.

- [ ] **Step 3: Add the minimal implementation**

Update `src/domain/types.ts`.

```ts
export interface RecurringFixedExpenseRule {
  id: string;
  dayOfMonth: number;
  categoryId: CategoryId;
  amount: number;
  memo: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  date: string;
  month: string;
  categoryId: CategoryId;
  amount: number;
  memo: string;
  createdAt?: string;
  recurringRuleId?: string;
}

export interface BudgetData {
  version: 1;
  months: Record<string, MonthRecord>;
  expenses: Expense[];
  incomeRecords: IncomeRecord[];
  personRecords: PersonMoneyRecord[];
  recurringFixedExpenseRules: RecurringFixedExpenseRule[];
}
```

Update `src/domain/calculations.ts`.

```ts
export function createEmptyBudgetData(): BudgetData {
  return {
    version: 1,
    months: {},
    expenses: [],
    incomeRecords: [],
    personRecords: [],
    recurringFixedExpenseRules: []
  };
}
```

Update `src/storage/exportImport.ts`.

```ts
function isRecurringFixedExpenseRule(value: unknown): value is BudgetData['recurringFixedExpenseRules'][number] {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    Number.isInteger(value.dayOfMonth) &&
    value.dayOfMonth >= 1 &&
    value.dayOfMonth <= 31 &&
    typeof value.categoryId === 'string' &&
    supportedCategoryIds.has(value.categoryId) &&
    isPositiveInteger(value.amount) &&
    typeof value.memo === 'string' &&
    typeof value.active === 'boolean' &&
    (typeof value.createdAt === 'undefined' || typeof value.createdAt === 'string') &&
    (typeof value.updatedAt === 'undefined' || typeof value.updatedAt === 'string')
  );
}
```

Also extend `isSupportedBudgetData`, `parseBudgetJson`, and `isExpense` so missing recurring rules become `[]`, valid rules are accepted, invalid rules are rejected, and `recurringRuleId` is accepted only when it is `undefined` or a string.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test -- --run src/storage/exportImport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/types.ts src/domain/calculations.ts src/storage/exportImport.ts src/storage/exportImport.test.ts
git commit -m "feat: add recurring fixed expense data shape"
```

---

### Task 2: Repository And Supabase Persistence

**Files:**
- Modify: `src/storage/budgetRepository.ts`
- Modify: `src/storage/supabaseBudgetRepository.ts`
- Modify: `src/storage/supabaseBudgetRepository.test.ts`
- Modify: `supabase/schema.sql`
- Modify: `supabase/README.md`
- Create: `supabase/2026-08-01-add-recurring-fixed-expenses.sql`

**Interfaces:**
- Consumes:
  - `RecurringFixedExpenseRule`
  - `Expense.recurringRuleId?: string`
- Produces:
  - `BudgetRepository.addRecurringFixedExpenseRule(rule: RecurringFixedExpenseRule): Promise<void>`
  - `BudgetRepository.updateRecurringFixedExpenseRule(rule: RecurringFixedExpenseRule): Promise<void>`
  - `BudgetRepository.deleteRecurringFixedExpenseRule(id: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

In `src/storage/supabaseBudgetRepository.test.ts`, add a `recurringRule` fixture.

```ts
const recurringRule = {
  id: 'rule-1',
  dayOfMonth: 1,
  categoryId: 'fixed' as const,
  amount: 10000,
  memo: '동양생명',
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z'
};
```

Add tests:

```ts
test('loads recurring fixed expense rules and expense source links', async () => {
  const fake = createClient([
    success([]),
    success([
      {
        id: expense.id,
        date: expense.date,
        month: expense.month,
        category_id: expense.categoryId,
        amount: expense.amount,
        memo: expense.memo,
        recurring_rule_id: 'rule-1'
      }
    ]),
    success([]),
    success([]),
    success([
      {
        id: recurringRule.id,
        day_of_month: recurringRule.dayOfMonth,
        category_id: recurringRule.categoryId,
        amount: recurringRule.amount,
        memo: recurringRule.memo,
        active: recurringRule.active,
        created_at: recurringRule.createdAt,
        updated_at: recurringRule.updatedAt
      }
    ])
  ]);
  const repository = new SupabaseBudgetRepository(() => fake.client);

  const data = await repository.load();

  expect(data.expenses[0].recurringRuleId).toBe('rule-1');
  expect(data.recurringFixedExpenseRules[0]).toEqual(recurringRule);
  expect(fake.from).toHaveBeenCalledWith('recurring_fixed_expense_rules');
});

test('inserts, updates, and deletes recurring fixed expense rules', async () => {
  const fake = createClient([success(), success(), success()]);
  const repository = new SupabaseBudgetRepository(() => fake.client);

  await repository.addRecurringFixedExpenseRule(recurringRule);
  await repository.updateRecurringFixedExpenseRule({ ...recurringRule, amount: 20000, active: false });
  await repository.deleteRecurringFixedExpenseRule(recurringRule.id);

  expect(fake.queriesFor('recurring_fixed_expense_rules')[0].insert).toHaveBeenCalledWith({
    id: 'rule-1',
    day_of_month: 1,
    category_id: 'fixed',
    amount: 10000,
    memo: '동양생명',
    active: true,
    created_at: recurringRule.createdAt,
    updated_at: recurringRule.updatedAt
  });
  expect(fake.queriesFor('recurring_fixed_expense_rules')[1].update).toHaveBeenCalledWith({
    day_of_month: 1,
    category_id: 'fixed',
    amount: 20000,
    memo: '동양생명',
    active: false
  });
  expect(fake.queriesFor('recurring_fixed_expense_rules')[2].delete).toHaveBeenCalledOnce();
});
```

Extend the schema test:

```ts
expect(schema).toContain('create table public.recurring_fixed_expense_rules');
expect(schema).toContain('recurring_rule_id uuid');
expect(schema).toContain('p_recurring_fixed_expense_rules jsonb');
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- --run src/storage/supabaseBudgetRepository.test.ts
```

Expected: FAIL because repository interfaces and schema do not include recurring rules yet.

- [ ] **Step 3: Implement repository support**

Update `BudgetTable` in `src/storage/supabaseBudgetRepository.ts`.

```ts
type BudgetTable =
  | 'month_incomes'
  | 'expenses'
  | 'income_records'
  | 'person_money_records'
  | 'recurring_fixed_expense_rules';
```

Add row mapping functions.

```ts
interface RecurringFixedExpenseRuleRow {
  id: string;
  day_of_month: number;
  category_id: CategoryId;
  amount: number;
  memo: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

function toRecurringFixedExpenseRuleRow(rule: RecurringFixedExpenseRule): RecurringFixedExpenseRuleRow {
  return {
    id: rule.id,
    day_of_month: rule.dayOfMonth,
    category_id: rule.categoryId,
    amount: rule.amount,
    memo: rule.memo,
    active: rule.active,
    ...(rule.createdAt === undefined ? {} : { created_at: rule.createdAt }),
    ...(rule.updatedAt === undefined ? {} : { updated_at: rule.updatedAt })
  };
}
```

Update `load()` to fetch five tables with `Promise.all`, map `recurring_rule_id` into expenses, and return `recurringFixedExpenseRules`.

Update `addExpense()` to include `recurring_rule_id` when `expense.recurringRuleId` exists.

Add repository methods:

```ts
async addRecurringFixedExpenseRule(rule: RecurringFixedExpenseRule): Promise<void> {
  const response = await this.client().from('recurring_fixed_expense_rules').insert(toRecurringFixedExpenseRuleRow(rule));

  ensureSuccess(response);
}

async updateRecurringFixedExpenseRule(rule: RecurringFixedExpenseRule): Promise<void> {
  const response = await this.client()
    .from('recurring_fixed_expense_rules')
    .update({
      day_of_month: rule.dayOfMonth,
      category_id: rule.categoryId,
      amount: rule.amount,
      memo: rule.memo,
      active: rule.active
    })
    .eq('id', rule.id);

  ensureSuccess(response);
}

async deleteRecurringFixedExpenseRule(id: string): Promise<void> {
  const response = await this.client().from('recurring_fixed_expense_rules').delete().eq('id', id);

  ensureSuccess(response);
}
```

- [ ] **Step 4: Implement Supabase SQL**

In `supabase/schema.sql`, add:

```sql
create table public.recurring_fixed_expense_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_of_month integer not null check (day_of_month between 1 and 31),
  category_id text not null check (
    category_id in ('lunch', 'living', 'fixed', 'dating', 'groceries', 'transport', 'health', 'gifts', 'other')
  ),
  amount integer not null check (amount > 0),
  memo text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses add column if not exists recurring_rule_id uuid null;
alter table public.recurring_fixed_expense_rules enable row level security;

create policy "owners manage recurring fixed expense rules" on public.recurring_fixed_expense_rules
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

Create `supabase/2026-08-01-add-recurring-fixed-expenses.sql` with the same table/column/policy additions plus the `replace_budget_data` RPC replacement needed for existing databases.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test -- --run src/storage/supabaseBudgetRepository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/storage/budgetRepository.ts src/storage/supabaseBudgetRepository.ts src/storage/supabaseBudgetRepository.test.ts supabase/schema.sql supabase/README.md supabase/2026-08-01-add-recurring-fixed-expenses.sql
git commit -m "feat: persist recurring fixed expense rules"
```

---

### Task 3: Store CRUD And Automatic Generation

**Files:**
- Modify: `src/domain/calculations.ts`
- Modify: `src/stores/budgetStore.ts`
- Test: `src/stores/budgetStore.test.ts`

**Interfaces:**
- Consumes:
  - `BudgetRepository.addRecurringFixedExpenseRule`
  - `BudgetRepository.updateRecurringFixedExpenseRule`
  - `BudgetRepository.deleteRecurringFixedExpenseRule`
- Produces:
  - `store.addRecurringFixedExpenseRule(payload)`
  - `store.updateRecurringFixedExpenseRule(payload)`
  - `store.deleteRecurringFixedExpenseRule(id)`
  - `store.generateDueRecurringFixedExpenses(today?: Date): Promise<number>`
  - `store.getRecurringFixedExpenseStatuses(month: string, today?: Date)`

- [ ] **Step 1: Write failing tests for CRUD**

Extend `MemoryBudgetRepository` in `src/stores/budgetStore.test.ts` with recurring rule arrays and counters. Add tests:

```ts
test('adds, updates, deactivates, and deletes recurring fixed expense rules', async () => {
  vi.setSystemTime(new Date('2026-08-01T09:00:00.000Z'));
  const { repository, store } = createBudgetStoreForTest();

  await store.initialize();
  await store.addRecurringFixedExpenseRule({
    dayOfMonth: 1,
    categoryId: 'fixed',
    amount: 10000,
    memo: ' 동양생명 ',
    active: true
  });

  expect(store.data.recurringFixedExpenseRules[0]).toMatchObject({
    id: '00000000-0000-4000-8000-000000000001',
    dayOfMonth: 1,
    categoryId: 'fixed',
    amount: 10000,
    memo: '동양생명',
    active: true,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z'
  });
  expect(repository.addRecurringFixedExpenseRuleCount).toBe(1);

  await store.updateRecurringFixedExpenseRule({
    id: '00000000-0000-4000-8000-000000000001',
    dayOfMonth: 1,
    categoryId: 'fixed',
    amount: 20000,
    memo: '동양생명',
    active: false
  });

  expect(store.data.recurringFixedExpenseRules[0]).toMatchObject({ amount: 20000, active: false });

  await store.deleteRecurringFixedExpenseRule('00000000-0000-4000-8000-000000000001');

  expect(store.data.recurringFixedExpenseRules).toEqual([]);
});
```

- [ ] **Step 2: Write failing tests for automatic generation**

Add tests:

```ts
test('generates due recurring fixed expenses for the current month without duplicates', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    recurringFixedExpenseRules: [
      { id: 'rule-1', dayOfMonth: 1, categoryId: 'fixed', amount: 10000, memo: '동양생명', active: true },
      { id: 'rule-2', dayOfMonth: 5, categoryId: 'fixed', amount: 30000, memo: '자동차보험', active: true }
    ]
  });
  const { store } = createBudgetStoreForTest(repository);

  await store.initialize();
  const createdCount = await store.generateDueRecurringFixedExpenses(new Date('2026-08-02T09:00:00.000Z'));
  const secondCount = await store.generateDueRecurringFixedExpenses(new Date('2026-08-02T09:00:00.000Z'));

  expect(createdCount).toBe(1);
  expect(secondCount).toBe(0);
  expect(store.data.expenses).toHaveLength(1);
  expect(store.data.expenses[0]).toMatchObject({
    date: '2026-08-01',
    month: '2026-08',
    categoryId: 'fixed',
    amount: 10000,
    memo: '동양생명',
    recurringRuleId: 'rule-1'
  });
});

test('uses the updated rule amount next month without changing the previous generated expense', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    recurringFixedExpenseRules: [
      { id: 'rule-1', dayOfMonth: 1, categoryId: 'fixed', amount: 10000, memo: '동양생명', active: true }
    ]
  });
  const { store } = createBudgetStoreForTest(repository);

  await store.initialize();
  await store.generateDueRecurringFixedExpenses(new Date('2026-08-01T09:00:00.000Z'));
  await store.updateRecurringFixedExpenseRule({
    id: 'rule-1',
    dayOfMonth: 1,
    categoryId: 'fixed',
    amount: 20000,
    memo: '동양생명',
    active: true
  });
  await store.generateDueRecurringFixedExpenses(new Date('2026-09-01T09:00:00.000Z'));

  expect(store.data.expenses.map((expense) => [expense.month, expense.amount])).toEqual([
    ['2026-08', 10000],
    ['2026-09', 20000]
  ]);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm test -- --run src/stores/budgetStore.test.ts
```

Expected: FAIL because store actions do not exist.

- [ ] **Step 4: Implement store logic**

Add validation helper in `budgetStore.ts`.

```ts
const validateRecurringFixedExpenseRulePayload = (payload: {
  dayOfMonth: number;
  amount: number;
  memo: string;
}): void => {
  if (!Number.isInteger(payload.dayOfMonth) || payload.dayOfMonth < 1 || payload.dayOfMonth > 31) {
    throw new Error('반복일은 1일부터 31일 사이여야 합니다.');
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('고정비 금액은 0원보다 커야 합니다.');
  }

  if (payload.memo.trim().length === 0) {
    throw new Error('고정비 항목명을 입력해주세요.');
  }
};
```

Add `isExistingRecurringExpense` and date helpers:

```ts
function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));

  return new Date(year, monthNumber, 0).getDate();
}

function dateForRule(month: string, dayOfMonth: number): string {
  return `${month}-${String(dayOfMonth).padStart(2, '0')}`;
}
```

Implement CRUD and generation actions. `generateDueRecurringFixedExpenses(today = new Date())` should:

```ts
const todayIso = today.toISOString().slice(0, 10);
const currentMonth = toMonth(todayIso);
const todayDay = Number(todayIso.slice(8, 10));
let createdCount = 0;

for (const rule of data.value.recurringFixedExpenseRules) {
  if (!rule.active || rule.dayOfMonth > todayDay || rule.dayOfMonth > daysInMonth(currentMonth)) {
    continue;
  }

  const alreadyExists = data.value.expenses.some(
    (expense) => expense.recurringRuleId === rule.id && expense.month === currentMonth
  );

  if (alreadyExists) {
    continue;
  }

  await addExpense({
    date: dateForRule(currentMonth, rule.dayOfMonth),
    categoryId: rule.categoryId,
    amount: rule.amount,
    memo: rule.memo,
    recurringRuleId: rule.id
  });
  createdCount += 1;
}

return createdCount;
```

Allow `addExpense` to accept optional `recurringRuleId`.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test -- --run src/stores/budgetStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/calculations.ts src/stores/budgetStore.ts src/stores/budgetStore.test.ts
git commit -m "feat: generate due recurring fixed expenses"
```

---

### Task 4: Fixed Expense Management Tab

**Files:**
- Create: `src/components/RecurringFixedExpenseTab.vue`
- Create: `src/components/RecurringFixedExpenseTab.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes:
  - `store.data.recurringFixedExpenseRules`
  - `store.addRecurringFixedExpenseRule`
  - `store.updateRecurringFixedExpenseRule`
  - `store.deleteRecurringFixedExpenseRule`
  - `store.getRecurringFixedExpenseStatuses`

- [ ] **Step 1: Write failing component tests**

Create `src/components/RecurringFixedExpenseTab.test.ts`.

```ts
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { reactive } from 'vue';

import RecurringFixedExpenseTab from './RecurringFixedExpenseTab.vue';

const mockedStore = vi.hoisted(() => ({
  store: undefined as any
}));

vi.mock('../stores/budgetStore', () => ({
  useBudgetStore: () => mockedStore.store
}));

describe('RecurringFixedExpenseTab', () => {
  beforeEach(() => {
    mockedStore.store = reactive({
      data: {
        recurringFixedExpenseRules: [
          { id: 'rule-1', dayOfMonth: 1, categoryId: 'fixed', amount: 10000, memo: '동양생명', active: true },
          { id: 'rule-2', dayOfMonth: 5, categoryId: 'fixed', amount: 30000, memo: '자동차보험', active: true }
        ]
      },
      addRecurringFixedExpenseRule: vi.fn(async () => undefined),
      updateRecurringFixedExpenseRule: vi.fn(async () => undefined),
      deleteRecurringFixedExpenseRule: vi.fn(async () => undefined),
      getRecurringFixedExpenseStatuses: vi.fn(() => [
        { ruleId: 'rule-1', label: '8월 1일 동양생명', state: 'created' },
        { ruleId: 'rule-2', label: '8월 5일 자동차보험', state: 'scheduled' }
      ])
    });
  });

  test('lists recurring fixed expense rules and current-month statuses', () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    expect(wrapper.text()).toContain('동양생명');
    expect(wrapper.text()).toContain('10,000원');
    expect(wrapper.text()).toContain('자동차보험');
    expect(wrapper.text()).toContain('8월 1일 동양생명');
    expect(wrapper.text()).toContain('생성됨');
    expect(wrapper.text()).toContain('예정');
  });

  test('adds a recurring fixed expense rule from the dialog', async () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    await wrapper.get('[data-testid="open-recurring-rule-add"]').trigger('click');
    await wrapper.get('[data-testid="recurring-rule-day"]').setValue('15');
    await wrapper.get('[data-testid="recurring-rule-category"]').setValue('fixed');
    await wrapper.get('[data-testid="recurring-rule-amount"]').setValue('50000');
    await wrapper.get('[data-testid="recurring-rule-memo"]').setValue('관리비');
    await wrapper.get('[data-testid="save-recurring-rule"]').trigger('click');

    expect(mockedStore.store.addRecurringFixedExpenseRule).toHaveBeenCalledWith({
      dayOfMonth: 15,
      categoryId: 'fixed',
      amount: 50000,
      memo: '관리비',
      active: true
    });
  });

  test('updates and deletes an existing recurring fixed expense rule', async () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    await wrapper.get('[data-testid="edit-recurring-rule-rule-1"]').trigger('click');
    await wrapper.get('[data-testid="recurring-rule-amount"]').setValue('20000');
    await wrapper.get('[data-testid="save-recurring-rule"]').trigger('click');

    expect(mockedStore.store.updateRecurringFixedExpenseRule).toHaveBeenCalledWith({
      id: 'rule-1',
      dayOfMonth: 1,
      categoryId: 'fixed',
      amount: 20000,
      memo: '동양생명',
      active: true
    });

    await wrapper.get('[data-testid="delete-recurring-rule-rule-1"]').trigger('click');

    expect(mockedStore.store.deleteRecurringFixedExpenseRule).toHaveBeenCalledWith('rule-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- --run src/components/RecurringFixedExpenseTab.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create `RecurringFixedExpenseTab.vue` with:

- A `section.recurring-layout` root.
- A `panel` for the rule list and add button.
- A `panel` for current-month automatic generation status.
- A shared add/edit dialog using `dialog-backdrop` and `dialog-panel`.
- Money formatting through existing `formatMoneyInput` and `parseMoneyInput`.
- `data-testid` values from the tests.

The form state should use:

```ts
const ruleForm = reactive({
  dayOfMonth: 1,
  categoryId: 'fixed' as CategoryId,
  memo: '',
  active: true
});
const amountDraft = ref('');
const editingRuleId = ref<string | null>(null);
```

Use `categories` from `src/domain/categories.ts` and `formatWon(amount)` returning `${amount.toLocaleString('ko-KR')}원`.

- [ ] **Step 4: Add responsive styles**

Add styles in `src/styles.css`:

```css
.recurring-layout {
  display: grid;
  gap: var(--space-4);
  max-width: 1120px;
  margin: 0 auto;
}

.recurring-rule-list,
.recurring-status-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.recurring-rule-item {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) minmax(104px, auto) minmax(112px, auto);
  align-items: center;
  gap: var(--space-3);
  border-top: 1px solid var(--color-line);
  padding-top: var(--space-3);
}

.recurring-rule-main {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.recurring-rule-main strong,
.recurring-rule-main span {
  overflow-wrap: anywhere;
}

.recurring-rule-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .recurring-rule-item {
    grid-template-columns: 1fr;
  }

  .recurring-rule-actions {
    justify-content: stretch;
  }

  .recurring-rule-actions .icon-button {
    flex: 1;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test -- --run src/components/RecurringFixedExpenseTab.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/RecurringFixedExpenseTab.vue src/components/RecurringFixedExpenseTab.test.ts src/styles.css
git commit -m "feat: add recurring fixed expense tab"
```

---

### Task 5: App Integration And Initialization Auto-Generation

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes:
  - `RecurringFixedExpenseTab`
  - `store.generateDueRecurringFixedExpenses`

- [ ] **Step 1: Write failing integration tests**

Update the in-memory repository in `src/App.test.ts` to include recurring repository methods. Add tests:

```ts
test('shows the recurring fixed expense tab', async () => {
  const wrapper = await mountLoadedApp();

  await wrapper.findAll('button').find((button) => button.text() === '고정비')?.trigger('click');

  expect(wrapper.get('[aria-selected="true"]').text()).toBe('고정비');
  expect(wrapper.text()).toContain('고정비 추가');
});

test('generates due recurring fixed expenses after loading budget data', async () => {
  vi.setSystemTime(new Date('2026-08-01T09:00:00.000Z'));
  budgetData.recurringFixedExpenseRules.push({
    id: 'rule-1',
    dayOfMonth: 1,
    categoryId: 'fixed',
    amount: 10000,
    memo: '동양생명',
    active: true
  });

  const wrapper = await mountLoadedApp();
  await flushAsyncActions();

  expect(mockedStores.budgetStore.data.expenses[0]).toMatchObject({
    date: '2026-08-01',
    amount: 10000,
    memo: '동양생명',
    recurringRuleId: 'rule-1'
  });
  expect(wrapper.text()).toContain('고정비 1건을 자동 생성했습니다.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- --run src/App.test.ts
```

Expected: FAIL because `고정비` tab and initialization generation are not wired.

- [ ] **Step 3: Wire the tab and auto-generation**

In `src/App.vue`:

```ts
import RecurringFixedExpenseTab from './components/RecurringFixedExpenseTab.vue';

type TabId = 'input' | 'recurring' | 'dashboard' | 'statistics' | 'calendar' | 'people';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'input', label: '입력' },
  { id: 'recurring', label: '고정비' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'statistics', label: '통계' },
  { id: 'calendar', label: '캘린더' },
  { id: 'people', label: '사람' }
];
```

Render the component:

```vue
<LedgerTab v-if="activeTab === 'input'" :initial-expense-date="pendingExpenseDate" />
<RecurringFixedExpenseTab v-else-if="activeTab === 'recurring'" />
<DashboardTab v-else-if="activeTab === 'dashboard'" />
```

After `await store.initialize()` in `initializeBudget`, run:

```ts
const createdCount = await store.generateDueRecurringFixedExpenses();

if (createdCount > 0) {
  showStatus(`고정비 ${createdCount}건을 자동 생성했습니다.`);
}
```

If generation throws, show:

```ts
showStatus('고정비 자동 생성 중 일부 항목을 저장하지 못했습니다.');
```

Update `.tabs` desktop grid to six tabs:

```css
.tabs {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
```

Keep mobile `repeat(2, minmax(0, 1fr))`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test -- --run src/App.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/App.vue src/App.test.ts src/styles.css
git commit -m "feat: run recurring fixed expenses on app load"
```

---

### Task 6: Full Verification And Visual Review

**Files:**
- Modify only files required by findings from verification.
- Capture screenshots from the running app for desktop and mobile review.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified build and visual review artifacts or screenshot links in the final report.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start local dev server**

Run the project-standard command:

```powershell
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','Set-Location "C:\Users\banse\OneDrive\바탕 화면\time-manager"; npm run dev -- --host 127.0.0.1' -WindowStyle Hidden
```

Check response:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.

- [ ] **Step 4: Capture desktop and mobile views**

Use browser tooling or Playwright against `http://127.0.0.1:5173/`.

Capture:

- Desktop `1366x900`: 고정비 탭.
- Desktop `1366x900`: 입력 탭 with auto-generated fixed expense visible.
- Mobile `390x844`: 고정비 탭.
- Mobile `360x780`: 입력 탭 with auto-generated fixed expense visible.

Inspect these items:

- 고정비 목록 날짜, 항목명, 금액, 수정/삭제 버튼이 겹치지 않는다.
- 모바일에서 버튼 텍스트가 버튼 밖으로 넘치지 않는다.
- 자동 생성 지출이 거래 내역에서 일반 지출처럼 표시된다.
- 탭 6개가 모바일에서 2열로 안정적으로 줄바꿈된다.

- [ ] **Step 5: Fix visual issues found in screenshots**

If screenshots show overlap, update only `src/styles.css` or the relevant component markup. After each fix, repeat:

```powershell
npm test -- --run src/components/RecurringFixedExpenseTab.test.ts src/App.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Final commit**

If visual fixes were needed:

```powershell
git add src/styles.css src/components/RecurringFixedExpenseTab.vue src/App.vue
git commit -m "fix: polish recurring fixed expense responsive layout"
```

If no visual fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: 고정비 탭, 규칙 CRUD, 현재 월 오늘 날짜까지 자동 생성, 중복 방지, 과거 지출 유지, Supabase 저장, 백업 호환, 배포 전 화면 검수를 모두 작업에 배치했다.
- Placeholder scan: 계획에는 미정 작업을 뜻하는 금지 문구가 없다.
- Type consistency: `RecurringFixedExpenseRule`, `recurringRuleId`, `recurringFixedExpenseRules`, `generateDueRecurringFixedExpenses` 이름을 모든 작업에서 동일하게 사용했다.
