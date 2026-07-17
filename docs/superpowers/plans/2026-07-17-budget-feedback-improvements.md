# Budget Feedback Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the budget ledger UX by sorting recent expenses by creation time, adding popup-based carry-over and income-add flows, preserving the income input after save, and supporting popup-based expense editing with mobile-safe layout.

**Architecture:** Keep the current Vue 3 + Pinia structure and extend the existing budget store/repository contract with `createdAt`, `updateExpense`, and income-add helpers. `LedgerTab.vue` owns the popup UI states while `budgetStore` owns persistence-safe mutations and computed monthly summaries. The CSS changes stay responsive-first so mobile widths stack controls instead of squeezing them.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, Supabase repository adapter, existing localStorage/IndexedDB adapters

## Global Constraints

- Documentation and user-facing explanations are Korean by default.
- Preserve unrelated working-tree changes.
- Do not commit `node_modules/`, `dist/`, or `.env.local`.
- Use TDD where practical: add failing tests before implementation.
- `저장` overwrites the current month income.
- `전월 이월` and `수입 추가` add to the current month income after popup confirmation.
- Show `이월한 남은 돈이 없습니다` when the previous month remaining amount is 0 or less.
- Recent expenses sort by `createdAt` descending, with `date` fallback for older data.
- Expense edit popup can change date, category, amount, and memo; changing date recalculates `month`.
- Mobile verification must cover at least 360px, 390px, and 1280px widths.

---

### Task 1: Expense `createdAt` Model and Sorting

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/storage/exportImport.ts`
- Modify: `src/storage/exportImport.test.ts`
- Modify: `src/storage/supabaseBudgetRepository.ts`
- Modify: `src/storage/supabaseBudgetRepository.test.ts`
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/budgetStore.test.ts`

**Interfaces:**
- Consumes: existing `Expense` records and Supabase `expenses.created_at`.
- Produces: `Expense.createdAt?: string` in the domain model and `monthExpenses` sorted by creation time.

- [ ] **Step 1: Write failing store sorting tests**

Add tests to `src/stores/budgetStore.test.ts` that create three expenses in the same selected month with out-of-order dates and `createdAt` values.

```ts
test('sorts selected month expenses by createdAt descending', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    expenses: [
      {
        id: 'older-created',
        date: '2026-07-17',
        month: '2026-07',
        categoryId: 'lunch',
        amount: 9000,
        memo: '늦은 날짜',
        createdAt: '2026-07-01T10:00:00.000Z'
      },
      {
        id: 'newer-created',
        date: '2026-07-01',
        month: '2026-07',
        categoryId: 'living',
        amount: 12000,
        memo: '최근 등록',
        createdAt: '2026-07-17T10:00:00.000Z'
      }
    ],
    months: {},
    personRecords: []
  });
  const store = createBudgetStore(repository)();

  await store.initialize();
  store.setSelectedMonth('2026-07');

  expect(store.monthExpenses.map((expense) => expense.id)).toEqual(['newer-created', 'older-created']);
});

test('falls back to date sorting when createdAt is missing', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    expenses: [
      {
        id: 'first',
        date: '2026-07-01',
        month: '2026-07',
        categoryId: 'lunch',
        amount: 9000,
        memo: ''
      },
      {
        id: 'second',
        date: '2026-07-02',
        month: '2026-07',
        categoryId: 'living',
        amount: 12000,
        memo: ''
      }
    ],
    months: {},
    personRecords: []
  });
  const store = createBudgetStore(repository)();

  await store.initialize();
  store.setSelectedMonth('2026-07');

  expect(store.monthExpenses.map((expense) => expense.id)).toEqual(['second', 'first']);
});
```

- [ ] **Step 2: Run the new sorting tests and verify RED**

Run:

```powershell
npm test -- src/stores/budgetStore.test.ts
```

Expected: the `createdAt` sorting test fails because `monthExpenses` currently sorts by `date`.

- [ ] **Step 3: Add the domain property and sorting helper**

In `src/domain/types.ts`, extend `Expense`:

```ts
export interface Expense {
  id: string;
  date: string;
  month: string;
  categoryId: CategoryId;
  amount: number;
  memo: string;
  createdAt?: string;
}
```

In `src/stores/budgetStore.ts`, add a local sort key helper near the computed values:

```ts
const expenseSortKey = (expense: Expense): string => expense.createdAt ?? `${expense.date}T00:00:00.000Z`;
```

