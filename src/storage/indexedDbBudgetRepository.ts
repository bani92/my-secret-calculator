import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from '../domain/types';
import type { BudgetRepository } from './budgetRepository';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';

const databaseName = 'local-budget-app';
const databaseVersion = 1;
const objectStoreName = 'budget';
const currentBudgetKey = 'current';

export interface BudgetRecordStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}

export class IndexedDbBudgetRepository implements BudgetRepository {
  constructor(private readonly recordStore: BudgetRecordStore = new BrowserIndexedDbRecordStore()) {}

  async load(): Promise<BudgetData> {
    const stored = await this.recordStore.get(currentBudgetKey);

    if (stored === undefined) {
      return createEmptyBudgetData();
    }

    try {
      return parseBudgetJson(JSON.stringify(stored));
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
    await this.recordStore.put(currentBudgetKey, JSON.parse(stringifyBudgetData(data)));
  }
}

class BrowserIndexedDbRecordStore implements BudgetRecordStore {
  private databasePromise: Promise<IDBDatabase> | undefined;

  async get(key: string): Promise<unknown> {
    const store = await this.objectStore('readonly');

    return requestToPromise(store.get(key));
  }

  async put(key: string, value: unknown): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(objectStoreName, 'readwrite');
    const store = transaction.objectStore(objectStoreName);

    store.put(value, key);
    await transactionToPromise(transaction);
  }

  private async objectStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const database = await this.openDatabase();
    const transaction = database.transaction(objectStoreName, mode);

    return transaction.objectStore(objectStoreName);
  }

  private openDatabase(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(objectStoreName)) {
          database.createObjectStore(objectStoreName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열 수 없습니다.'));
    });

    return this.databasePromise;
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 요청이 실패했습니다.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 트랜잭션이 실패했습니다.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 트랜잭션이 취소되었습니다.'));
  });
}
