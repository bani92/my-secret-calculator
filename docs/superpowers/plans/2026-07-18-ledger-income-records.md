# Ledger Income Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class income records so the ledger can show date-grouped `+` income and `-` expense entries, and make income addition/carry-over affect the budget through transaction items instead of directly changing the base monthly income.

**Architecture:** Keep existing `expenses` and `month_incomes` intact, add `incomeRecords` as a parallel domain collection and `income_records` as a Supabase table. The store exposes income-record mutations and derived ledger groups; `LedgerTab.vue` renders grouped entries and uses shared dialog styles for income and expense editing.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, Supabase PostgreSQL/RLS, existing localStorage/IndexedDB repository adapters

## Global Constraints

- Documentation and user-facing explanations are Korean by default.
- Preserve unrelated working-tree changes.
- Do not commit `node_modules/`, `dist/`, `.env.local`, or `.superpowers/`.
- Use TDD where practical: add failing tests before implementation.
- 월 기본 수입은 `month_incomes`에 저장한다.
- 추가 수입, 전월 이월, 환급, 기타 입금은 `income_records`에 `+` 항목으로 저장한다.
- 전월 이월 항목 날짜는 선택 월의 1일이다.
- 거래 내역 정렬은 `date DESC, createdAt DESC`이다.
- 날짜 헤더의 일 합계는 `해당 날짜 수입 합계 - 해당 날짜 지출 합계`이다.
- 모바일 검증은 360px, 390px, 1280px 폭을 포함한다.

---

### Task 1: Domain Model and JSON Compatibility

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/categories.ts`
- Modify: `src/domain/calculations.ts`
- Modify: `src/domain/calculations.test.ts`
- Modify: `src/storage/exportImport.ts`
- Modify: `src/storage/exportImport.test.ts`

**Interfaces:**
- Produces: `IncomeCategoryId`, `IncomeRecord`, `incomeCategories`, and `BudgetData.incomeRecords`.
- Produces: `calculateMonthSummary(month, months, expenses, incomeRecords)` where `incomeRecords` defaults to `[]` only at call sites that intentionally handle older data.

- [ ] **Step 1: Write failing JSON compatibility tests**

Add tests to `src/storage/exportImport.test.ts`:

```ts
test('defaults missing incomeRecords to an empty array', () => {
  const raw = JSON.stringify({
    version: 1,
    months: {},
    expenses: [],
    personRecords: []
  });

  expect(parseBudgetJson(raw).incomeRecords).toEqual([]);
});

test('preserves income records during export and import', () => {
  const data = createEmptyBudgetData();
  data.incomeRecords.push({
    id: 'income-id',
    date: '2026-07-18',
    month: '2026-07',
    categoryId: 'refund',
    amount: 100000,
    memo: '환급',
    createdAt: '2026-07-18T01:02:03.000Z'
  });

  expect(parseBudgetJson(stringifyBudgetData(data)).incomeRecords[0]).toMatchObject({
    id: 'income-id',
    categoryId: 'refund',
    amount: 100000
  });
});
```

Run:

```powershell
npm test -- src/storage/exportImport.test.ts
```

Expected: FAIL because `incomeRecords` does not exist.

- [ ] **Step 2: Add domain types and categories**

In `src/domain/types.ts`, add:

```ts
export type IncomeCategoryId = 'salary' | 'side' | 'carryOver' | 'refund' | 'transfer' | 'other';