Then update `monthExpenses`:

```ts
const monthExpenses = computed(() =>
  data.value.expenses
    .filter((expense) => expense.month === selectedMonth.value)
    .sort((left, right) => expenseSortKey(right).localeCompare(expenseSortKey(left)))
);
```

- [ ] **Step 4: Preserve `createdAt` in Supabase mapping**

In `src/storage/supabaseBudgetRepository.ts`, add `created_at` to `ExpenseRow`:

```ts
interface ExpenseRow {
  id: string;
  date: string;
  month: string;
  category_id: CategoryId;
  amount: number;
  memo: string;
  created_at?: string;
}
```

Map it on load:

```ts
expenses: expenseRows.map((row) => ({
  id: row.id,
  date: row.date,
  month: row.month,
  categoryId: row.category_id,
  amount: row.amount,
  memo: row.memo,
  createdAt: row.created_at
}))
```

Keep `insert` payload unchanged if the current schema defaults `created_at`; if tests expect explicit preservation for imports, include `created_at: expense.createdAt` only when `expense.createdAt` is defined.

- [ ] **Step 5: Add export/import compatibility tests**

In `src/storage/exportImport.test.ts`, add one test that verifies JSON with `createdAt` round-trips:

```ts
test('preserves expense createdAt during export and import', () => {
  const data = createEmptyBudgetData();
  data.expenses.push({
    id: 'expense-id',
    date: '2026-07-17',
    month: '2026-07',
    categoryId: 'lunch',
    amount: 9000,
    memo: '점심',
    createdAt: '2026-07-17T01:02:03.000Z'
  });

  expect(parseBudgetJson(stringifyBudgetData(data)).expenses[0].createdAt).toBe('2026-07-17T01:02:03.000Z');
});
```

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
npm test -- src/stores/budgetStore.test.ts src/storage/exportImport.test.ts src/storage/supabaseBudgetRepository.test.ts
```

Expected: all focused tests PASS.

Commit:

```powershell
git add src/domain/types.ts src/storage/exportImport.ts src/storage/exportImport.test.ts src/storage/supabaseBudgetRepository.ts src/storage/supabaseBudgetRepository.test.ts src/stores/budgetStore.ts src/stores/budgetStore.test.ts
git commit -m "feat: sort recent expenses by creation time"
```

---

### Task 2: Store Income Addition and Expense Update Actions

**Files:**
- Modify: `src/storage/budgetRepository.ts`
- Modify: `src/storage/localStorageBudgetRepository.ts`
- Modify: `src/storage/indexedDbBudgetRepository.ts`
- Modify: `src/storage/indexedDbBudgetRepository.test.ts`
- Modify: `src/storage/supabaseBudgetRepository.ts`
- Modify: `src/storage/supabaseBudgetRepository.test.ts`
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/budgetStore.test.ts`

**Interfaces:**
- Consumes: `setIncome(record)` and `Expense`.
- Produces: `addIncome(amount: number): Promise<void>`, `getMonthSummary(month: string)`, and `updateExpense(payload): Promise<void>`.

- [ ] **Step 1: Add failing store tests for income addition**

In `src/stores/budgetStore.test.ts`, add:

```ts
test('adds an amount to the current month income', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    months: { '2026-07': { month: '2026-07', income: 2800000 } }
  });
  const store = createBudgetStore(repository)();

  await store.initialize();
  store.setSelectedMonth('2026-07');
  await store.addIncome(300000);

  expect(store.monthSummary.income).toBe(3100000);
  expect(repository.setIncomeRecords.at(-1)).toEqual({ month: '2026-07', income: 3100000 });
});

test('rejects non-positive income additions without saving', async () => {
  const repository = new MemoryBudgetRepository(createEmptyBudgetData());
  const store = createBudgetStore(repository)();

  await store.initialize();
  await expect(store.addIncome(0)).rejects.toThrow('추가 금액은 0원보다 커야 합니다.');

  expect(repository.setIncomeRecords).toEqual([]);
});
```

- [ ] **Step 2: Add failing store tests for previous month summary**

Add:

```ts
test('returns a summary for an arbitrary month', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    months: {
      '2026-06': { month: '2026-06', income: 100000 }
    },
    expenses: [
      {
        id: 'expense-id',
        date: '2026-06-05',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 40000,
        memo: '',
        createdAt: '2026-06-05T00:00:00.000Z'
      }
    ]
  });
  const store = createBudgetStore(repository)();

  await store.initialize();

  expect(store.getMonthSummary('2026-06').remaining).toBe(60000);
});
```

