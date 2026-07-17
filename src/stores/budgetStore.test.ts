import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { parseBudgetJson } from '../storage/exportImport';
import { createBudgetStore, useBudgetStore } from './budgetStore';

class MemoryBudgetRepository implements BudgetRepository {
  savedData: BudgetData | undefined;
  loadCount = 0;
  setIncomeCount = 0;
  setIncomeRecords: MonthRecord[] = [];
  addExpenseCount = 0;
  deleteExpenseCount = 0;
  updateExpenseCount = 0;
  addPersonRecordCount = 0;
  setPersonRecordSettledCount = 0;
  replaceAllCount = 0;

  constructor(private data: BudgetData = createEmptyBudgetData()) {}

  async load(): Promise<BudgetData> {
    this.loadCount += 1;
    return structuredClone(this.data);
  }

  async setIncome(record: MonthRecord): Promise<void> {
    this.setIncomeCount += 1;
    this.setIncomeRecords.push(structuredClone(record));
    this.data.months[record.month] = structuredClone(record);
    this.saveSnapshot();
  }

  async addExpense(expense: Expense): Promise<void> {
    this.addExpenseCount += 1;
    this.data.expenses.push(structuredClone(expense));
    this.saveSnapshot();
  }

  async deleteExpense(id: string): Promise<void> {
    this.deleteExpenseCount += 1;
    this.data.expenses = this.data.expenses.filter((expense) => expense.id !== id);
    this.saveSnapshot();
  }

  async updateExpense(nextExpense: Expense): Promise<void> {
    this.updateExpenseCount += 1;
    this.data.expenses = this.data.expenses.map((expense) =>
      expense.id === nextExpense.id ? structuredClone(nextExpense) : expense
    );
    this.saveSnapshot();
  }

  async addPersonRecord(record: PersonMoneyRecord): Promise<void> {
    this.addPersonRecordCount += 1;
    this.data.personRecords.push(structuredClone(record));
    this.saveSnapshot();
  }

  async setPersonRecordSettled(id: string, settled: boolean): Promise<void> {
    this.setPersonRecordSettledCount += 1;
    const record = this.data.personRecords.find((item) => item.id === id);

    if (record) {
      record.settled = settled;
    }
    this.saveSnapshot();
  }

  async replaceAll(data: BudgetData): Promise<void> {
    this.replaceAllCount += 1;
    this.savedData = structuredClone(data);
    this.data = structuredClone(data);
  }

  private saveSnapshot(): void {
    this.savedData = structuredClone(this.data);
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
  async setIncome(): Promise<void> {
    this.setIncomeCount += 1;
    throw new Error('save failed');
  }

  async addExpense(): Promise<void> {
    this.addExpenseCount += 1;
    throw new Error('save failed');
  }

  async deleteExpense(): Promise<void> {
    this.deleteExpenseCount += 1;
    throw new Error('save failed');
  }

  async updateExpense(): Promise<void> {
    this.updateExpenseCount += 1;
    throw new Error('save failed');
  }

  async addPersonRecord(): Promise<void> {
    this.addPersonRecordCount += 1;
    throw new Error('save failed');
  }

  async setPersonRecordSettled(): Promise<void> {
    this.setPersonRecordSettledCount += 1;
    throw new Error('save failed');
  }

  async replaceAll(): Promise<void> {
    this.replaceAllCount += 1;
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
    expect(repository.setIncomeCount).toBe(1);
    expect(repository.addExpenseCount).toBe(0);
    expect(repository.deleteExpenseCount).toBe(0);
    expect(repository.addPersonRecordCount).toBe(0);
    expect(repository.setPersonRecordSettledCount).toBe(0);
    expect(repository.replaceAllCount).toBe(0);
  });

  test('adds an amount to the current month income', async () => {
    const repository = new MemoryBudgetRepository({
      ...createEmptyBudgetData(),
      months: { '2026-07': { month: '2026-07', income: 2800000 } }
    });
    const { store } = createBudgetStoreForTest(repository);

    await store.initialize();
    store.setSelectedMonth('2026-07');
    await store.addIncome(300000);

    expect(store.monthSummary.income).toBe(3100000);
    expect(repository.setIncomeRecords.at(-1)).toEqual({ month: '2026-07', income: 3100000 });
  });

