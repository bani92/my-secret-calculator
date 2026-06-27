import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import type { BudgetRepository } from './budgetRepository';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';

const storageKey = 'local-budget-app:v1';

export class LocalStorageBudgetRepository implements BudgetRepository {
  constructor(private readonly storage: Storage = localStorage) {}

  load(): BudgetData {
    const raw = this.storage.getItem(storageKey);

    if (raw === null) {
      return createEmptyBudgetData();
    }

    try {
      return parseBudgetJson(raw);
    } catch {
      return createEmptyBudgetData();
    }
  }

  save(data: BudgetData): void {
    this.storage.setItem(storageKey, stringifyBudgetData(data));
  }
}
