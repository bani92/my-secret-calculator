import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from '../domain/types';

export interface BudgetRepository {
  load(): Promise<BudgetData>;
  setIncome(record: MonthRecord): Promise<void>;
  addExpense(expense: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  updateExpense(expense: Expense): Promise<void>;
  addPersonRecord(record: PersonMoneyRecord): Promise<void>;
  setPersonRecordSettled(id: string, settled: boolean): Promise<void>;
  replaceAll(data: BudgetData): Promise<void>;
}