export interface IncomeRecord {
  id: string;
  date: string;
  month: string;
  categoryId: IncomeCategoryId;
  amount: number;
  memo: string;
  createdAt?: string;
}
```

Add `incomeRecords: IncomeRecord[]` to `BudgetData`.

In `src/domain/categories.ts`, add:

```ts
export const incomeCategories: Array<{ id: IncomeCategoryId; label: string }> = [
  { id: 'salary', label: '월급' },
  { id: 'side', label: '부수입' },
  { id: 'carryOver', label: '전월 이월' },
  { id: 'refund', label: '환급' },
  { id: 'transfer', label: '이체' },
  { id: 'other', label: '기타' }
];
```

- [ ] **Step 3: Update empty data and parser**

In `createEmptyBudgetData()`, include `incomeRecords: []`.

In `parseBudgetJson`, accept missing `incomeRecords` as `[]`. Validate each income record:

```ts
{
  id: string;
  date: YYYY-MM-DD;
  month: YYYY-MM;
  categoryId: IncomeCategoryId;
  amount: positive integer;
  memo: string;
  createdAt?: string;
}
```

- [ ] **Step 4: Write failing month summary tests**

In `src/domain/calculations.test.ts`, add:

```ts
test('adds income records to monthly income summary', () => {
  const summary = calculateMonthSummary(
    '2026-07',
    { '2026-07': { month: '2026-07', income: 2800000 } },
    [],
    [
      {
        id: 'income-id',
        date: '2026-07-18',
        month: '2026-07',
        categoryId: 'refund',
        amount: 100000,
        memo: '환급',
        createdAt: '2026-07-18T00:00:00.000Z'
      }
    ]
  );

  expect(summary.income).toBe(2900000);
  expect(summary.remaining).toBe(2900000);
});
```

Run:

```powershell
npm test -- src/domain/calculations.test.ts
```

Expected: FAIL until `calculateMonthSummary` accepts and sums income records.

- [ ] **Step 5: Implement calculation update**

Change `calculateMonthSummary` signature to:

```ts
export function calculateMonthSummary(
  month: string,
  months: Record<string, MonthRecord>,
  expenses: Expense[],
  incomeRecords: IncomeRecord[] = []
): MonthSummary
```

Compute:

```ts
const baseIncome = months[month]?.income ?? 0;
const extraIncome = incomeRecords
  .filter((record) => record.month === month)
  .reduce((sum, record) => sum + record.amount, 0);
const income = baseIncome + extraIncome;
```

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
npm test -- src/storage/exportImport.test.ts src/domain/calculations.test.ts
npm run build
```

Expected: PASS.

Commit:

```powershell
git add src/domain/types.ts src/domain/categories.ts src/domain/calculations.ts src/domain/calculations.test.ts src/storage/exportImport.ts src/storage/exportImport.test.ts
git commit -m "feat: add income record domain model"
```

---

### Task 2: Repository Persistence for Income Records

**Files:**
- Modify: `src/storage/budgetRepository.ts`
- Modify: `src/storage/localStorageBudgetRepository.ts`
- Modify: `src/storage/indexedDbBudgetRepository.ts`
- Modify: `src/storage/indexedDbBudgetRepository.test.ts`
- Modify: `src/storage/supabaseBudgetRepository.ts`
- Modify: `src/storage/supabaseBudgetRepository.test.ts`
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: `IncomeRecord`.
- Produces: repository methods `addIncomeRecord(record)`, `updateIncomeRecord(record)`, and `deleteIncomeRecord(id)`.

- [ ] **Step 1: Write failing repository contract tests**

In adapter tests, add cases asserting local/IndexedDB repositories persist income records through add, update, delete, and replace.

In `src/storage/supabaseBudgetRepository.test.ts`, assert:

```ts
expect(fake.from).toHaveBeenCalledWith('income_records');
expect(fake.queriesFor('income_records')[0].insert).toHaveBeenCalledWith({
  id: incomeRecord.id,
  date: incomeRecord.date,
  month: incomeRecord.month,
  category_id: incomeRecord.categoryId,
  amount: incomeRecord.amount,
  memo: incomeRecord.memo,
  created_at: incomeRecord.createdAt
});
```

Run:

```powershell
npm test -- src/storage/indexedDbBudgetRepository.test.ts src/storage/supabaseBudgetRepository.test.ts
```

Expected: FAIL because repository methods and Supabase mapping do not exist.

- [ ] **Step 2: Extend `BudgetRepository`**

Add:

```ts
addIncomeRecord(record: IncomeRecord): Promise<void>;
updateIncomeRecord(record: IncomeRecord): Promise<void>;
deleteIncomeRecord(id: string): Promise<void>;
```

- [ ] **Step 3: Implement localStorage and IndexedDB adapters**

Use the existing load-mutate-write pattern:

```ts
async addIncomeRecord(record: IncomeRecord): Promise<void> {
  const data = await this.load();
  data.incomeRecords.push(record);
  await this.write(data);
}
```

Implement update and delete with `map` and `filter`.

- [ ] **Step 4: Implement Supabase adapter**

Add `IncomeRecordRow`, row mapping helpers, and table operations:

```ts
client.from('income_records').insert(toIncomeRecordRow(record));
client.from('income_records').update({...}).eq('id', record.id);
client.from('income_records').delete().eq('id', id);
```

Update `load()` to select `income_records` and map rows into `BudgetData.incomeRecords`.

Update `replaceAll()` RPC payload to include `p_income_records`.