- [ ] **Step 3: Add failing repository and store tests for expense update**

Update `src/storage/budgetRepository.ts` expectation in tests to include:

```ts
updateExpense(expense: Expense): Promise<void>;
```

Add a store test:

```ts
test('updates an expense and recalculates its month from date', async () => {
  const repository = new MemoryBudgetRepository({
    ...createEmptyBudgetData(),
    expenses: [
      {
        id: 'expense-id',
        date: '2026-07-17',
        month: '2026-07',
        categoryId: 'lunch',
        amount: 9000,
        memo: '점심',
        createdAt: '2026-07-17T10:00:00.000Z'
      }
    ]
  });
  const store = createBudgetStore(repository)();

  await store.initialize();
  await store.updateExpense({
    id: 'expense-id',
    date: '2026-08-01',
    categoryId: 'living',
    amount: 15000,
    memo: '수정'
  });

  expect(store.data.expenses[0]).toMatchObject({
    id: 'expense-id',
    date: '2026-08-01',
    month: '2026-08',
    categoryId: 'living',
    amount: 15000,
    memo: '수정',
    createdAt: '2026-07-17T10:00:00.000Z'
  });
});
```

- [ ] **Step 4: Run store tests and verify RED**

Run:

```powershell
npm test -- src/stores/budgetStore.test.ts
```

Expected: FAIL because `addIncome`, `getMonthSummary`, and `updateExpense` do not exist.

- [ ] **Step 5: Implement store actions**

In `src/stores/budgetStore.ts`, import `Expense` and add:

```ts
const getMonthSummary = (month: string) => calculateMonthSummary(month, data.value.months, data.value.expenses);

const addIncome = async (amount: number): Promise<void> => {
  await ensureInitialized();

  if (amount <= 0) {
    throw new Error('추가 금액은 0원보다 커야 합니다.');
  }

  await setIncome(monthSummary.value.income + amount);
};

const updateExpense = async (payload: {
  id: string;
  date: string;
  categoryId: CategoryId;
  amount: number;
  memo: string;
}): Promise<void> => {
  await ensureInitialized();

  if (payload.amount <= 0) {
    throw new Error('지출 금액은 0원보다 커야 합니다.');
  }

  const existing = data.value.expenses.find((expense) => expense.id === payload.id);

  if (!existing) {
    return;
  }

  const nextExpense: Expense = {
    ...existing,
    date: payload.date,
    month: toMonth(payload.date),
    categoryId: payload.categoryId,
    amount: payload.amount,
    memo: payload.memo.trim()
  };

  await repository.updateExpense(nextExpense);
  data.value.expenses = data.value.expenses.map((expense) => (expense.id === nextExpense.id ? nextExpense : expense));
};
```

Return `getMonthSummary`, `addIncome`, and `updateExpense`.

- [ ] **Step 6: Implement repository adapters**

In `src/storage/budgetRepository.ts`, add:

```ts
updateExpense(expense: Expense): Promise<void>;
```

In localStorage and IndexedDB repositories, implement load-mutate-write:

```ts
async updateExpense(nextExpense: Expense): Promise<void> {
  const data = await this.load();

  data.expenses = data.expenses.map((expense) => (expense.id === nextExpense.id ? nextExpense : expense));
  await this.write(data);
}
```

In Supabase repository:

```ts
async updateExpense(expense: Expense): Promise<void> {
  const response = await this.client()
    .from('expenses')
    .update({
      date: expense.date,
      month: expense.month,
      category_id: expense.categoryId,
      amount: expense.amount,
      memo: expense.memo
    })
    .eq('id', expense.id);

  ensureSuccess(response);
}
```

- [ ] **Step 7: Run focused tests and commit**

Run:

```powershell
npm test -- src/stores/budgetStore.test.ts src/storage/indexedDbBudgetRepository.test.ts src/storage/supabaseBudgetRepository.test.ts
```

Expected: all focused tests PASS.

Commit:

```powershell
git add src/storage/budgetRepository.ts src/storage/localStorageBudgetRepository.ts src/storage/indexedDbBudgetRepository.ts src/storage/indexedDbBudgetRepository.test.ts src/storage/supabaseBudgetRepository.ts src/storage/supabaseBudgetRepository.test.ts src/stores/budgetStore.ts src/stores/budgetStore.test.ts
git commit -m "feat: add income and expense update actions"
```

