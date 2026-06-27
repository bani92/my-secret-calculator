import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import {
  calculateMonthSummary,
  calculatePersonBalances,
  createEmptyBudgetData,
  getCurrentMonth,
  toMonth
} from './calculations';
import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from './types';

describe('budget domain calculations', () => {
  it('defines Korean category labels for every expense category', () => {
    expect(CATEGORIES).toEqual([
      { id: 'food', label: '식비' },
      { id: 'transportation', label: '교통' },
      { id: 'housing', label: '주거' },
      { id: 'utilities', label: '공과금' },
      { id: 'healthcare', label: '의료' },
      { id: 'culture', label: '문화' },
      { id: 'shopping', label: '쇼핑' },
      { id: 'education', label: '교육' },
      { id: 'savings', label: '저축' },
      { id: 'other', label: '기타' }
    ]);
  });

  it('summarizes income, expenses, balance, and category totals for one month', () => {
    const months: MonthRecord[] = [
      { month: '2026-06', income: 3_000_000 },
      { month: '2026-07', income: 2_500_000 }
    ];
    const expenses: Expense[] = [
      { id: 'expense-1', month: '2026-06', categoryId: 'food', amount: 120_000, memo: '점심' },
      { id: 'expense-2', month: '2026-06', categoryId: 'food', amount: 80_000, memo: '저녁' },
      { id: 'expense-3', month: '2026-06', categoryId: 'transportation', amount: 55_000 },
      { id: 'expense-4', month: '2026-07', categoryId: 'food', amount: 90_000 }
    ];

    expect(calculateMonthSummary('2026-06', months, expenses)).toEqual({
      month: '2026-06',
      income: 3_000_000,
      totalExpenses: 255_000,
      balance: 2_745_000,
      categoryTotals: {
        food: 200_000,
        transportation: 55_000,
        housing: 0,
        utilities: 0,
        healthcare: 0,
        culture: 0,
        shopping: 0,
        education: 0,
        savings: 0,
        other: 0
      }
    });
  });

  it('uses zero income when a month record does not exist', () => {
    const expenses: Expense[] = [
      { id: 'expense-1', month: '2026-08', categoryId: 'other', amount: 30_000 }
    ];

    expect(calculateMonthSummary('2026-08', [], expenses)).toMatchObject({
      month: '2026-08',
      income: 0,
      totalExpenses: 30_000,
      balance: -30_000
    });
  });

  it('calculates net balances by person', () => {
    const records: PersonMoneyRecord[] = [
      { id: 'person-1', personName: '민수', direction: 'to_receive', amount: 50_000 },
      { id: 'person-2', personName: '민수', direction: 'to_pay', amount: 12_000 },
      { id: 'person-3', personName: '지아', direction: 'to_pay', amount: 20_000 },
      { id: 'person-4', personName: '지아', direction: 'to_receive', amount: 5_000 }
    ];

    expect(calculatePersonBalances(records)).toEqual([
      { personName: '민수', balance: 38_000, direction: 'to_receive' },
      { personName: '지아', balance: -15_000, direction: 'to_pay' }
    ]);
  });

  it('creates empty budget data with the required collections', () => {
    const data: BudgetData = createEmptyBudgetData();

    expect(data).toEqual({
      months: [],
      expenses: [],
      personMoneyRecords: []
    });
  });

  it('formats dates as local calendar months', () => {
    expect(toMonth(new Date(2026, 0, 3))).toBe('2026-01');
    expect(toMonth(new Date(2026, 10, 27))).toBe('2026-11');
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
