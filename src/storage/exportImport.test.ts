import { describe, expect, test } from 'vitest';

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
