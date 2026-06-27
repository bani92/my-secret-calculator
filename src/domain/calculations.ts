import type { BudgetData, CategoryId, Expense, MonthRecord, PersonMoneyRecord } from './types';

export type CategoryTotals = Partial<Record<CategoryId, number>>;

export interface MonthSummary {
  income: number;
  expenseTotal: number;
  remaining: number;
  spendingRatio: number | null;
  categoryTotals: CategoryTotals;
}

export interface PersonBalance {
  personName: string;
  balance: number;
}

export function calculateMonthSummary(
  month: string,
  months: Record<string, MonthRecord>,
  expenses: Expense[]
): MonthSummary {
  const income = months[month]?.income ?? 0;
  const categoryTotals: CategoryTotals = {};
  let expenseTotal = 0;

  for (const expense of expenses) {
    if (expense.month !== month) {
      continue;
    }

    categoryTotals[expense.categoryId] = (categoryTotals[expense.categoryId] ?? 0) + expense.amount;
    expenseTotal += expense.amount;
  }

  return {
    income,
    expenseTotal,
    remaining: income - expenseTotal,
    spendingRatio: income > 0 ? expenseTotal / income : null,
    categoryTotals
  };
}

export function calculatePersonBalances(records: PersonMoneyRecord[]): PersonBalance[] {
  const balances = new Map<string, number>();

  for (const record of records) {
    if (record.settled) {
      continue;
    }

    const signedAmount = record.direction === 'receivable' ? record.amount : -record.amount;
    balances.set(record.personName, (balances.get(record.personName) ?? 0) + signedAmount);
  }

  return Array.from(balances, ([personName, balance]) => ({ personName, balance }))
    .filter((personBalance) => personBalance.balance !== 0)
    .sort((left, right) => left.personName.localeCompare(right.personName, 'ko'));
}

export function createEmptyBudgetData(): BudgetData {
  return {
    version: 1,
    months: {},
    expenses: [],
    personRecords: []
  };
}

export function getCurrentMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

export function toMonth(date: string): string {
  return date.slice(0, 7);
}
