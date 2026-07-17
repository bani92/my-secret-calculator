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
