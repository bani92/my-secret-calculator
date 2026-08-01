import type {
  BudgetData,
  Expense,
  IncomeRecord,
  MonthRecord,
  PersonMoneyRecord,
  RecurringFixedExpenseRule
} from '../domain/types';

export interface BudgetRepository {
  load(): Promise<BudgetData>;
  setIncome(record: MonthRecord): Promise<void>;
  addExpense(expense: Expense): Promise<boolean>;
  deleteExpense(id: string): Promise<void>;
  updateExpense(expense: Expense): Promise<void>;
  addIncomeRecord(record: IncomeRecord): Promise<void>;
  updateIncomeRecord(record: IncomeRecord): Promise<void>;
  deleteIncomeRecord(id: string): Promise<void>;
  addPersonRecord(record: PersonMoneyRecord): Promise<void>;
  setPersonRecordSettled(id: string, settled: boolean): Promise<void>;
  addRecurringFixedExpenseRule(rule: RecurringFixedExpenseRule): Promise<void>;
  updateRecurringFixedExpenseRule(rule: RecurringFixedExpenseRule): Promise<void>;
  deleteRecurringFixedExpenseRule(id: string): Promise<void>;
  replaceAll(data: BudgetData): Promise<void>;
}
