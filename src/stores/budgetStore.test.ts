import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { parseBudgetJson } from '../storage/exportImport';
import { createBudgetStore, useBudgetStore } from './budgetStore';

class MemoryBudgetRepository implements BudgetRepository {
  savedData: BudgetData | undefined;
  loadCount = 0;
  saveCount = 0;

  constructor(private data: BudgetData = createEmptyBudgetData()) {}

  async load(): Promise<BudgetData> {
    this.loadCount += 1;
    return this.data;
  }

  async save(data: BudgetData): Promise<void> {
    this.saveCount += 1;
    this.savedData = structuredClone(data);
    this.data = structuredClone(data);
  }
}

class FlakyLoadBudgetRepository extends MemoryBudgetRepository {
  async load(): Promise<BudgetData> {
    this.loadCount += 1;

    if (this.loadCount === 1) {
      throw new Error('load failed');
    }

    return {
      version: 1,
      months: {
        '2026-06': { month: '2026-06', income: 700_000 }
      },
      expenses: [],
      personRecords: []
    };
  }
}

class FailingSaveBudgetRepository extends MemoryBudgetRepository {
  async save(): Promise<void> {
    this.saveCount += 1;
    throw new Error('save failed');
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

  test('mutation actions wait for initialization before saving', async () => {
    const existingData: BudgetData = {
      version: 1,
      months: {
        '2026-05': { month: '2026-05', income: 900_000 }
      },
      expenses: [],
      personRecords: []
    };
    const { repository, store } = createBudgetStoreForTest(new MemoryBudgetRepository(existingData));

    store.setSelectedMonth('2026-06');
    await store.setIncome(3_000_000);

    expect(store.isLoaded).toBe(true);
    expect(store.data.months['2026-05'].income).toBe(900_000);
    expect(store.data.months['2026-06'].income).toBe(3_000_000);
    expect(repository.savedData?.months['2026-05'].income).toBe(900_000);
    expect(repository.savedData?.months['2026-06'].income).toBe(3_000_000);
  });

  test('initialize can retry after a load failure', async () => {
    const repository = new FlakyLoadBudgetRepository();
    const { store } = createBudgetStoreForTest(repository);

    await expect(store.initialize()).rejects.toThrow('load failed');

    expect(store.isLoaded).toBe(false);
    expect(store.loadError).toBe('가계부를 불러오지 못했습니다.');

    await store.initialize();

    expect(repository.loadCount).toBe(2);
    expect(store.isLoaded).toBe(true);
    expect(store.loadError).toBe('');
    expect(store.data.months['2026-06'].income).toBe(700_000);
  });

  test('exports repository data even when called before explicit initialization', async () => {
    const existingData: BudgetData = {
      version: 1,
      months: {
        '2026-06': { month: '2026-06', income: 1_200_000 }
      },
      expenses: [],
      personRecords: []
    };
    const repository = new MemoryBudgetRepository(existingData);
    const { store } = createBudgetStoreForTest(repository);

    const exported = await store.exportJson();

    expect(repository.loadCount).toBe(1);
    expect(parseBudgetJson(exported).months['2026-06'].income).toBe(1_200_000);
  });

  test('does not commit income in memory when persistence fails', async () => {
    const { store } = createBudgetStoreForTest(new FailingSaveBudgetRepository());
    await store.initialize();

    store.setSelectedMonth('2026-06');

    await expect(store.setIncome(3_000_000)).rejects.toThrow('save failed');

    expect(store.data.months['2026-06']).toBeUndefined();
    expect(store.monthSummary.income).toBe(0);
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

    const exported = await store.exportJson();
    const { store: nextStore } = createBudgetStoreForTest(repository);
    await nextStore.initialize();
    await nextStore.importJson(exported);

    expect(nextStore.data.months['2026-06'].income).toBe(1_000_000);
    expect(repository.savedData?.months['2026-06'].income).toBe(1_000_000);
  });

  test('rejects failed imports without replacing current data in memory', async () => {
    const existingData: BudgetData = {
      version: 1,
      months: {
        '2026-06': { month: '2026-06', income: 100_000 }
      },
      expenses: [
        {
          id: 'existing-expense',
          date: '2026-06-10',
          month: '2026-06',
          categoryId: 'lunch',
          amount: 10_000,
          memo: 'existing lunch'
        }
      ],
      personRecords: []
    };
    const importedBackup = JSON.stringify({
      version: 1,
      months: {
        '2026-06': { month: '2026-06', income: 500_000 }
      },
      expenses: [
        {
          id: 'imported-expense',
          date: '2026-06-11',
          month: '2026-06',
          categoryId: 'transport',
          amount: 20_000,
          memo: 'imported bus'
        }
      ],
      personRecords: []
    });
    const { repository, store } = createBudgetStoreForTest(new FailingSaveBudgetRepository(existingData));

    await store.initialize();
    store.setSelectedMonth('2026-06');

    await expect(store.importJson(importedBackup)).rejects.toThrow('save failed');

    expect(repository.saveCount).toBe(1);
    expect(store.data).toEqual(existingData);
    expect(store.monthSummary.income).toBe(100_000);
    expect(store.monthExpenses).toHaveLength(1);
    expect(store.monthExpenses[0].memo).toBe('existing lunch');
  });

  test('default store uses the production store definition', () => {
    const store = useBudgetStore();

    expect(store.isLoaded).toBe(false);
  });
});
