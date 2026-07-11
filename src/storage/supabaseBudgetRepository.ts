import type {
  BudgetData,
  CategoryId,
  Expense,
  MonthRecord,
  PersonMoneyDirection,
  PersonMoneyRecord
} from '../domain/types';
import { requireSupabaseClient } from '../lib/supabaseClient';
import type { BudgetRepository } from './budgetRepository';

type BudgetTable = 'month_incomes' | 'expenses' | 'person_money_records';

export interface SupabaseQueryResponse<T> {
  data: T | null;
  error: unknown | null;
}

export interface SupabaseBudgetQuery extends PromiseLike<SupabaseQueryResponse<unknown>> {
  select(columns?: string): SupabaseBudgetQuery;
  upsert(values: unknown, options?: { onConflict: string }): SupabaseBudgetQuery;
  insert(values: unknown): SupabaseBudgetQuery;
  delete(): SupabaseBudgetQuery;
  update(values: unknown): SupabaseBudgetQuery;
  eq(column: string, value: unknown): SupabaseBudgetQuery;
  neq(column: string, value: unknown): SupabaseBudgetQuery;
}

export interface SupabaseBudgetDataClient {
  from(table: BudgetTable): SupabaseBudgetQuery;
  auth: {
    getUser(): Promise<SupabaseQueryResponse<{ user: { id: string } | null }>>;
  };
}

interface MonthIncomeRow {
  month: string;
  income: number;
}

interface ExpenseRow {
  id: string;
  date: string;
  month: string;
  category_id: CategoryId;
  amount: number;
  memo: string;
}

interface PersonMoneyRecordRow {
  id: string;
  date: string;
  person_name: string;
  direction: PersonMoneyDirection;
  amount: number;
  memo: string;
  settled: boolean;
}

const repositoryErrorMessage = 'Supabase 가계부 요청이 실패했습니다.';

function ensureSuccess(response: SupabaseQueryResponse<unknown>): void {
  if (response.error) {
    throw new Error(repositoryErrorMessage);
  }
}

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function toExpenseRow(expense: Expense): ExpenseRow {
  return {
    id: expense.id,
    date: expense.date,
    month: expense.month,
    category_id: expense.categoryId,
    amount: expense.amount,
    memo: expense.memo
  };
}

function toPersonMoneyRecordRow(record: PersonMoneyRecord): PersonMoneyRecordRow {
  return {
    id: record.id,
    date: record.date,
    person_name: record.personName,
    direction: record.direction,
    amount: record.amount,
    memo: record.memo,
    settled: record.settled
  };
}

export class SupabaseBudgetRepository implements BudgetRepository {
  constructor(
    private readonly getClient: () => SupabaseBudgetDataClient =
      requireSupabaseClient as unknown as () => SupabaseBudgetDataClient
  ) {}

  async load(): Promise<BudgetData> {
    const client = this.getClient();
    const [monthResponse, expenseResponse, personResponse] = await Promise.all([
      client.from('month_incomes').select(),
      client.from('expenses').select(),
      client.from('person_money_records').select()
    ]);

    ensureSuccess(monthResponse);
    ensureSuccess(expenseResponse);
    ensureSuccess(personResponse);

    const monthRows = rows<MonthIncomeRow>(monthResponse.data);
    const expenseRows = rows<ExpenseRow>(expenseResponse.data);
    const personRows = rows<PersonMoneyRecordRow>(personResponse.data);

    return {
      version: 1,
      months: Object.fromEntries(
        monthRows.map((row) => [row.month, { month: row.month, income: row.income }])
      ),
      expenses: expenseRows.map((row) => ({
        id: row.id,
        date: row.date,
        month: row.month,
        categoryId: row.category_id,
        amount: row.amount,
        memo: row.memo
      })),
      personRecords: personRows.map((row) => ({
        id: row.id,
        date: row.date,
        personName: row.person_name,
        direction: row.direction,
        amount: row.amount,
        memo: row.memo,
        settled: row.settled
      }))
    };
  }

  async setIncome(record: MonthRecord): Promise<void> {
    const response = await this.getClient()
      .from('month_incomes')
      .upsert({ month: record.month, income: record.income }, { onConflict: 'user_id,month' });

    ensureSuccess(response);
  }

  async addExpense(expense: Expense): Promise<void> {
    const response = await this.getClient().from('expenses').insert(toExpenseRow(expense));

    ensureSuccess(response);
  }

  async deleteExpense(id: string): Promise<void> {
    const response = await this.getClient().from('expenses').delete().eq('id', id);

    ensureSuccess(response);
  }

  async addPersonRecord(record: PersonMoneyRecord): Promise<void> {
    const response = await this.getClient()
      .from('person_money_records')
      .insert(toPersonMoneyRecordRow(record));

    ensureSuccess(response);
  }

  async setPersonRecordSettled(id: string, settled: boolean): Promise<void> {
    const response = await this.getClient()
      .from('person_money_records')
      .update({ settled })
      .eq('id', id);

    ensureSuccess(response);
  }

  async replaceAll(data: BudgetData): Promise<void> {
    const client = this.getClient();
    const userResponse = await client.auth.getUser();
    ensureSuccess(userResponse);

    const user = userResponse.data?.user;
    if (!user) {
      throw new Error(repositoryErrorMessage);
    }

    const deleteResponses = await Promise.all([
      client.from('month_incomes').delete().eq('user_id', user.id),
      client.from('expenses').delete().eq('user_id', user.id),
      client.from('person_money_records').delete().eq('user_id', user.id)
    ]);
    deleteResponses.forEach(ensureSuccess);

    const insertResponses = await Promise.all([
      client
        .from('month_incomes')
        .insert(Object.values(data.months).map((record) => ({ month: record.month, income: record.income }))),
      client.from('expenses').insert(data.expenses.map(toExpenseRow)),
      client.from('person_money_records').insert(data.personRecords.map(toPersonMoneyRecordRow))
    ]);
    insertResponses.forEach(ensureSuccess);
  }

  async save(data: BudgetData): Promise<void> {
    await this.replaceAll(data);
  }
}
