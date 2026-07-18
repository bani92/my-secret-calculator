import { describe, expect, test } from 'vitest';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';

const sampleBudgetData: BudgetData = {
  version: 1,
  months: {
    '2026-06': {
      month: '2026-06',
      income: 3000000
    }
  },
  expenses: [
    {
      id: 'expense-1',
      date: '2026-06-27',
      month: '2026-06',
      categoryId: 'lunch',
      amount: 12000,
      memo: 'Lunch'
    }
  ],
  incomeRecords: [],
  personRecords: [
    {
      id: 'person-1',
      date: '2026-06-27',
      personName: 'Min',
      direction: 'receivable',
      amount: 50000,
      memo: 'Ticket',
      settled: false
    }
  ]
};

describe('budget export and import', () => {
  test('defaults missing incomeRecords to an empty array', () => {
    const raw = JSON.stringify({
      version: 1,
      months: {},
      expenses: [],
      personRecords: []
    });

    expect(parseBudgetJson(raw).incomeRecords).toEqual([]);
  });

  test('preserves income records during export and import', () => {
    const data = createEmptyBudgetData();
    data.incomeRecords.push({
      id: 'income-id',
      date: '2026-07-18',
      month: '2026-07',
      categoryId: 'refund',
      amount: 100000,
      memo: '환급',
      createdAt: '2026-07-18T01:02:03.000Z'
    });

    expect(parseBudgetJson(stringifyBudgetData(data)).incomeRecords[0]).toMatchObject({
      id: 'income-id',
      categoryId: 'refund',
      amount: 100000
    });
  });

  test('parseBudgetJson rejects an income record with an unsupported category', () => {
    const data = createEmptyBudgetData();
    data.incomeRecords.push({
      id: 'income-id',
      date: '2026-07-18',
      month: '2026-07',
      categoryId: 'refund',
      amount: 100000,
      memo: '환급'
    });

    expect(() =>
      parseBudgetJson(
        JSON.stringify({
          ...data,
          incomeRecords: [{ ...data.incomeRecords[0], categoryId: 'unknown' }]
        })
      )
    ).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects an income record with a non-positive amount', () => {
    const data = createEmptyBudgetData();
    data.incomeRecords.push({
      id: 'income-id',
      date: '2026-07-18',
      month: '2026-07',
      categoryId: 'refund',
      amount: 0,
      memo: '환급'
    });

    expect(() => parseBudgetJson(JSON.stringify(data))).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects an income record with an invalid date', () => {
    const data = createEmptyBudgetData();
    data.incomeRecords.push({
      id: 'income-id',
      date: '2026-02-30',
      month: '2026-02',
      categoryId: 'refund',
      amount: 100000,
      memo: '환급'
    });

    expect(() => parseBudgetJson(JSON.stringify(data))).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects an income record with an invalid month number', () => {
    const data = createEmptyBudgetData();
    data.incomeRecords.push({
      id: 'income-id',
      date: '2026-13-01',
      month: '2026-13',
      categoryId: 'refund',
      amount: 100000,
      memo: '환급'
    });

    expect(() => parseBudgetJson(JSON.stringify(data))).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects an income record whose month does not match its date', () => {
    const data = createEmptyBudgetData();
    data.incomeRecords.push({
      id: 'income-id',
      date: '2026-07-18',
      month: '2026-08',
      categoryId: 'refund',
      amount: 100000,
      memo: '환급'
    });

    expect(() => parseBudgetJson(JSON.stringify(data))).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('stringifyBudgetData returns pretty JSON', () => {
    expect(stringifyBudgetData(sampleBudgetData)).toBe(JSON.stringify(sampleBudgetData, null, 2));
  });

  test('parseBudgetJson accepts valid BudgetData', () => {
    expect(parseBudgetJson(JSON.stringify(sampleBudgetData))).toEqual(sampleBudgetData);
  });

  test('preserves expense createdAt during export and import', () => {
    const data = createEmptyBudgetData();
    data.expenses.push({
      id: 'expense-id',
      date: '2026-07-17',
      month: '2026-07',
      categoryId: 'lunch',
      amount: 9000,
      memo: '점심',
      createdAt: '2026-07-17T01:02:03.000Z'
    });

    expect(parseBudgetJson(stringifyBudgetData(data)).expenses[0].createdAt).toBe('2026-07-17T01:02:03.000Z');
  });

  test('parseBudgetJson rejects an expense with a non-string createdAt', () => {
    expect(() =>
      parseBudgetJson(
        JSON.stringify({
          ...sampleBudgetData,
          expenses: [{ ...sampleBudgetData.expenses[0], createdAt: 123 }]
        })
      )
    ).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects an expense whose month does not match its date', () => {
    expect(() =>
      parseBudgetJson(
        JSON.stringify({
          ...sampleBudgetData,
          expenses: [{ ...sampleBudgetData.expenses[0], month: '2026-07' }]
        })
      )
    ).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects unsupported version', () => {
    expect(() => parseBudgetJson(JSON.stringify({ ...sampleBudgetData, version: 2 }))).toThrow(
      '지원하지 않는 백업 파일입니다'
    );
  });

  test('parseBudgetJson rejects unsupported shape', () => {
    expect(() =>
      parseBudgetJson(
        JSON.stringify({
          version: 1,
          months: [],
          expenses: {},
          personRecords: null
        })
      )
    ).toThrow('지원하지 않는 백업 파일입니다');
  });

  test('parseBudgetJson rejects malformed nested records', () => {
    expect(() =>
      parseBudgetJson(
        JSON.stringify({
          version: 1,
          months: {
            '2026-06': null
          },
          expenses: [
            {
              id: 'expense-1',
              date: '2026-06-27',
              month: '2026-06',
              categoryId: 'unknown',
              amount: '12000',
              memo: 'Lunch'
            }
          ],
          personRecords: [
            {
              id: 'person-1',
              date: '2026-06-27',
              personName: 'Min',
              direction: 'receivable',
              amount: 50000,
              memo: 'Ticket',
              settled: 'no'
            }
          ]
        })
      )
    ).toThrow('지원하지 않는 백업 파일입니다');
  });
});