- [ ] **Step 5: Update Supabase schema**

Add `income_records` table, RLS policy, grant, index, `updated_at` trigger, and `replace_budget_data` support for `p_income_records`.

When `created_at` is missing, fallback to `(item.value ->> 'date')::timestamptz`.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
npm test -- src/storage/indexedDbBudgetRepository.test.ts src/storage/supabaseBudgetRepository.test.ts src/storage/exportImport.test.ts
npm run build
```

Expected: PASS.

Commit:

```powershell
git add src/storage/budgetRepository.ts src/storage/localStorageBudgetRepository.ts src/storage/indexedDbBudgetRepository.ts src/storage/indexedDbBudgetRepository.test.ts src/storage/supabaseBudgetRepository.ts src/storage/supabaseBudgetRepository.test.ts supabase/schema.sql
git commit -m "feat: persist income records"
```

---

### Task 3: Store Actions and Ledger Grouping

**Files:**
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/budgetStore.test.ts`
- Modify: `src/domain/calculations.ts`
- Modify: `src/domain/calculations.test.ts`

**Interfaces:**
- Produces: `addIncomeRecord(payload)`, `updateIncomeRecord(payload)`, `deleteIncomeRecord(id)`.
- Produces: `ledgerGroups` computed value grouped by date.

- [ ] **Step 1: Write failing store action tests**

Add tests:

```ts
test('adds an income record without changing base monthly income', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    months: { '2026-07': { month: '2026-07', income: 2800000 } }
  });
  const store = createBudgetStore(repository)();

  await store.initialize();
  store.setSelectedMonth('2026-07');
  await store.addIncomeRecord({
    date: '2026-07-18',
    categoryId: 'refund',
    amount: 100000,
    memo: '환급'
  });

  expect(store.data.months['2026-07'].income).toBe(2800000);
  expect(store.monthSummary.income).toBe(2900000);
  expect(store.data.incomeRecords[0]).toMatchObject({ categoryId: 'refund', amount: 100000 });
});
```

Add update/delete tests and validation tests for empty date, non-finite amount, and amount <= 0.

- [ ] **Step 2: Write failing ledger grouping tests**

Add:

```ts
test('groups income and expenses by date with signed daily totals', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    expenses: [
      { id: 'expense-1', date: '2026-07-16', month: '2026-07', categoryId: 'lunch', amount: 22000, memo: '점심', createdAt: '2026-07-16T01:00:00.000Z' }
    ],
    incomeRecords: [
      { id: 'income-1', date: '2026-07-16', month: '2026-07', categoryId: 'refund', amount: 100000, memo: '환급', createdAt: '2026-07-16T02:00:00.000Z' }
    ]
  });
  const store = createBudgetStore(repository)();

  await store.initialize();
  store.setSelectedMonth('2026-07');

  expect(store.ledgerGroups[0].date).toBe('2026-07-16');
  expect(store.ledgerGroups[0].total).toBe(78000);
  expect(store.ledgerGroups[0].entries.map((entry) => entry.kind)).toEqual(['income', 'expense']);
});
```

- [ ] **Step 3: Implement store actions**

Create and validate `IncomeRecord` entities with `id`, `createdAt`, `month: toMonth(date)`, trimmed memo, and positive finite amount. Persist first, then mutate Pinia state.

Implement update/delete through the new repository methods.

- [ ] **Step 4: Implement ledger groups**

Build screen-only entries from `data.value.expenses` and `data.value.incomeRecords`, filter by selected month, sort by `date DESC, createdAt DESC`, then group by date.

Each group shape:

```ts
interface LedgerGroup {
  date: string;
  total: number;
  entries: LedgerEntry[];
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
npm test -- src/stores/budgetStore.test.ts src/domain/calculations.test.ts
npm run build
```

Expected: PASS.

Commit:

```powershell
git add src/stores/budgetStore.ts src/stores/budgetStore.test.ts src/domain/calculations.ts src/domain/calculations.test.ts
git commit -m "feat: derive grouped ledger entries"
```

---

### Task 4: Ledger UI and Income Dialogs

