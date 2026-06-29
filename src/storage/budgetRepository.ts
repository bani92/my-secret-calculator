import type { BudgetData } from '../domain/types';

export interface BudgetRepository {
  load(): Promise<BudgetData>;
  save(data: BudgetData): Promise<void>;
}
