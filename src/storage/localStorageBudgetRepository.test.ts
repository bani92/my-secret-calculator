import { beforeEach, describe, expect, test } from 'vitest';

import { createEmptyBudgetData } from '../domain/calculations';
import type { IncomeRecord } from '../domain/types';
import { LocalStorageBudgetRepository } from './localStorageBudgetRepository';

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const incomeRecord: IncomeRecord = {
  id: 'income-1',
  date: '2026-07-18',
  month: '2026-07',
  categoryId: 'refund',
  amount: 100_000,
  memo: '환급',
  createdAt: '2026-07-18T01:02:03.000Z'
};

describe('LocalStorageBudgetRepository', () => {
  let repository: LocalStorageBudgetRepository;

  beforeEach(() => {
    repository = new LocalStorageBudgetRepository(new MemoryStorage());
  });

  test('adds, updates, and deletes income records through localStorage JSON roundtrip', async () => {
    await repository.replaceAll(createEmptyBudgetData());

    await repository.addIncomeRecord(incomeRecord);
    await expect(repository.load()).resolves.toMatchObject({
      incomeRecords: [incomeRecord]
    });

    const updatedRecord: IncomeRecord = {
      ...incomeRecord,
      categoryId: 'side',
      amount: 150_000,
      memo: '수정'
    };

    await repository.updateIncomeRecord(updatedRecord);
    await expect(repository.load()).resolves.toMatchObject({
      incomeRecords: [updatedRecord]
    });

    await repository.deleteIncomeRecord(incomeRecord.id);
    await expect(repository.load()).resolves.toMatchObject({
      incomeRecords: []
    });
  });
});
