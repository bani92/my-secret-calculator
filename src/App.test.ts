import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, reactive } from 'vue';

const mockedStores = vi.hoisted(() => ({
  authStore: undefined as any,
  budgetStore: undefined as any
}));

vi.mock('./stores/authStore', () => ({
  useAuthStore: () => mockedStores.authStore
}));

vi.mock('./stores/budgetStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('./stores/budgetStore')>();

  return {
    ...original,
    useBudgetStore: () => mockedStores.budgetStore
  };
});

import App from './App.vue';
import { createEmptyBudgetData } from './domain/calculations';
import type { BudgetData } from './domain/types';
import { createBudgetStore } from './stores/budgetStore';
import type { BudgetRepository } from './storage/budgetRepository';

let budgetData: BudgetData;
let budgetWritesShouldFail = false;

function cloneBudgetData(data: BudgetData): BudgetData {
  return JSON.parse(JSON.stringify(data)) as BudgetData;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createInMemoryRepository(): BudgetRepository {
  const ensureWritable = (): void => {
    if (budgetWritesShouldFail) {
      throw new Error('save failed');
    }
  };

  return {
    load: async () => cloneBudgetData(budgetData),
    setIncome: async (record) => {
      ensureWritable();
      budgetData.months[record.month] = record;
    },
    addExpense: async (expense) => {
      ensureWritable();
      budgetData.expenses.push(expense);
    },
    deleteExpense: async (id) => {
      ensureWritable();
      budgetData.expenses = budgetData.expenses.filter((expense) => expense.id !== id);
    },
    updateExpense: async (nextExpense) => {
      ensureWritable();
      budgetData.expenses = budgetData.expenses.map((expense) =>
        expense.id === nextExpense.id ? nextExpense : expense
      );
    },
    addIncomeRecord: async (record) => {
      ensureWritable();
      budgetData.incomeRecords.push(record);
    },
    updateIncomeRecord: async (nextRecord) => {
      ensureWritable();
      budgetData.incomeRecords = budgetData.incomeRecords.map((record) =>
        record.id === nextRecord.id ? nextRecord : record
      );
    },
    deleteIncomeRecord: async (id) => {
      ensureWritable();
      budgetData.incomeRecords = budgetData.incomeRecords.filter((record) => record.id !== id);
    },
    addPersonRecord: async (record) => {
      ensureWritable();
      budgetData.personRecords.push(record);
    },
    setPersonRecordSettled: async (id, settled) => {
      ensureWritable();
      const record = budgetData.personRecords.find((item) => item.id === id);

      if (record) {
        record.settled = settled;
      }
    },
    replaceAll: async (data) => {
      ensureWritable();
      budgetData = cloneBudgetData(data);
    }
  };
}

async function mountLoadedApp() {
  const wrapper = mount(App, { global: { plugins: [createPinia()] } });

  expect(wrapper.text()).toContain('로그인 상태를 확인하는 중입니다');
  await flushPromises();

  return wrapper;
}

async function flushAsyncActions(): Promise<void> {
  await flushPromises();
  await nextTick();
}

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    budgetData = createEmptyBudgetData();
    budgetWritesShouldFail = false;

    const useTestBudgetStore = createBudgetStore(createInMemoryRepository());
    const budgetStore = useTestBudgetStore();
    const initialize = budgetStore.initialize;
    const reset = budgetStore.reset;
    const togglePersonRecordSettled = budgetStore.togglePersonRecordSettled;

    budgetStore.initialize = vi.fn(initialize);
    budgetStore.reset = vi.fn(reset);
    budgetStore.togglePersonRecordSettled = vi.fn(async (id) => {
      await togglePersonRecordSettled(id);
      budgetStore.data = cloneBudgetData(budgetStore.data);
    });
    mockedStores.budgetStore = budgetStore;

    const authStore = reactive({
      session: { user: { id: 'owner-id' } },
      isInitialized: false,
      isLoading: false,
      errorMessage: '',
      initialize: vi.fn(async () => {
        authStore.isInitialized = true;
      }),
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined)
    });

    mockedStores.authStore = authStore;

    let idCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test('shows the login form when there is no authenticated session', async () => {
    mockedStores.authStore.session = null;
    mockedStores.authStore.isInitialized = true;

    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    expect(wrapper.text()).toContain('가계부 로그인');
    expect(wrapper.text()).not.toContain('월 수입');
  });

  test('sends login credentials to the auth store', async () => {
    mockedStores.authStore.session = null;
    mockedStores.authStore.isInitialized = true;
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.get('[aria-label="이메일"]').setValue('owner@example.com');
    await wrapper.get('[aria-label="비밀번호"]').setValue('password');
    await wrapper.get('form').trigger('submit');

    expect(mockedStores.authStore.login).toHaveBeenCalledWith('owner@example.com', 'password');
  });

  test('logs out and resets the budget store', async () => {
    const wrapper = await mountLoadedApp();
    mockedStores.budgetStore.reset.mockClear();

    await wrapper.get('[aria-label="로그아웃"]').trigger('click');

    expect(mockedStores.authStore.logout).toHaveBeenCalledOnce();
    expect(mockedStores.budgetStore.reset).toHaveBeenCalled();
  });

  test('initializes the budget store for an authenticated session', async () => {
    await mountLoadedApp();

    expect(mockedStores.budgetStore.initialize).toHaveBeenCalled();
  });

  test('removes the budget UI when the authenticated session is cleared', async () => {
    const wrapper = await mountLoadedApp();

    mockedStores.authStore.session = null;
    await nextTick();

    expect(wrapper.text()).toContain('가계부 로그인');
    expect(wrapper.text()).not.toContain('월 수입');
  });

  test('keeps the budget store reset when a previous session load resolves after logout', async () => {
    const delayedInitialize = createDeferred<void>();
    mockedStores.budgetStore.initialize = vi.fn(async () => {
      await delayedInitialize.promise;
      mockedStores.budgetStore.isLoaded = true;
    });
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await flushPromises();
    mockedStores.budgetStore.reset.mockClear();
    mockedStores.authStore.session = null;
    await nextTick();

    delayedInitialize.resolve();
    await flushPromises();
    await nextTick();

    expect(mockedStores.budgetStore.reset).toHaveBeenCalled();
    expect(mockedStores.budgetStore.isLoaded).toBe(false);
    expect(wrapper.text()).toContain('가계부 로그인');
  });

  test('reloads the current session when a previous session load resolves after switching users', async () => {
    const firstInitialize = createDeferred<void>();
    const secondInitialize = createDeferred<void>();
    const reloadCurrentInitialize = createDeferred<void>();
    const initializeCalls = [firstInitialize, secondInitialize, reloadCurrentInitialize];
    mockedStores.budgetStore.initialize = vi.fn(async () => {
      const nextInitialize = initializeCalls.shift();

      if (!nextInitialize) {
        return;
      }

      await nextInitialize.promise;
      mockedStores.budgetStore.isLoaded = true;
    });
    mount(App, { global: { plugins: [createPinia()] } });

    await flushPromises();
    mockedStores.authStore.session = { user: { id: 'next-owner-id' } };
    await nextTick();
    secondInitialize.resolve();
    await flushPromises();
    await nextTick();

    expect(mockedStores.budgetStore.isLoaded).toBe(true);

    firstInitialize.resolve();
    await flushPromises();
    await nextTick();

    expect(mockedStores.budgetStore.initialize).toHaveBeenCalledTimes(3);
    expect(mockedStores.budgetStore.isLoaded).toBe(false);

    reloadCurrentInitialize.resolve();
    await flushPromises();
    await nextTick();

    expect(mockedStores.budgetStore.isLoaded).toBe(true);
  });

  test('starts on the input tab and records income and expenses', async () => {
    const wrapper = await mountLoadedApp();

    expect(wrapper.get('[aria-selected="true"]').text()).toBe('입력');

    const incomeInput = wrapper.get<HTMLInputElement>('[aria-label="월 수입"]');
    await incomeInput.setValue('3000000');

    expect(incomeInput.element.value).toBe('3,000,000');

    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();

    expect(incomeInput.element.value).toBe('3,000,000');

    const expenseAmountInput = wrapper.get<HTMLInputElement>('[aria-label="지출 금액"]');
    await expenseAmountInput.setValue('12000');

    expect(expenseAmountInput.element.value).toBe('12,000');

    await wrapper.get('[aria-label="지출 메모"]').setValue('점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('3,000,000원');
    expect(wrapper.text()).toContain('12,000원');
    expect(wrapper.text()).toContain('점심');
  });

  test('edits a recent expense from the popup', async () => {
    budgetData.expenses.push({
      id: 'expense-id',
      date: '2026-07-10',
      month: '2026-07',
      categoryId: 'lunch',
      amount: 12_000,
      memo: '기존 메모',
      createdAt: '2026-07-10T00:00:00.000Z'
    });
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="edit-expense-expense-id"]').trigger('click');
    expect(wrapper.text()).toContain('지출 수정');
    await wrapper.get('[data-testid="edit-expense-date"]').setValue('2026-08-01');
    await wrapper.get('[data-testid="edit-expense-category"]').setValue('living');
    await wrapper.get('[data-testid="edit-expense-amount"]').setValue('15,000');
    await wrapper.get('[data-testid="edit-expense-memo"]').setValue('수정된 메모');
    await wrapper.get('[data-testid="confirm-edit-expense"]').trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('수정된 메모');
    expect(wrapper.text()).toContain('15,000원');
    expect(mockedStores.budgetStore.data.expenses).toEqual([
      expect.objectContaining({
        id: 'expense-id',
        date: '2026-08-01',
        month: '2026-08',
        categoryId: 'living',
        amount: 15_000,
        memo: '수정된 메모',
        createdAt: '2026-07-10T00:00:00.000Z'
      })
    ]);
  });

  test('shows an error when an edited expense amount is zero', async () => {
    budgetData.expenses.push({
      id: 'expense-id',
      date: '2026-07-10',
      month: '2026-07',
      categoryId: 'lunch',
      amount: 12_000,
      memo: '기존 메모'
    });
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="edit-expense-expense-id"]').trigger('click');
    await wrapper.get('[data-testid="edit-expense-amount"]').setValue('0');
    await wrapper.get('[data-testid="confirm-edit-expense"]').trigger('click');

    expect(wrapper.text()).toContain('지출 금액은 0원보다 커야 합니다.');
  });

  test('shows an error instead of saving an edited expense without a date', async () => {
    budgetData.expenses.push({
      id: 'expense-id',
      date: '2026-07-10',
      month: '2026-07',
      categoryId: 'lunch',
      amount: 12_000,
      memo: '기존 메모'
    });
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="edit-expense-expense-id"]').trigger('click');
    await wrapper.get('[data-testid="edit-expense-date"]').setValue('');
    await wrapper.get('[data-testid="confirm-edit-expense"]').trigger('click');

    expect(wrapper.text()).toContain('지출 날짜를 입력해주세요.');
    expect(mockedStores.budgetStore.data.expenses[0].date).toBe('2026-07-10');
  });

  test('keeps the formatted income input after saving', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="income-input"]').setValue('2,800,000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();

    expect((wrapper.get('[data-testid="income-input"]').element as HTMLInputElement).value).toBe('2,800,000');
  });

  test('shows grouped ledger entries with signed income and expense amounts', async () => {
    budgetData.expenses.push({
      id: 'expense-id',
      date: '2026-07-16',
      month: '2026-07',
      categoryId: 'lunch',
      amount: 22_000,
      memo: '점심',
      createdAt: '2026-07-16T01:00:00.000Z'
    });
    budgetData.incomeRecords.push({
      id: 'income-id',
      date: '2026-07-16',
      month: '2026-07',
      categoryId: 'refund',
      amount: 100_000,
      memo: '환급',
      createdAt: '2026-07-16T02:00:00.000Z'
    });
    const wrapper = await mountLoadedApp();

    expect(wrapper.text()).toContain('거래 내역');
    expect(wrapper.text()).toContain('+100,000원');
    expect(wrapper.text()).toContain('-22,000원');
    expect(wrapper.text()).toContain('16일');
    expect(wrapper.find('.ledger-entry-side .ledger-entry-amount').exists()).toBe(true);
    expect(wrapper.find('.ledger-entry-side .ledger-entry-actions').exists()).toBe(true);
  });

  test('adds itemized income from the income popup without changing the base income input', async () => {
    vi.setSystemTime(new Date('2026-07-18T09:00:00.000Z'));
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="income-input"]').setValue('2,800,000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();

    await wrapper.get('[data-testid="open-add-income"]').trigger('click');

    expect(wrapper.text()).toContain('수입 추가');
    expect((wrapper.get('[data-testid="add-income-date"]').element as HTMLInputElement).value).toBe('2026-07-18');

    await wrapper.get('[data-testid="add-income-date"]').setValue('2026-07-16');
    await wrapper.get('[data-testid="add-income-category"]').setValue('refund');
    await wrapper.get('[data-testid="add-income-amount"]').setValue('300,000');
    await wrapper.get('[data-testid="add-income-memo"]').setValue('환급');

    await wrapper.get('[data-testid="confirm-add-income"]').trigger('click');
    await flushAsyncActions();

    expect((wrapper.get('[data-testid="income-input"]').element as HTMLInputElement).value).toBe('2,800,000');
    expect(wrapper.text()).toContain('3,100,000원');
    expect(wrapper.text()).toContain('+300,000원');
    expect(wrapper.text()).toContain('환급');
    expect(mockedStores.budgetStore.data.months['2026-07'].income).toBe(2_800_000);
    expect(mockedStores.budgetStore.data.incomeRecords[0]).toMatchObject({
      date: '2026-07-16',
      month: '2026-07',
      categoryId: 'refund',
      amount: 300_000,
      memo: '환급'
    });
  });

  test('shows an empty message when there is no previous-month balance to carry over', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="open-carry-over"]').trigger('click');

    expect(wrapper.text()).toContain('이월한 남은 돈이 없습니다');
  });

  test('adds the previous month remaining amount as a carry-over income record', async () => {
    budgetData.months['2026-06'] = { month: '2026-06', income: 200000 };
    budgetData.expenses.push({
      id: 'previous-expense',
      date: '2026-06-10',
      month: '2026-06',
      categoryId: 'lunch',
      amount: 50000,
      memo: '지난달 점심',
      createdAt: '2026-06-10T00:00:00.000Z'
    });
    budgetData.months['2026-07'] = { month: '2026-07', income: 2800000 };
    const wrapper = await mountLoadedApp();

    await wrapper.get('[data-testid="open-carry-over"]').trigger('click');

    expect(wrapper.text()).toContain('전월 남은 돈');
    expect(wrapper.text()).toContain('150,000원');
    expect(wrapper.text()).toContain('현재 월 수입');
    expect(wrapper.text()).toContain('반영 후 월 수입');
    expect(wrapper.text()).toContain('2,950,000원');

    await wrapper.findAll('button').find((button) => button.text() === '이월하기')?.trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('2,950,000원');
    expect(wrapper.text()).toContain('2026-06 잔액 이월');
    expect(wrapper.text()).toContain('+150,000원');
    expect(mockedStores.budgetStore.data.months['2026-07'].income).toBe(2_800_000);
    expect(mockedStores.budgetStore.data.incomeRecords[0]).toMatchObject({
      date: '2026-07-01',
      month: '2026-07',
      categoryId: 'carryOver',
      amount: 150_000,
      memo: '2026-06 잔액 이월'
    });
  });

  test('edits and deletes an income record from the ledger', async () => {
    budgetData.incomeRecords.push({
      id: 'income-id',
      date: '2026-07-16',
      month: '2026-07',
      categoryId: 'refund',
      amount: 100_000,
      memo: '환급',
      createdAt: '2026-07-16T02:00:00.000Z'
    });
    const wrapper = await mountLoadedApp();

    expect((wrapper.get('[data-testid="income-input"]').element as HTMLInputElement).value).toBe('0');

    await wrapper.get('[data-testid="edit-income-income-id"]').trigger('click');
    expect(wrapper.text()).toContain('수입 수정');
    await wrapper.get('[data-testid="edit-income-date"]').setValue('2026-07-17');
    await wrapper.get('[data-testid="edit-income-category"]').setValue('side');
    await wrapper.get('[data-testid="edit-income-amount"]').setValue('120,000');
    await wrapper.get('[data-testid="edit-income-memo"]').setValue('부업');
    await wrapper.get('[data-testid="confirm-edit-income"]').trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('부업');
    expect(wrapper.text()).toContain('+120,000원');
    expect(mockedStores.budgetStore.data.incomeRecords[0]).toMatchObject({
      id: 'income-id',
      date: '2026-07-17',
      month: '2026-07',
      categoryId: 'side',
      amount: 120_000,
      memo: '부업'
    });

    await wrapper.get('[aria-label="수입 삭제"]').trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).not.toContain('부업');
    expect(mockedStores.budgetStore.data.incomeRecords).toEqual([]);
  });

  test('shows monthly totals on the dashboard tab', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.get('[aria-label="월 수입"]').setValue('100000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('외식');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();
    await wrapper.findAll('button').find((button) => button.text() === '대시보드')?.trigger('click');

    expect(wrapper.text()).toContain('이번 달 요약');
    expect(wrapper.text()).toContain('80,000원');
    expect(wrapper.text()).toContain('점심/외식');
  });

  test('selects a registered year and month from the dashboard', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.get('[aria-label="대상 월"]').setValue('2026-06');
    await wrapper.get('[aria-label="월 수입"]').setValue('100000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-10');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('6월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="대상 월"]').setValue('2025-04');
    await wrapper.get('[aria-label="월 수입"]').setValue('50000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2025-04-02');
    await wrapper.get('[aria-label="지출 금액"]').setValue('30000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('4월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.findAll('button').find((button) => button.text() === '대시보드')?.trigger('click');

    expect(wrapper.get('[data-testid="dashboard-year-list"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="dashboard-year-list"]').text()).toContain('2025');
    expect(wrapper.get('[data-testid="dashboard-month-list"]').text()).toContain('4월');
    expect(wrapper.text()).toContain('4월 지출');

    await wrapper.findAll('[data-testid="dashboard-year"]').find((button) => button.text() === '2026')?.trigger('click');

    expect(wrapper.get('[data-testid="dashboard-month-list"]').text()).toContain('6월');

    await wrapper.findAll('[data-testid="dashboard-month"]').find((button) => button.text().includes('6월'))?.trigger('click');

    expect(wrapper.text()).toContain('2026-06');
    expect(wrapper.text()).toContain('6월 지출');
    expect(wrapper.text()).not.toContain('4월 지출');
  });

  test('shows spending statistics by year and selected year months', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.findAll('button').find((button) => button.text() === '통계')?.trigger('click');

    expect(wrapper.text()).toContain('아직 지출 통계가 없습니다');

    await wrapper.findAll('button').find((button) => button.text() === '입력')?.trigger('click');
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-10');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('6월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-04-02');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('4월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2025-04-02');
    await wrapper.get('[aria-label="지출 금액"]').setValue('30000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('작년 4월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.findAll('button').find((button) => button.text() === '통계')?.trigger('click');

    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('40,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('지출월 평균');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('4월 외 1개월 · 20,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('6월');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('20,000원');

    await wrapper.findAll('[data-testid="stat-year"]').find((button) => button.text().includes('2025'))?.trigger('click');

    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('30,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('4월');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('30,000원');
  });

  test('filters spending statistics by expense category', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-10');
    await wrapper.get('[aria-label="지출 분류"]').setValue('lunch');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-12');
    await wrapper.get('[aria-label="지출 분류"]').setValue('transport');
    await wrapper.get('[aria-label="지출 금액"]').setValue('7000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('버스');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2025-04-02');
    await wrapper.get('[aria-label="지출 분류"]').setValue('lunch');
    await wrapper.get('[aria-label="지출 금액"]').setValue('30000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('작년 점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.findAll('button').find((button) => button.text() === '통계')?.trigger('click');

    const categoryFilter = wrapper.get<HTMLSelectElement>('[aria-label="지출 항목"]');

    expect(categoryFilter.element.value).toBe('all');
    expect(categoryFilter.text()).toContain('전체 지출');
    expect(categoryFilter.text()).toContain('점심/외식');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('27,000원');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2025');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('30,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('27,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('27,000원');

    await categoryFilter.setValue('lunch');

    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('20,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('총 지출');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('20,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('6월 · 20,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('6월');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('20,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).not.toContain('27,000원');

    await categoryFilter.setValue('health');

    expect(wrapper.text()).toContain('선택한 항목의 지출 기록이 없습니다.');
    expect(wrapper.find('[data-testid="yearly-expense-chart"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="statistics-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="monthly-expense-chart"]').exists()).toBe(false);
  });

  test('shows a calendar tab with daily expenses and prepares input for the clicked date', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-07-12');
    await wrapper.get('[aria-label="지출 분류"]').setValue('lunch');
    await wrapper.get('[aria-label="지출 금액"]').setValue('5000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('커피');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-07-12');
    await wrapper.get('[aria-label="지출 분류"]').setValue('dating');
    await wrapper.get('[aria-label="지출 금액"]').setValue('40000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('영화');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-07-12');
    await wrapper.get('[aria-label="지출 분류"]').setValue('gifts');
    await wrapper.get('[aria-label="지출 금액"]').setValue('10000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('축의금');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-07-12');
    await wrapper.get('[aria-label="지출 분류"]').setValue('living');
    await wrapper.get('[aria-label="지출 금액"]').setValue('8000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('편의점');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-07-12');
    await wrapper.findAll('button').find((button) => button.text() === '캘린더')?.trigger('click');

    expect(wrapper.get('[aria-label="캘린더 년도"]').text()).toContain('2026년');
    expect(wrapper.get('[aria-label="캘린더 월"]').text()).toContain('7월');

    const calendarCell = wrapper.get('[data-testid="calendar-date-2026-07-12"]');

    expect(calendarCell.classes()).toContain('weekend');
    expect(calendarCell.text()).toContain('점심/외식');
    expect(calendarCell.text()).toContain('5,000원');
    expect(calendarCell.text()).toContain('데이트/여가');
    expect(calendarCell.text()).toContain('선물/경조사');
    expect(calendarCell.text()).toContain('외 1건');
    expect(calendarCell.text()).not.toContain('커피');

    await calendarCell.trigger('click');

    const expenseDialog = wrapper.get('[data-testid="calendar-expense-dialog"]');

    expect(expenseDialog.attributes('role')).toBe('dialog');
    expect(expenseDialog.text()).toContain('2026-07-12');
    expect(expenseDialog.text()).toContain('5,000원');
    expect(expenseDialog.text()).toContain('40,000원');
    expect(expenseDialog.text()).toContain('10,000원');
    expect(expenseDialog.text()).toContain('8,000원');
    expect(wrapper.find('[data-testid="expense-form"]').exists()).toBe(false);

    await wrapper.get('[data-testid="calendar-expense-dialog-close"]').trigger('click');

    expect(wrapper.find('[data-testid="calendar-expense-dialog"]').exists()).toBe(false);

    await wrapper.get('[data-testid="calendar-date-2026-07-13"]').trigger('click');

    expect(wrapper.get('[aria-selected="true"]').text()).toBe('입력');
    expect(wrapper.get<HTMLInputElement>('[aria-label="지출 날짜"]').element.value).toBe('2026-07-13');
    expect(wrapper.text()).toContain('2026-07-13 날짜로 지출 입력을 준비했습니다.');
  });

  test('records person money and keeps settled records in history', async () => {
    const wrapper = await mountLoadedApp();

    await wrapper.findAll('button').find((button) => button.text() === '사람')?.trigger('click');
    await wrapper.get('[aria-label="사람 이름"]').setValue('민수');
    const personAmountInput = wrapper.get<HTMLInputElement>('[aria-label="사람별 금액"]');
    await personAmountInput.setValue('50000');

    expect(personAmountInput.element.value).toBe('50,000');

    await wrapper.get('[aria-label="사람별 메모"]').setValue('티켓');
    await wrapper.get('[data-testid="person-form"]').trigger('submit');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('받을 돈 50,000원');

    await wrapper.get('[data-testid="toggle-settled"]').trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('정산 취소');
    expect(wrapper.text()).toContain('티켓');
    expect(wrapper.text()).toContain('현재 미정산 내역이 없습니다');
  });

  test('uses the revised input headings', async () => {
    const wrapper = await mountLoadedApp();

    const headings = wrapper.findAll('h2').map((heading) => heading.text());

    expect(headings).toContain('월 수입');
    expect(headings).toContain('일일 지출');
    expect(headings).not.toContain('빠른 기록');
    expect(wrapper.find('.form-panel .section-heading span').exists()).toBe(false);
  });

  test('hides backup status messages after three seconds', async () => {
    vi.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:local-budget')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const wrapper = await mountLoadedApp();

    await wrapper.findAll('button').find((button) => button.text() === '내보내기')?.trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('백업 파일을 내보냈습니다.');

    vi.advanceTimersByTime(3_000);
    await nextTick();

    expect(wrapper.text()).not.toContain('백업 파일을 내보냈습니다.');
  });

  test('does not expose backup actions before data is loaded', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    expect(wrapper.text()).toContain('로그인 상태를 확인하는 중입니다');
    expect(wrapper.findAll('button').some((button) => button.text() === '내보내기')).toBe(false);
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);

    await flushPromises();

    expect(wrapper.findAll('button').some((button) => button.text() === '내보내기')).toBe(true);
    expect(wrapper.find('input[type="file"]').exists()).toBe(true);
  });

  test('shows a generic message when a budget action cannot be saved', async () => {
    const wrapper = await mountLoadedApp();
    budgetWritesShouldFail = true;

    await wrapper.get('[aria-label="월 수입"]').setValue('100000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('변경사항을 저장하지 못했습니다.');
  });

  test('shows a persistence failure message when import cannot be saved', async () => {
    const wrapper = await mountLoadedApp();
    const currentMonth = mockedStores.budgetStore.selectedMonth;
    await wrapper.get('[aria-label="월 수입"]').setValue('100000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await wrapper.get('[aria-label="지출 금액"]').setValue('10000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('existing lunch');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await flushAsyncActions();

    const validBackup = JSON.stringify({
      version: 1,
      months: {
        [currentMonth]: { month: currentMonth, income: 500_000 }
      },
      expenses: [
        {
          id: 'imported-expense',
          date: `${currentMonth}-11`,
          month: currentMonth,
          categoryId: 'transport',
          amount: 20_000,
          memo: 'imported bus'
        }
      ],
      personRecords: []
    });
    const file = new File([validBackup], 'backup.json', { type: 'application/json' });
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');

    budgetWritesShouldFail = true;
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file]
    });

    await input.trigger('change');
    await flushAsyncActions();

    expect(wrapper.text()).toContain('100,000');
    expect(wrapper.text()).toContain('existing lunch');
    expect(wrapper.text()).not.toContain('500,000');
    expect(wrapper.text()).not.toContain('imported bus');

    expect(wrapper.text()).toContain('백업 파일을 저장하지 못했습니다.');
    expect(wrapper.text()).not.toContain('지원하지 않는 백업 파일입니다.');
  });
});
