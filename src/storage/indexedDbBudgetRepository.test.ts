import { beforeEach, describe, expect, test } from 'vitest';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import {
  IndexedDbBudgetRepository,
  type BudgetRecordStore
} from './indexedDbBudgetRepository';

const sampleBudgetData: BudgetData = {
  version: 1,
  months: {
    '2026-06': {
      month: '2026-06',
      income: 3_000_000
    }
  },
  expenses: [
    {
      id: 'expense-1',
      date: '2026-06-27',
      month: '2026-06',
      categoryId: 'lunch',
      amount: 12_000,
      memo: '점심'
    }
  ],
  personRecords: [
    {
      id: 'person-1',
      date: '2026-06-27',
      personName: '민수',
      direction: 'receivable',
      amount: 50_000,
      memo: '티켓',
      settled: false
    }
  ]
};

class MemoryBudgetRecordStore implements BudgetRecordStore {
  private records = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.records.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.records.set(key, value);
  }

  setRaw(key: string, value: unknown): void {
    this.records.set(key, value);
  }
}

describe('IndexedDbBudgetRepository', () => {
  let recordStore: MemoryBudgetRecordStore;
  let repository: IndexedDbBudgetRepository;

  beforeEach(() => {
    recordStore = new MemoryBudgetRecordStore();
    repository = new IndexedDbBudgetRepository(recordStore);
  });

  test('load returns empty budget data when IndexedDB has no current record', async () => {
    await expect(repository.load()).resolves.toEqual(createEmptyBudgetData());
  });

  test('replaceAll and load roundtrip using the current BudgetData record', async () => {
    await repository.replaceAll(sampleBudgetData);

    await expect(repository.load()).resolves.toEqual(sampleBudgetData);
  });

  test('adds an expense while preserving existing budget data', async () => {
    await repository.replaceAll(sampleBudgetData);
    const expense = {
      id: 'expense-2',
      date: '2026-06-28',
      month: '2026-06',
      categoryId: 'transport' as const,
      amount: 4_000,
      memo: 'bus'
    };

    await repository.addExpense(expense);

    await expect(repository.load()).resolves.toEqual({
      ...sampleBudgetData,
      expenses: [...sampleBudgetData.expenses, expense]
    });
  });

  test('updates an existing expense while preserving its created time', async () => {
    await repository.replaceAll(sampleBudgetData);
    const expense = {
      ...sampleBudgetData.expenses[0],
      date: '2026-07-01',
      month: '2026-07',
      categoryId: 'living' as const,
      amount: 15_000,
      memo: '수정',
      createdAt: '2026-06-27T10:00:00.000Z'
    };

    await repository.updateExpense(expense);

    await expect(repository.load()).resolves.toEqual({
      ...sampleBudgetData,
      expenses: [expense]
    });
  });

  test('load falls back to empty data when stored data is unsupported', async () => {
    recordStore.setRaw('current', { version: 2 });

    await expect(repository.load()).resolves.toEqual(createEmptyBudgetData());
  });
});
