import type { BudgetData } from '../domain/types';

export interface BudgetRepository {
  load(): BudgetData;
  save(data: BudgetData): void;
}
