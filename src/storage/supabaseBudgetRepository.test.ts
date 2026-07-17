import { describe, expect, test, vi } from 'vitest';

import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from '../domain/types';
import {
  SupabaseBudgetRepository,
  type SupabaseBudgetDataClient,
  type SupabaseQueryResponse
} from './supabaseBudgetRepository';

const requestError = { message: 'database request failed' };

const month: MonthRecord = {
  month: '2026-07',
  income: 3_000_000
};

const expense: Expense = {
  id: 'expense-1',
  date: '2026-07-11',
  month: '2026-07',
  categoryId: 'lunch',
  amount: 12_000,
  memo: '점심'
};

const personRecord: PersonMoneyRecord = {
  id: 'person-1',
  date: '2026-07-11',
  personName: '민수',
  direction: 'receivable',
  amount: 50_000,
  memo: '공연 티켓',
  settled: false
};

const replacement: BudgetData = {
  version: 1,
  months: { [month.month]: month },
  expenses: [expense],
  personRecords: [personRecord]
};

type QueryResult = SupabaseQueryResponse<unknown>;

class FakeFluentQuery {
  readonly select = vi.fn(() => this);
  readonly upsert = vi.fn(() => this);
  readonly insert = vi.fn(() => this);
  readonly delete = vi.fn(() => this);
  readonly update = vi.fn(() => this);
  readonly eq = vi.fn(() => this);
  readonly neq = vi.fn(() => this);