  test('rejects non-positive income additions without saving', async () => {
    const repository = new MemoryBudgetRepository(createEmptyBudgetData());
    const { store } = createBudgetStoreForTest(repository);

    await store.initialize();
    await expect(store.addIncome(0)).rejects.toThrow('추가 금액은 0원보다 커야 합니다.');

    expect(repository.setIncomeRecords).toEqual([]);
  });

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
    const { store } = createBudgetStoreForTest(repository);

    await store.initialize();

    expect(store.getMonthSummary('2026-06').remaining).toBe(60000);
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

  test('validates income before persisting it', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');

    await expect(store.setIncome(Number.NaN)).rejects.toThrow();

    expect(repository.setIncomeCount).toBe(0);
    expect(store.data.months['2026-06']).toBeUndefined();
  });

  test('adds, lists, summarizes, and deletes expenses for the selected month', async () => {
    const { repository, store } = createBudgetStoreForTest();
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
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        date: '2026-06-27',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 12_000,
        memo: 'lunch'
      })
    ]);
    expect(store.monthSummary.expenseTotal).toBe(12_000);
    expect(store.monthSummary.categoryTotals).toEqual({ lunch: 12_000 });

    await store.deleteExpense('00000000-0000-4000-8000-000000000001');

    expect(store.monthExpenses).toEqual([]);
    expect(store.monthSummary.expenseTotal).toBe(0);
    expect(repository.addExpenseCount).toBe(2);
    expect(repository.deleteExpenseCount).toBe(1);
    expect(repository.setIncomeCount).toBe(1);
    expect(repository.addPersonRecordCount).toBe(0);
    expect(repository.setPersonRecordSettledCount).toBe(0);
    expect(repository.replaceAllCount).toBe(0);
  });

  test('adds expenses when crypto randomUUID is unavailable', async () => {
    vi.restoreAllMocks();
    const randomUuidDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');

    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined
    });

    try {
      const { repository, store } = createBudgetStoreForTest();

      await store.initialize();
      store.setSelectedMonth('2026-06');
      await store.addExpense({
        date: '2026-06-27',
        categoryId: 'lunch',
        amount: 12_000,
        memo: 'mobile lunch'
      });

      expect(store.monthExpenses).toHaveLength(1);
      expect(store.monthExpenses[0]).toMatchObject({
        date: '2026-06-27',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 12_000,
        memo: 'mobile lunch'
      });
      expect(store.monthExpenses[0].id).toEqual(expect.any(String));
      expect(store.monthExpenses[0].id.length).toBeGreaterThan(0);
      expect(repository.savedData?.expenses[0].id).toBe(store.monthExpenses[0].id);
    } finally {
      if (randomUuidDescriptor) {
        Object.defineProperty(crypto, 'randomUUID', randomUuidDescriptor);
      }
    }
  });

  test('validates expenses before persisting them', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    await expect(
      store.addExpense({
        date: '2026-06-27',
        categoryId: 'lunch',
        amount: Number.NaN,
        memo: 'bad amount'
      })
    ).rejects.toThrow();

    expect(repository.addExpenseCount).toBe(0);
    expect(store.data.expenses).toEqual([]);
  });

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
    const { store } = createBudgetStoreForTest(repository);

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

  test('rejects NaN expense updates without saving', async () => {
    const repository = new MemoryBudgetRepository({
      ...createEmptyBudgetData(),
      expenses: [
        {
          id: 'expense-id',
          date: '2026-07-17',
          month: '2026-07',
          categoryId: 'lunch',
          amount: 9000,
          memo: '점심'
        }
      ]
    });
    const { store } = createBudgetStoreForTest(repository);

    await store.initialize();

    await expect(
      store.updateExpense({
        id: 'expense-id',
        date: '2026-07-17',
        categoryId: 'lunch',
        amount: Number.NaN,
        memo: '잘못된 금액'
      })
    ).rejects.toThrow('지출 금액은 0원보다 커야 합니다.');

    expect(repository.updateExpenseCount).toBe(0);
    expect(store.data.expenses[0].amount).toBe(9000);
  });

  test('rejects empty expense update dates without saving', async () => {
    const repository = new MemoryBudgetRepository({
      ...createEmptyBudgetData(),
      expenses: [
        {
          id: 'expense-id',
          date: '2026-07-17',
          month: '2026-07',
          categoryId: 'lunch',
          amount: 9000,
          memo: '점심'
        }
      ]
    });
    const { store } = createBudgetStoreForTest(repository);

    await store.initialize();

    await expect(
      store.updateExpense({
        id: 'expense-id',
        date: '',
        categoryId: 'lunch',
        amount: 9000,
        memo: '수정'
      })
    ).rejects.toThrow('지출 날짜를 입력해주세요.');

    expect(repository.updateExpenseCount).toBe(0);
    expect(store.data.expenses[0].date).toBe('2026-07-17');
  });

  test('sorts a newly added past-date expense above an older-created expense', async () => {
    vi.setSystemTime(new Date('2026-07-17T10:00:00.000Z'));
    const repository = new MemoryBudgetRepository({
      ...createEmptyBudgetData(),
      expenses: [
        {
          id: 'older-created',
          date: '2026-07-16',
          month: '2026-07',
          categoryId: 'lunch',
          amount: 9000,
          memo: '기존 지출',
          createdAt: '2026-07-01T10:00:00.000Z'
        }
      ]
    });
    const { store } = createBudgetStoreForTest(repository);

    await store.initialize();
    store.setSelectedMonth('2026-07');
    await store.addExpense({
      date: '2026-07-01',
      categoryId: 'living',
      amount: 12_000,
      memo: '과거 날짜 신규 지출'
    });

    expect(store.monthExpenses.map((expense) => expense.memo)).toEqual(['과거 날짜 신규 지출', '기존 지출']);
    expect(store.monthExpenses[0].createdAt).toBe('2026-07-17T10:00:00.000Z');
  });

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
    const { repository, store } = createBudgetStoreForTest();
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
    expect(repository.addPersonRecordCount).toBe(2);
    expect(repository.setPersonRecordSettledCount).toBe(1);
    expect(repository.setIncomeCount).toBe(0);
    expect(repository.addExpenseCount).toBe(0);
    expect(repository.deleteExpenseCount).toBe(0);
    expect(repository.replaceAllCount).toBe(0);
    expect(store.personBalances).toEqual([{ personName: '민수', balance: -10_000 }]);
  });

  test('validates person records before persisting them', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    await expect(
      store.addPersonRecord({
        date: '2026-06-27',
        personName: '민수',
        direction: 'receivable',
        amount: Number.NaN,
        memo: 'bad amount'
      })
    ).rejects.toThrow();

    expect(repository.addPersonRecordCount).toBe(0);
    expect(store.data.personRecords).toEqual([]);
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
    expect(repository.replaceAllCount).toBe(1);
    expect(repository.setIncomeCount).toBe(1);
    expect(repository.addExpenseCount).toBe(0);
    expect(repository.deleteExpenseCount).toBe(0);
    expect(repository.addPersonRecordCount).toBe(0);
    expect(repository.setPersonRecordSettledCount).toBe(0);
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

    expect(repository.replaceAllCount).toBe(1);
    expect(repository.setIncomeCount).toBe(0);
    expect(repository.addExpenseCount).toBe(0);
    expect(repository.deleteExpenseCount).toBe(0);
    expect(repository.addPersonRecordCount).toBe(0);
    expect(repository.setPersonRecordSettledCount).toBe(0);
    expect(store.data).toEqual(existingData);
    expect(store.monthSummary.income).toBe(100_000);
    expect(store.monthExpenses).toHaveLength(1);
    expect(store.monthExpenses[0].memo).toBe('existing lunch');
  });

  test('default store uses the production store definition', () => {
    const store = useBudgetStore();

    expect(store.isLoaded).toBe(false);
  });

  test('resets loaded state and loads again on the next initialization', async () => {
    const { repository, store } = createBudgetStoreForTest();

    await store.initialize();
    store.reset();

    expect(store.isLoaded).toBe(false);
    expect(store.data).toEqual(createEmptyBudgetData());

    await store.initialize();

    expect(repository.loadCount).toBe(2);
  });
});