---

### Task 3: Ledger Income Popups and Input Preservation

**Files:**
- Modify: `src/components/LedgerTab.vue`
- Modify: `src/App.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `store.addIncome(amount)`, `store.getMonthSummary(month)`, `store.setIncome(income)`, and current `selectedMonth`.
- Produces: popup-based `전월 이월` and `수입 추가` UI, plus income input preservation after save.

- [ ] **Step 1: Add failing component behavior tests**

In `src/App.test.ts`, extend existing ledger tests or add a helper that mounts the authenticated app and switches to the ledger tab. Add assertions:

```ts
await wrapper.get('[data-testid="income-input"]').setValue('2,800,000');
await wrapper.get('[data-testid="save-income"]').trigger('click');
expect((wrapper.get('[data-testid="income-input"]').element as HTMLInputElement).value).toBe('2,800,000');
```

Add income-add popup test:

```ts
await wrapper.get('[data-testid="open-add-income"]').trigger('click');
expect(wrapper.text()).toContain('수입 추가');
await wrapper.get('[data-testid="add-income-amount"]').setValue('300,000');
expect(wrapper.text()).toContain('반영 후 월 수입');
await wrapper.get('[data-testid="confirm-add-income"]').trigger('click');
expect(wrapper.text()).toContain('3,100,000원');
```

Add carry-over empty-state test:

```ts
await wrapper.get('[data-testid="open-carry-over"]').trigger('click');
expect(wrapper.text()).toContain('이월한 남은 돈이 없습니다');
```

- [ ] **Step 2: Run App tests and verify RED**

Run:

```powershell
npm test -- src/App.test.ts
```

Expected: FAIL because the buttons, popups, and stable income input do not exist.

- [ ] **Step 3: Add popup state and previous month helper**

In `LedgerTab.vue`, add refs:

```ts
const addIncomeDialogOpen = ref(false);
const carryOverDialogOpen = ref(false);
const incomeAdditionDraft = ref('');
const incomeDialogError = ref('');
const carryOverMessage = ref('');
```

Add helpers:

```ts
function previousMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() - 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const previousMonthSummary = computed(() => store.getMonthSummary(previousMonth(store.selectedMonth)));
const carryOverAmount = computed(() => previousMonthSummary.value.remaining);
```

- [ ] **Step 4: Preserve income input after save**

Change `saveIncome()` from clearing the draft to formatting the saved income:

```ts
async function saveIncome(): Promise<void> {
  const nextIncome = parseMoneyInput(incomeDraft.value);

  await store.setIncome(nextIncome);
  incomeDraft.value = formatMoneyInput(String(nextIncome));
}
```

- [ ] **Step 5: Implement popup actions**

Add:

```ts
function openCarryOverDialog(): void {
  carryOverMessage.value = '';

  if (carryOverAmount.value <= 0) {
    carryOverMessage.value = '이월한 남은 돈이 없습니다';
    return;
  }

  carryOverDialogOpen.value = true;
}

async function confirmCarryOver(): Promise<void> {
  await store.addIncome(carryOverAmount.value);
  incomeDraft.value = formatMoneyInput(String(store.monthSummary.income));
  carryOverDialogOpen.value = false;
}

function openAddIncomeDialog(): void {
  incomeAdditionDraft.value = '';
  incomeDialogError.value = '';
  addIncomeDialogOpen.value = true;
}

async function confirmAddIncome(): Promise<void> {
  const amount = parseMoneyInput(incomeAdditionDraft.value);

  if (amount <= 0) {
    incomeDialogError.value = '추가 금액은 0원보다 커야 합니다.';
    return;
  }

  await store.addIncome(amount);
  incomeDraft.value = formatMoneyInput(String(store.monthSummary.income));
  addIncomeDialogOpen.value = false;
}
```

- [ ] **Step 6: Add markup**

Use buttons next to the 월 수입 heading:

```vue
<div class="section-heading income-heading">
  <h2>월 수입</h2>
  <div class="income-heading-actions">
    <button type="button" class="secondary-button" data-testid="open-carry-over" @click="openCarryOverDialog">
      전월 이월
    </button>
    <button type="button" class="secondary-button" data-testid="open-add-income" @click="openAddIncomeDialog">
      수입 추가
    </button>
  </div>