  constructor(private readonly result: QueryResult) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function success(data: unknown = null): QueryResult {
  return { data, error: null };
}

function failure(): QueryResult {
  return { data: null, error: requestError };
}

function createClient(
  queryResults: QueryResult[] = [],
  rpcResult: QueryResult = success(),
  userResult: SupabaseQueryResponse<{ user: { id: string } | null }> = {
    data: { user: { id: 'owner-1' } },
    error: null
  }
) {
  const queriesByTable = new Map<string, FakeFluentQuery[]>();
  const from = vi.fn((table: string) => {
    const query = new FakeFluentQuery(queryResults.shift() ?? success());
    const queries = queriesByTable.get(table) ?? [];
    queries.push(query);
    queriesByTable.set(table, queries);
    return query;
  });
  const getUser = vi.fn(async () => userResult);
  const rpc = vi.fn(async () => rpcResult);
  const client = {
    from,
    auth: { getUser },
    rpc
  } as unknown as SupabaseBudgetDataClient;

  return {
    client,
    from,
    getUser,
    rpc,
    queriesFor: (table: string): FakeFluentQuery[] => queriesByTable.get(table) ?? []
  };
}

describe('SupabaseBudgetRepository', () => {
  test('loads and maps all three Supabase budget tables', async () => {
    const fake = createClient([
      success([{ month: '2026-07', income: 3_000_000 }]),
      success([
        {
          id: expense.id,
          date: expense.date,
          month: expense.month,
          category_id: expense.categoryId,
          amount: expense.amount,
          memo: expense.memo,
          created_at: '2026-07-11T03:04:05.000Z'
        }
      ]),
      success([
        {
          id: personRecord.id,
          date: personRecord.date,
          person_name: personRecord.personName,
          direction: personRecord.direction,
          amount: personRecord.amount,
          memo: personRecord.memo,
          settled: personRecord.settled
        }
      ])
    ]);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    const data = await repository.load();

    expect(data.months['2026-07']).toEqual({ month: '2026-07', income: 3_000_000 });
    expect(data.expenses[0]).toMatchObject({
      categoryId: 'lunch',
      amount: 12_000,
      createdAt: '2026-07-11T03:04:05.000Z'
    });
    expect(data.personRecords[0]).toMatchObject({ personName: '민수', settled: false });
    expect(fake.from).toHaveBeenCalledWith('month_incomes');
    expect(fake.from).toHaveBeenCalledWith('expenses');
    expect(fake.from).toHaveBeenCalledWith('person_money_records');
  });

  test('upserts a month income using the user-month conflict key', async () => {
    const fake = createClient([success()]);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await repository.setIncome(month);

    expect(fake.queriesFor('month_incomes')[0].upsert).toHaveBeenCalledWith(
      { month: month.month, income: month.income },
      { onConflict: 'user_id,month' }
    );
  });

  test('inserts an expense with snake_case columns', async () => {
    const fake = createClient([success()]);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await repository.addExpense(expense);

    const expenseInsert = fake.queriesFor('expenses')[0].insert;
    expect(expenseInsert).toHaveBeenCalledWith({
      id: expense.id,
      date: expense.date,
      month: expense.month,
      category_id: expense.categoryId,
      amount: expense.amount,
      memo: expense.memo
    });
  });

  test('deletes an expense by id', async () => {
    const fake = createClient([success()]);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await repository.deleteExpense(expense.id);

    const query = fake.queriesFor('expenses')[0];
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith('id', expense.id);
  });

  test('updates an expense with mutable snake_case columns', async () => {
    const fake = createClient([success()]);
    const repository = new SupabaseBudgetRepository(() => fake.client);
    const updatedExpense = {
      ...expense,
      date: '2026-08-01',
      month: '2026-08',
      categoryId: 'living' as const,
      amount: 15_000,
      memo: '수정',
      createdAt: '2026-07-11T03:04:05.000Z'
    };

    await repository.updateExpense(updatedExpense);

    const query = fake.queriesFor('expenses')[0];
    expect(query.update).toHaveBeenCalledWith({
      date: updatedExpense.date,
      month: updatedExpense.month,
      category_id: updatedExpense.categoryId,
      amount: updatedExpense.amount,
      memo: updatedExpense.memo
    });
    expect(query.eq).toHaveBeenCalledWith('id', updatedExpense.id);
  });

  test('inserts a person-money record with snake_case columns', async () => {
    const fake = createClient([success()]);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await repository.addPersonRecord(personRecord);

    expect(fake.queriesFor('person_money_records')[0].insert).toHaveBeenCalledWith({
      id: personRecord.id,
      date: personRecord.date,
      person_name: personRecord.personName,
      direction: personRecord.direction,
      amount: personRecord.amount,
      memo: personRecord.memo,
      settled: personRecord.settled
    });
  });

  test('updates only the settled column for a person-money record', async () => {
    const fake = createClient([success()]);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await repository.setPersonRecordSettled(personRecord.id, true);

    const query = fake.queriesFor('person_money_records')[0];
    expect(query.update).toHaveBeenCalledWith({ settled: true });
    expect(query.eq).toHaveBeenCalledWith('id', personRecord.id);
  });

  test('replaces all data with one transactional RPC and snake_case payloads', async () => {
    const fake = createClient();
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await repository.replaceAll(replacement);

    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(fake.rpc).toHaveBeenCalledWith('replace_budget_data', {
      p_months: [{ month: month.month, income: month.income }],
      p_expenses: [
        {
          id: expense.id,
          date: expense.date,
          month: expense.month,
          category_id: expense.categoryId,
          amount: expense.amount,
          memo: expense.memo
        }
      ],
      p_person_records: [
        {
          id: personRecord.id,
          date: personRecord.date,
          person_name: personRecord.personName,
          direction: personRecord.direction,
          amount: personRecord.amount,
          memo: personRecord.memo,
          settled: personRecord.settled
        }
      ]
    });
    expect(fake.getUser).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
  });

  test.each([
    ['load month rows', (repository: SupabaseBudgetRepository) => repository.load(), [failure(), success([]), success([])]],
    ['load expense rows', (repository: SupabaseBudgetRepository) => repository.load(), [success([]), failure(), success([])]],
    ['load person-money rows', (repository: SupabaseBudgetRepository) => repository.load(), [success([]), success([]), failure()]],
    ['set income', (repository: SupabaseBudgetRepository) => repository.setIncome(month), [failure()]],
    ['add expense', (repository: SupabaseBudgetRepository) => repository.addExpense(expense), [failure()]],
    ['delete expense', (repository: SupabaseBudgetRepository) => repository.deleteExpense(expense.id), [failure()]],
    ['update expense', (repository: SupabaseBudgetRepository) => repository.updateExpense(expense), [failure()]],
    ['add person-money record', (repository: SupabaseBudgetRepository) => repository.addPersonRecord(personRecord), [failure()]],
    ['set person-money record settled', (repository: SupabaseBudgetRepository) => repository.setPersonRecordSettled(personRecord.id, true), [failure()]]
  ])('returns the generic error when %s fails', async (_label, operation, queryResults) => {
    const fake = createClient(queryResults);
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await expect(operation(repository)).rejects.toThrow('Supabase 가계부 요청이 실패했습니다.');
  });

  test('returns the generic error when the replacement RPC fails', async () => {
    const fake = createClient([], failure());
    const repository = new SupabaseBudgetRepository(() => fake.client);

    await expect(repository.replaceAll(replacement)).rejects.toThrow('Supabase 가계부 요청이 실패했습니다.');
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(fake.from).not.toHaveBeenCalled();
  });
});
