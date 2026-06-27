export type CategoryId =
  | 'food'
  | 'transportation'
  | 'housing'
  | 'utilities'
  | 'healthcare'
  | 'culture'
  | 'shopping'
  | 'education'
  | 'savings'
  | 'other';

export type PersonMoneyDirection = 'to_receive' | 'to_pay';

export interface MonthRecord {
  month: string;
  income: number;
}

export interface Expense {
  id: string;
  month: string;
  categoryId: CategoryId;
  amount: number;
  memo?: string;
}

export interface PersonMoneyRecord {
  id: string;
  personName: string;
  direction: PersonMoneyDirection;
  amount: number;
  memo?: string;
}

export interface BudgetData {
  months: MonthRecord[];
  expenses: Expense[];
  personMoneyRecords: PersonMoneyRecord[];
}
