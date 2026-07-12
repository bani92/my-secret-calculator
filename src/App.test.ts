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

    expect(incomeInput.element.value).toBe('');

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

    expect(wrapper.get('[aria-selected="true"]').text()).toBe('입력');
    expect(wrapper.get<HTMLInputElement>('[aria-label="지출 날짜"]').element.value).toBe('2026-07-12');
    expect(wrapper.text()).toContain('2026-07-12 날짜로 지출 입력을 준비했습니다.');
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
