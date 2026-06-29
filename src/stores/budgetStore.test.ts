import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { createBudgetStore, useBudgetStore } from './budgetStore';

class MemoryBudgetRepository implements BudgetRepository {
  savedData: BudgetData | undefined;

  constructor(private data: BudgetData = createEmptyBudgetData()) {}

  async load(): Promise<BudgetData> {
    return this.data;
  }

  async save(data: BudgetData): Promise<void> {
    this.savedData = structuredClone(data);
    this.data = structuredClone(data);
  }
}

function createBudgetStoreForTest(repository = new MemoryBudgetRepository()) {
  setActivePinia(createPinia());
  const useTestBudgetStore = createBudgetStore(repository);

  return {
    repository,
    store: useTestBudgetStore()
  };
}

describe('useBudgetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    let idCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initializes from the configured repository', async () => {
    const existingData: BudgetData = {
      version: 1,
      months: {
        '2026-06': { month: '2026-06', income: 1_000_000 }
      },
      expenses: [],
      personRecords: []
    };
    const { store } = createBudgetStoreForTest(new MemoryBudgetRepository(existingData));

    expect(store.isLoaded).toBe(false);

    await store.initialize();

    expect(store.isLoaded).toBe(true);
    expect(store.data.months['2026-06'].income).toBe(1_000_000);
  });

  test('sets income for the selected month and persists it', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');
    await store.setIncome(3_000_000);

    expect(store.monthSummary.income).toBe(3_000_000);
    expect(store.data.months['2026-06']).toEqual({ month: '2026-06', income: 3_000_000 });
    expect(repository.savedData?.months['2026-06'].income).toBe(3_000_000);
  });

  test('adds, lists, summarizes, and deletes expenses for the selected month', async () => {
    const { store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');
    await store.setIncome(500_000);
    await store.addExpense({
      date: '2026-06-27',
      categoryId: 'lunch',
      amount: 12_000,
      memo: ' lunch '
    });
    await store.addExpense({
      date: '2026-07-01',
      categoryId: 'transport',
      amount: 4_000,
      memo: 'bus'
    });

    expect(store.monthExpenses).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        date: '2026-06-27',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 12_000,
        memo: 'lunch'
      }
    ]);
    expect(store.monthSummary.expenseTotal).toBe(12_000);
    expect(store.monthSummary.categoryTotals).toEqual({ lunch: 12_000 });

    await store.deleteExpense('00000000-0000-4000-8000-000000000001');

    expect(store.monthExpenses).toEqual([]);
    expect(store.monthSummary.expenseTotal).toBe(0);
  });

  test('derives expense statistics for years and months', async () => {
    const { store } = createBudgetStoreForTest();
    await store.initialize();

    await store.addExpense({
      date: '2026-06-27',
      categoryId: 'lunch',
      amount: 12_000,
      memo: 'lunch'
    });
    await store.addExpense({
      date: '2026-06-28',
      categoryId: 'living',
      amount: 8_000,
      memo: 'living'
    });
    await store.addExpense({
      date: '2025-04-02',
      categoryId: 'transport',
      amount: 5_000,
      memo: 'bus'
    });

    expect(store.expenseYears).toEqual(['2026', '2025']);
    expect(store.yearlyExpenseStats).toEqual([
      { year: '2026', total: 20_000 },
      { year: '2025', total: 5_000 }
    ]);
    expect(store.getMonthlyExpenseStats('2026').find((stat) => stat.month === '2026-06')).toEqual({
      month: '2026-06',
      label: '6월',
      total: 20_000
    });
    expect(store.getMonthlyExpenseStats('2026')).toHaveLength(12);
  });

  test('adds person records and toggles settlement in active balances only', async () => {
    const { store } = createBudgetStoreForTest();
    await store.initialize();

    await store.addPersonRecord({
      date: '2026-06-27',
      personName: ' 민수 ',
      direction: 'receivable',
      amount: 50_000,
      memo: ' ticket '
    });
    await store.addPersonRecord({
      date: '2026-06-28',
      personName: '민수',
      direction: 'payable',
      amount: 10_000,
      memo: 'coffee'
    });

    expect(store.data.personRecords[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      date: '2026-06-27',
      personName: '민수',
      direction: 'receivable',
      amount: 50_000,
      memo: 'ticket',
      settled: false
    });
    expect(store.personBalances).toEqual([{ personName: '민수', balance: 40_000 }]);

    await store.togglePersonRecordSettled('00000000-0000-4000-8000-000000000001');

    expect(store.data.personRecords[0].settled).toBe(true);
    expect(store.personBalances).toEqual([{ personName: '민수', balance: -10_000 }]);
  });

  test('exports and imports JSON while preserving persisted data', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');
    await store.setIncome(1_000_000);

    const exported = store.exportJson();
    const { store: nextStore } = createBudgetStoreForTest(repository);
    await nextStore.initialize();
    await nextStore.importJson(exported);

    expect(nextStore.data.months['2026-06'].income).toBe(1_000_000);
    expect(repository.savedData?.months['2026-06'].income).toBe(1_000_000);
  });

  test('default store uses the production store definition', () => {
    const store = useBudgetStore();

    expect(store.isLoaded).toBe(false);
  });
});
