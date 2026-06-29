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

  test('save and load roundtrip using the current BudgetData record', async () => {
    await repository.save(sampleBudgetData);

    await expect(repository.load()).resolves.toEqual(sampleBudgetData);
  });

  test('load falls back to empty data when stored data is unsupported', async () => {
    recordStore.setRaw('current', { version: 2 });

    await expect(repository.load()).resolves.toEqual(createEmptyBudgetData());
  });
});
