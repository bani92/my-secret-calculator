export type CategoryId =
  | 'lunch'
  | 'living'
  | 'fixed'
  | 'dating'
  | 'groceries'
  | 'transport'
  | 'health'
  | 'gifts'
  | 'other';

export type PersonMoneyDirection = 'receivable' | 'payable';

export interface MonthRecord {
  month: string;
  income: number;
}

export interface Expense {
  id: string;
  date: string;
  month: string;
  categoryId: CategoryId;
  amount: number;
  memo: string;
  createdAt?: string;
}

export interface PersonMoneyRecord {
  id: string;
  date: string;
  personName: string;
  direction: PersonMoneyDirection;
  amount: number;
  memo: string;
  settled: boolean;
}

export interface BudgetData {
  version: 1;
  months: Record<string, MonthRecord>;
  expenses: Expense[];
  personRecords: PersonMoneyRecord[];
}
