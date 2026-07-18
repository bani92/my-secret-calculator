import { describe, expect, it } from 'vitest';
import { categories } from './categories';
import {
  calculateLedgerGroups,
  calculateMonthlyExpenseStats,
  calculateMonthSummary,
  calculatePersonBalances,
  calculateYearlyExpenseStats,
  createEmptyBudgetData,
  getCurrentMonth,
  toMonth
} from './calculations';
import type { BudgetData, CategoryId, Expense, IncomeRecord, MonthRecord, PersonMoneyRecord } from './types';

describe('budget domain model', () => {
  it('defines the required Korean category labels in order', () => {
    const expectedCategoryIds = [
      'lunch',
      'living',
      'fixed',
      'dating',
      'groceries',
      'transport',
      'health',
      'gifts',
      'other'
    ] satisfies CategoryId[];

    expect(categories).toEqual([
      { id: 'lunch', label: '점심/외식' },
      { id: 'living', label: '생활비' },
      { id: 'fixed', label: '고정비' },
      { id: 'dating', label: '데이트/여가' },
      { id: 'groceries', label: '장보기/식재료' },
      { id: 'transport', label: '교통' },
      { id: 'health', label: '의료/건강' },
      { id: 'gifts', label: '선물/경조사' },
      { id: 'other', label: '기타' }
    ]);
    expect(categories.map((category) => category.id)).toEqual(expectedCategoryIds);
  });

  it('summarizes one month from record-shaped months and spending-only category totals', () => {
    const months: Record<string, MonthRecord> = {
      '2026-06': { month: '2026-06', income: 3_000_000 },
      '2026-07': { month: '2026-07', income: 2_500_000 }
    };
    const expenses: Expense[] = [
      {
        id: 'expense-1',
        date: '2026-06-03',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 120_000,
        memo: '점심'
      },
      {
        id: 'expense-2',
        date: '2026-06-04',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 80_000,
        memo: '외식'
      },
      {
        id: 'expense-3',
        date: '2026-06-05',
        month: '2026-06',
        categoryId: 'transport',
        amount: 55_000,
        memo: ''
      },
      {
        id: 'expense-4',
        date: '2026-07-01',
        month: '2026-07',
        categoryId: 'lunch',
        amount: 90_000,
        memo: ''
      }
    ];

    expect(calculateMonthSummary('2026-06', months, expenses)).toEqual({
      income: 3_000_000,
      expenseTotal: 255_000,
      remaining: 2_745_000,
      spendingRatio: 0.085,
      categoryTotals: {
        lunch: 200_000,
        transport: 55_000
      }
    });
  });

  it('adds income records to monthly income summary', () => {
    const summary = calculateMonthSummary(
      '2026-07',
      { '2026-07': { month: '2026-07', income: 2800000 } },
      [],
      [
        {
          id: 'income-id',
          date: '2026-07-18',
          month: '2026-07',
          categoryId: 'refund',
          amount: 100000,
          memo: '환급',
          createdAt: '2026-07-18T00:00:00.000Z'
        }
      ]
    );

    expect(summary.income).toBe(2900000);
    expect(summary.remaining).toBe(2900000);
  });

  it('groups income and expenses by date with signed daily totals', () => {
    const expenses: Expense[] = [
      {
        id: 'expense-1',
        date: '2026-07-16',
        month: '2026-07',
        categoryId: 'lunch',
        amount: 22_000,
        memo: '점심',
        createdAt: '2026-07-16T01:00:00.000Z'
      },
      {
        id: 'expense-2',
        date: '2026-07-17',
        month: '2026-07',
        categoryId: 'transport',
        amount: 5_000,
        memo: '버스'
      },
      {
        id: 'expense-other-month',
        date: '2026-08-01',
        month: '2026-08',
        categoryId: 'living',
        amount: 30_000,
        memo: ''
      }
    ];
    const incomeRecords: IncomeRecord[] = [
      {
        id: 'income-1',
        date: '2026-07-16',
        month: '2026-07',
        categoryId: 'refund',
        amount: 100_000,
        memo: '환급',
        createdAt: '2026-07-16T02:00:00.000Z'
      }
    ];

    expect(calculateLedgerGroups('2026-07', expenses, incomeRecords)).toEqual([
      {
        date: '2026-07-17',
        total: -5_000,
        entries: [
          expect.objectContaining({
            id: 'expense-2',
            kind: 'expense',
            signedAmount: -5_000,
            createdAt: undefined
          })
        ]
      },
      {
        date: '2026-07-16',
        total: 78_000,
        entries: [
          expect.objectContaining({
            id: 'income-1',
            kind: 'income',
            signedAmount: 100_000
          }),
          expect.objectContaining({
            id: 'expense-1',
            kind: 'expense',
            signedAmount: -22_000
          })
        ]
      }
    ]);
  });

  it('returns a null spending ratio when income is not positive', () => {
    const months: Record<string, MonthRecord> = {
      '2026-08': { month: '2026-08', income: 0 }
    };
    const expenses: Expense[] = [
      {
        id: 'expense-1',
        date: '2026-08-01',
        month: '2026-08',
        categoryId: 'other',
        amount: 30_000,
        memo: ''
      }
    ];

    expect(calculateMonthSummary('2026-08', months, expenses)).toEqual({
      income: 0,
      expenseTotal: 30_000,
      remaining: -30_000,
      spendingRatio: null,
      categoryTotals: {
        other: 30_000
      }
    });
  });

  it('builds yearly and monthly expense statistics from expenses only', () => {
    const expenses: Expense[] = [
      {
        id: 'expense-1',
        date: '2026-06-10',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 20_000,
        memo: ''
      },
      {
        id: 'expense-2',
        date: '2026-06-12',
        month: '2026-06',
        categoryId: 'living',
        amount: 30_000,
        memo: ''
      },
      {
        id: 'expense-3',
        date: '2025-04-02',
        month: '2025-04',
        categoryId: 'transport',
        amount: 12_000,
        memo: ''
      }
    ];

    expect(calculateYearlyExpenseStats(expenses)).toEqual([
      { year: '2026', total: 50_000 },
      { year: '2025', total: 12_000 }
    ]);

    expect(calculateMonthlyExpenseStats('2026', expenses)).toEqual([
      { month: '2026-01', label: '1월', total: 0 },
      { month: '2026-02', label: '2월', total: 0 },
      { month: '2026-03', label: '3월', total: 0 },
      { month: '2026-04', label: '4월', total: 0 },
      { month: '2026-05', label: '5월', total: 0 },
      { month: '2026-06', label: '6월', total: 50_000 },
      { month: '2026-07', label: '7월', total: 0 },
      { month: '2026-08', label: '8월', total: 0 },
      { month: '2026-09', label: '9월', total: 0 },
      { month: '2026-10', label: '10월', total: 0 },
      { month: '2026-11', label: '11월', total: 0 },
      { month: '2026-12', label: '12월', total: 0 }
    ]);
  });

  it('ignores settled person records, excludes zero balances, and sorts names by Korean locale', () => {
    const records: PersonMoneyRecord[] = [
      {
        id: 'person-1',
        date: '2026-06-01',
        personName: '민수',
        direction: 'receivable',
        amount: 50_000,
        memo: '',
        settled: false
      },
      {
        id: 'person-2',
        date: '2026-06-02',
        personName: '민수',
        direction: 'payable',
        amount: 12_000,
        memo: '',
        settled: false
      },
      {
        id: 'person-3',
        date: '2026-06-03',
        personName: '가영',
        direction: 'payable',
        amount: 15_000,
        memo: '',
        settled: false
      },
      {
        id: 'person-4',
        date: '2026-06-04',
        personName: '지아',
        direction: 'receivable',
        amount: 20_000,
        memo: '',
        settled: true
      },
      {
        id: 'person-5',
        date: '2026-06-05',
        personName: '태호',
        direction: 'receivable',
        amount: 10_000,
        memo: '',
        settled: false
      },
      {
        id: 'person-6',
        date: '2026-06-06',
        personName: '태호',
        direction: 'payable',
        amount: 10_000,
        memo: '',
        settled: false
      }
    ];

    expect(calculatePersonBalances(records)).toEqual([
      { personName: '가영', balance: -15_000 },
      { personName: '민수', balance: 38_000 }
    ]);
  });

  it('creates empty versioned budget data with record-shaped months', () => {
    const data: BudgetData = createEmptyBudgetData();

    expect(data).toEqual({
      version: 1,
      months: {},
      expenses: [],
      incomeRecords: [],
      personRecords: []
    });
  });

  it('formats date strings and Date objects as calendar months', () => {
    expect(toMonth('2026-01-03')).toBe('2026-01');
    expect(toMonth('2026-11-27')).toBe('2026-11');
    expect(getCurrentMonth(new Date(2026, 0, 3))).toBe('2026-01');
  });
});