</div>
```

Add `data-testid="income-input"` to the income input. Render simple accessible modal panels when each dialog ref is true, with `role="dialog"` and a close/cancel button. Render `carryOverMessage` with `role="status"`.

- [ ] **Step 7: Add responsive styles**

In `src/styles.css`, add mobile-safe styles:

```css
.income-heading {
  align-items: flex-start;
  gap: 0.75rem;
}

.income-heading-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 45%);
  z-index: 20;
}

.dialog-panel {
  width: min(100%, 420px);
  max-height: calc(100vh - 2rem);
  overflow: auto;
}

@media (max-width: 560px) {
  .income-heading-actions {
    justify-content: flex-start;
  }
}
```

Adjust class names to match the existing style scale.

- [ ] **Step 8: Run tests and commit**

Run:

```powershell
npm test -- src/App.test.ts
```

Expected: App tests PASS.

Commit:

```powershell
git add src/components/LedgerTab.vue src/App.test.ts src/styles.css
git commit -m "feat: add income adjustment popups"
```

---

### Task 4: Expense Edit Popup

**Files:**
- Modify: `src/components/LedgerTab.vue`
- Modify: `src/App.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `store.updateExpense(payload)`, `categories`, `formatMoneyInput`, and `parseMoneyInput`.
- Produces: recent expense edit popup for date, category, amount, and memo.

- [ ] **Step 1: Add failing edit popup tests**

In `src/App.test.ts`, add:

```ts
await wrapper.get('[data-testid="edit-expense-expense-id"]').trigger('click');
expect(wrapper.text()).toContain('지출 수정');
await wrapper.get('[data-testid="edit-expense-date"]').setValue('2026-08-01');
await wrapper.get('[data-testid="edit-expense-category"]').setValue('living');
await wrapper.get('[data-testid="edit-expense-amount"]').setValue('15,000');
await wrapper.get('[data-testid="edit-expense-memo"]').setValue('수정된 메모');
await wrapper.get('[data-testid="confirm-edit-expense"]').trigger('click');
expect(wrapper.text()).toContain('수정된 메모');
expect(wrapper.text()).toContain('15,000원');
```

Add invalid amount behavior:

```ts
await wrapper.get('[data-testid="edit-expense-amount"]').setValue('0');
await wrapper.get('[data-testid="confirm-edit-expense"]').trigger('click');
expect(wrapper.text()).toContain('지출 금액은 0원보다 커야 합니다.');
```

- [ ] **Step 2: Run App tests and verify RED**

Run:

```powershell
npm test -- src/App.test.ts
```

Expected: FAIL because edit buttons and popup fields do not exist.

- [ ] **Step 3: Add edit dialog state**

In `LedgerTab.vue`, add:

```ts
const editingExpenseId = ref<string | null>(null);
const expenseEditError = ref('');
const expenseEditAmountDraft = ref('');
const expenseEditForm = reactive({
  date: today,
  categoryId: 'lunch' as CategoryId,
  memo: ''
});
```

Add:

```ts
function openExpenseEdit(expense: Expense): void {
  editingExpenseId.value = expense.id;
  expenseEditError.value = '';
  expenseEditForm.date = expense.date;
  expenseEditForm.categoryId = expense.categoryId;
  expenseEditForm.memo = expense.memo;
  expenseEditAmountDraft.value = formatMoneyInput(String(expense.amount));
}

function closeExpenseEdit(): void {
  editingExpenseId.value = null;
  expenseEditError.value = '';
}
```

- [ ] **Step 4: Add confirm edit action**

Add:

```ts
async function confirmExpenseEdit(): Promise<void> {
  if (!editingExpenseId.value) {
    return;
  }

  const amount = parseMoneyInput(expenseEditAmountDraft.value);

  if (amount <= 0) {
    expenseEditError.value = '지출 금액은 0원보다 커야 합니다.';
    return;
  }

  await store.updateExpense({
    id: editingExpenseId.value,
    date: expenseEditForm.date,
    categoryId: expenseEditForm.categoryId,
    amount,
    memo: expenseEditForm.memo
  });
  closeExpenseEdit();
}
```

- [ ] **Step 5: Add edit buttons and modal markup**

In each recent expense action group, add:

```vue
<button
  type="button"
  class="icon-button"
  :data-testid="`edit-expense-${expense.id}`"
  @click="openExpenseEdit(expense)"
>
  수정
</button>
```