**Files:**
- Modify: `src/components/LedgerTab.vue`
- Modify: `src/App.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: store `ledgerGroups`, income record actions, and existing expense actions.
- Produces: date-grouped transaction UI, income add/edit/delete dialogs, and carry-over as an income record.

- [ ] **Step 1: Write failing App tests**

Add tests for:

```ts
expect(wrapper.text()).toContain('거래 내역');
expect(wrapper.text()).toContain('+100,000원');
expect(wrapper.text()).toContain('-22,000원');
expect(wrapper.text()).toContain('16일');
```

Add a test that `수입 추가` creates a visible `+` row and does not modify the base income input value.

Add a test that `전월 이월` creates a `carryOver` income record dated selected month day 1.

Add tests for income edit and delete.

- [ ] **Step 2: Replace recent expense list UI**

Change `최근 지출` heading to `거래 내역`.

Render:

```vue
<section v-for="group in store.ledgerGroups" :key="group.date" class="ledger-day-group">
  <header class="ledger-day-header">
    <span>{{ formatLedgerDate(group.date) }}</span>
    <strong>{{ formatSignedWon(group.total) }}</strong>
  </header>
  <ul class="ledger-entry-list">...</ul>
</section>
```

Use `formatSignedWon`:

```ts
function formatSignedWon(amount: number): string {
  if (amount > 0) return `+${formatWon(amount)}`;
  if (amount < 0) return `-${formatWon(Math.abs(amount))}`;
  return formatWon(0);
}
```

- [ ] **Step 3: Update income add dialog**

Replace the old amount-only income add dialog with fields:

```text
날짜, 분류, 금액, 메모
```

Call `store.addIncomeRecord`.

- [ ] **Step 4: Update carry-over dialog**

On confirm, call:

```ts
store.addIncomeRecord({
  date: `${store.selectedMonth}-01`,
  categoryId: 'carryOver',
  amount: carryOverAmount.value,
  memo: `${previousMonth(store.selectedMonth)} 잔액 이월`
});
```

Do not call `store.addIncome`.

- [ ] **Step 5: Add income edit/delete UI**

For income entries, render edit/delete buttons and an income edit dialog with date/category/amount/memo. Call `store.updateIncomeRecord` and `store.deleteIncomeRecord`.

For expense entries, reuse existing expense edit/delete flow.

- [ ] **Step 6: Add responsive styles**

Add styles for:

```css
.ledger-day-group
.ledger-day-header
.ledger-entry-list
.ledger-entry
.ledger-entry-amount.income
.ledger-entry-amount.expense
.ledger-entry-actions
```

Mobile rules:

```css
@media (max-width: 560px) {
  .ledger-entry {
    grid-template-columns: 1fr;
  }
  .ledger-entry-side {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
npm test -- src/App.test.ts src/stores/budgetStore.test.ts
npm run build
```

Expected: PASS.

Commit:

```powershell
git add src/components/LedgerTab.vue src/App.test.ts src/styles.css
git commit -m "feat: show date-grouped ledger entries"
```

---

### Task 5: Full Verification and Mobile QA

**Files:**
- Modify only files needed to fix failures found during verification.

**Interfaces:**
- Produces: passing full tests/build and verified responsive layout.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start local dev server**

Run:

```powershell
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','Set-Location "C:\Users\banse\OneDrive\바탕 화면\time-manager"; npm run dev -- --host 127.0.0.1' -WindowStyle Hidden
```

Verify:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.

- [ ] **Step 4: Verify mobile layout**

At widths 360, 390, and 1280, verify:

```text
1. 날짜 헤더와 일 합계가 겹치지 않는다.
2. + 금액과 - 금액이 오른쪽 밖으로 나가지 않는다.
3. 긴 메모가 항목 내부에서 줄바꿈된다.
4. 수입/지출 수정/삭제 버튼이 모바일에서 항목을 가리지 않는다.
5. 수입 추가/수입 수정 팝업이 모바일에서 1열로 쌓인다.
```

- [ ] **Step 5: Inspect final scope**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only intended changes remain. No `node_modules/`, `dist/`, `.env.local`, or `.superpowers/` are staged.

- [ ] **Step 6: Commit verification fixes if any**

If fixes were needed:

```powershell
git add src supabase
git commit -m "test: verify ledger income records"
```

If no fixes were needed, skip this commit.

## Plan Self-Review

- Spec coverage: income records, Supabase schema, repository adapters, monthly summary, carry-over, income-add dialog, grouped ledger UI, edit/delete, and mobile verification each map to a task.
- Placeholder scan: no unresolved TBD/TODO markers remain.
- Type consistency: `IncomeRecord`, `IncomeCategoryId`, `incomeRecords`, `addIncomeRecord`, `updateIncomeRecord`, `deleteIncomeRecord`, and `ledgerGroups` are named consistently across tasks.
