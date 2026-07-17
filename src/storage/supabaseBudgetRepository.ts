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

interface ReplaceBudgetDataPayload {
  p_months: Array<Pick<MonthIncomeRow, 'month' | 'income'>>;
  p_expenses: ExpenseRow[];
  p_person_records: PersonMoneyRecordRow[];
}

export interface SupabaseBudgetDataClient {
  from(table: BudgetTable): SupabaseBudgetQuery;
  rpc(
    functionName: 'replace_budget_data',
    payload: ReplaceBudgetDataPayload
  ): Promise<SupabaseQueryResponse<unknown>>;
}

type SupabaseBudgetClientFactory = () => SupabaseBudgetDataClient;
type SupabaseClientFactory = () => ReturnType<typeof requireSupabaseClient>;

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
  created_at?: string;
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
    memo: expense.memo,
    ...(expense.createdAt === undefined ? {} : { created_at: expense.createdAt })
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
    private readonly getClient: SupabaseBudgetClientFactory | SupabaseClientFactory = requireSupabaseClient
  ) {}

  private client(): SupabaseBudgetDataClient {
    return this.getClient() as unknown as SupabaseBudgetDataClient;
  }

  async load(): Promise<BudgetData> {
    const client = this.client();
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
        memo: row.memo,
        createdAt: row.created_at
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
    const response = await this.client()
      .from('month_incomes')
      .upsert({ month: record.month, income: record.income }, { onConflict: 'user_id,month' });

    ensureSuccess(response);
  }

  async addExpense(expense: Expense): Promise<void> {
    const response = await this.client().from('expenses').insert(toExpenseRow(expense));

    ensureSuccess(response);
  }

  async deleteExpense(id: string): Promise<void> {
    const response = await this.client().from('expenses').delete().eq('id', id);

    ensureSuccess(response);
  }

  async updateExpense(expense: Expense): Promise<void> {
    const response = await this.client()
      .from('expenses')
      .update({
        date: expense.date,
        month: expense.month,
        category_id: expense.categoryId,
        amount: expense.amount,
        memo: expense.memo
      })
      .eq('id', expense.id);

    ensureSuccess(response);
  }

  async addPersonRecord(record: PersonMoneyRecord): Promise<void> {
    const response = await this.client()
      .from('person_money_records')
      .insert(toPersonMoneyRecordRow(record));

    ensureSuccess(response);
  }

  async setPersonRecordSettled(id: string, settled: boolean): Promise<void> {
    const response = await this.client()
      .from('person_money_records')
      .update({ settled })
      .eq('id', id);

    ensureSuccess(response);
  }

  async replaceAll(data: BudgetData): Promise<void> {
    const response = await this.client().rpc('replace_budget_data', {
      p_months: Object.values(data.months).map((record) => ({
        month: record.month,
        income: record.income
      })),
      p_expenses: data.expenses.map(toExpenseRow),
      p_person_records: data.personRecords.map(toPersonMoneyRecordRow)
    });

    ensureSuccess(response);
  }

}