Render a `role="dialog"` panel with:

```vue
<input v-model="expenseEditForm.date" data-testid="edit-expense-date" type="date" required />
<select v-model="expenseEditForm.categoryId" data-testid="edit-expense-category">
  <option v-for="category in categories" :key="category.id" :value="category.id">
    {{ category.label }}
  </option>
</select>
<input
  :value="expenseEditAmountDraft"
  data-testid="edit-expense-amount"
  type="text"
  inputmode="numeric"
  @input="expenseEditAmountDraft = formatMoneyInput(($event.target as HTMLInputElement).value)"
/>
<input v-model="expenseEditForm.memo" data-testid="edit-expense-memo" type="text" />
```

Use `data-testid="confirm-edit-expense"` on the save button.

- [ ] **Step 6: Reuse responsive modal styles**

If Task 3 introduced generic `.dialog-backdrop` and `.dialog-panel`, reuse them. Add only the grid needed for edit fields:

```css
.dialog-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.dialog-form-grid .wide {
  grid-column: 1 / -1;
}

@media (max-width: 560px) {
  .dialog-form-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
npm test -- src/App.test.ts src/stores/budgetStore.test.ts
```

Expected: focused app and store tests PASS.

Commit:

```powershell
git add src/components/LedgerTab.vue src/App.test.ts src/styles.css
git commit -m "feat: edit recent expenses"
```

---

### Task 5: Mobile Visual Verification and Full Regression

**Files:**
- Modify only files needed to fix visual or test failures caused by Tasks 1-4.

**Interfaces:**
- Consumes: completed UI and store behavior.
- Produces: passing tests/build and verified mobile-safe layout.

- [ ] **Step 1: Run the full unit suite**

Run:

```powershell
npm test
```

Expected: every Vitest test PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build PASS.

- [ ] **Step 3: Start local dev server**

Run in the project root:

```powershell
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','Set-Location "C:\Users\banse\OneDrive\바탕 화면\time-manager"; npm run dev -- --host 127.0.0.1' -WindowStyle Hidden
```

Then verify:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.

- [ ] **Step 4: Verify desktop behavior**

At `http://127.0.0.1:5173/`, verify:

```text
1. 월 수입 저장 후 input이 비워지지 않는다.
2. 전월 이월 버튼은 남은 돈이 없을 때 "이월한 남은 돈이 없습니다"를 보여준다.
3. 전월 이월 팝업은 남은 돈, 현재 월 수입, 반영 후 월 수입을 보여준다.
4. 수입 추가 팝업은 추가 금액 입력과 반영 후 월 수입을 보여준다.
5. 최근 지출은 createdAt 최신순이다.
6. 최근 지출 수정 팝업에서 날짜, 분류, 금액, 메모를 수정할 수 있다.
```

- [ ] **Step 5: Verify mobile widths**

Use browser responsive mode or Playwright screenshots at widths 360, 390, and 1280. For each width, verify:

```text
1. 전월 이월, 수입 추가, 저장 버튼이 겹치지 않는다.
2. 월 수입 input 값이 긴 금액이어도 잘리지 않는다.
3. 전월 이월 팝업이 화면 좌우를 넘지 않는다.
4. 수입 추가 팝업 입력과 버튼이 한 화면 폭 안에 들어온다.
5. 지출 수정 팝업 필드가 모바일에서 1열로 쌓인다.
6. 최근 지출 메모가 길어도 금액과 수정/삭제 버튼이 깨지지 않는다.
```

- [ ] **Step 6: Inspect final scope**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only intended source, test, style, and docs changes remain. No `node_modules/`, `dist/`, or `.env.local` changes are staged.

- [ ] **Step 7: Commit verification fixes if needed**

If Step 1-6 required fixes, commit them:

```powershell
git add src/domain/types.ts src/storage src/stores src/components src/App.test.ts src/styles.css
git commit -m "test: verify budget feedback improvements"
```

If no fixes were needed, skip this commit.

## Plan Self-Review

- Spec coverage: createdAt sorting, income input preservation, carry-over popup, income-add popup, expense edit popup, repository updates, error states, and mobile verification each map to a task.
- Placeholder scan: no TBD, TODO, or unspecified implementation steps remain.
- Type consistency: `createdAt`, `addIncome`, `getMonthSummary`, `updateExpense`, and repository method names are consistent across tasks.
