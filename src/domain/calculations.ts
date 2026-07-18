import type { BudgetData, CategoryId, Expense, IncomeRecord, MonthRecord, PersonMoneyRecord } from './types';

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

export interface YearlyExpenseStat {
  year: string;
  total: number;
}

export interface MonthlyExpenseStat {
  month: string;
  label: string;
  total: number;
}

export function calculateMonthSummary(
  month: string,
  months: Record<string, MonthRecord>,
  expenses: Expense[],
  incomeRecords: IncomeRecord[] = []
): MonthSummary {
  const baseIncome = months[month]?.income ?? 0;
  const extraIncome = incomeRecords
    .filter((record) => record.month === month)
    .reduce((sum, record) => sum + record.amount, 0);
  const income = baseIncome + extraIncome;
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
    incomeRecords: [],
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

export function calculateYearlyExpenseStats(expenses: Expense[]): YearlyExpenseStat[] {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const year = expense.month.slice(0, 4);
    totals.set(year, (totals.get(year) ?? 0) + expense.amount);
  }

  return Array.from(totals, ([year, total]) => ({ year, total })).sort((left, right) =>
    right.year.localeCompare(left.year)
  );
}

export function calculateMonthlyExpenseStats(year: string, expenses: Expense[]): MonthlyExpenseStat[] {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    if (!expense.month.startsWith(`${year}-`)) {
      continue;
    }

    totals.set(expense.month, (totals.get(expense.month) ?? 0) + expense.amount);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const month = `${year}-${String(monthNumber).padStart(2, '0')}`;

    return {
      month,
      label: `${monthNumber}월`,
      total: totals.get(month) ?? 0
    };
  });
}
