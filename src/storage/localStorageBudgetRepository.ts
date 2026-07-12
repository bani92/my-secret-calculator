import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from '../domain/types';
import type { BudgetRepository } from './budgetRepository';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';

const storageKey = 'local-budget-app:v1';

export class LocalStorageBudgetRepository implements BudgetRepository {
  constructor(private readonly storage: Storage = localStorage) {}

  async load(): Promise<BudgetData> {
    const raw = this.storage.getItem(storageKey);

    if (raw === null) {
      return createEmptyBudgetData();
    }

    try {
      return parseBudgetJson(raw);
    } catch {
      return createEmptyBudgetData();
    }
  }

  async setIncome(record: MonthRecord): Promise<void> {
    const data = await this.load();

    data.months[record.month] = record;
    await this.write(data);
  }

  async addExpense(expense: Expense): Promise<void> {
    const data = await this.load();

    data.expenses.push(expense);
    await this.write(data);
  }

  async deleteExpense(id: string): Promise<void> {
    const data = await this.load();

    data.expenses = data.expenses.filter((expense) => expense.id !== id);
    await this.write(data);
  }

  async addPersonRecord(record: PersonMoneyRecord): Promise<void> {
    const data = await this.load();

    data.personRecords.push(record);
    await this.write(data);
  }

  async setPersonRecordSettled(id: string, settled: boolean): Promise<void> {
    const data = await this.load();
    const record = data.personRecords.find((item) => item.id === id);

    if (record) {
      record.settled = settled;
    }
    await this.write(data);
  }

  async replaceAll(data: BudgetData): Promise<void> {
    await this.write(data);
  }

  private async write(data: BudgetData): Promise<void> {
    this.storage.setItem(storageKey, stringifyBudgetData(data));
  }
}
