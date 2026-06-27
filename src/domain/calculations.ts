import { CATEGORIES } from './categories';
import type {
  BudgetData,
  CategoryId,
  Expense,
  MonthRecord,
  PersonMoneyDirection,
  PersonMoneyRecord
} from './types';

export type CategoryTotals = Record<CategoryId, number>;

export interface MonthSummary {
  month: string;
  income: number;
  totalExpenses: number;
  balance: number;
  categoryTotals: CategoryTotals;
}

export interface PersonBalance {
  personName: string;
  balance: number;
  direction: PersonMoneyDirection | 'settled';
}

export function calculateMonthSummary(
  month: string,
  months: MonthRecord[],
  expenses: Expense[]
): MonthSummary {
  const income = months.find((record) => record.month === month)?.income ?? 0;
  const categoryTotals = createEmptyCategoryTotals();
  let totalExpenses = 0;

  for (const expense of expenses) {
    if (expense.month !== month) {
      continue;
    }

    categoryTotals[expense.categoryId] += expense.amount;
    totalExpenses += expense.amount;
  }

  return {
    month,
    income,
    totalExpenses,
    balance: income - totalExpenses,
    categoryTotals
  };
}

export function calculatePersonBalances(records: PersonMoneyRecord[]): PersonBalance[] {
  const balances = new Map<string, number>();

  for (const record of records) {
    const signedAmount = record.direction === 'to_receive' ? record.amount : -record.amount;
    balances.set(record.personName, (balances.get(record.personName) ?? 0) + signedAmount);
  }

  return Array.from(balances, ([personName, balance]) => ({
    personName,
    balance,
    direction: balance > 0 ? 'to_receive' : balance < 0 ? 'to_pay' : 'settled'
  }));
}

export function createEmptyBudgetData(): BudgetData {
  return {
    months: [],
    expenses: [],
    personMoneyRecords: []
  };
}

export function getCurrentMonth(): string {
  return toMonth(new Date());
}

export function toMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function createEmptyCategoryTotals(): CategoryTotals {
  return Object.fromEntries(CATEGORIES.map((category) => [category.id, 0])) as CategoryTotals;
}
