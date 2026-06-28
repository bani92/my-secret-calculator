# PWA + IndexedDB + JSON 백업/복원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 가계부 앱을 갤럭시 S25에서 PWA로 설치할 수 있게 만들고, 데이터를 서버 없이 IndexedDB에 저장하며, 기존 JSON 백업/복원 흐름을 유지한다.

**Architecture:** 저장소 인터페이스를 `Promise` 기반으로 바꾸고 Pinia store가 앱 시작 시 IndexedDB에서 데이터를 비동기 로드한다. IndexedDB에는 `BudgetData` 전체를 `local-budget-app` 데이터베이스의 `budget` object store, `current` key 하나로 저장한다. PWA는 외부 플러그인 없이 `public/manifest.webmanifest`, `public/sw.js`, 정적 SVG 아이콘, `main.ts`의 service worker 등록으로 작게 시작한다.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, IndexedDB, Web App Manifest, Service Worker

---

## 파일 구조

- Modify: `src/storage/budgetRepository.ts` - 저장소 계약을 비동기 `Promise` API로 변경한다.
- Create: `src/storage/indexedDbBudgetRepository.ts` - IndexedDB 기반 저장소를 추가한다.
- Create: `src/storage/indexedDbBudgetRepository.test.ts` - 저장소 roundtrip, 빈 DB, 손상 데이터 복구를 검증한다.
- Modify: `src/storage/localStorageBudgetRepository.ts` - 테스트 보조용으로만 남기되 비동기 계약에 맞춘다.
- Modify: `src/storage/exportImport.test.ts` - localStorage 저장소 테스트를 제거하고 JSON 검증 테스트만 유지한다.
- Modify: `src/stores/budgetStore.ts` - store 초기 데이터를 빈 값으로 시작하고 `initialize()`로 IndexedDB 데이터를 불러온다.
- Modify: `src/stores/budgetStore.test.ts` - 비동기 초기화와 저장소 주입 흐름을 기준으로 테스트를 바꾼다.
- Modify: `src/App.vue` - store 로딩 상태를 표시하고 JSON 가져오기를 비동기 저장에 맞춘다.
- Modify: `src/App.test.ts` - mount 후 store 초기화 대기 helper를 추가하고 localStorage 직접 검증을 제거한다.
- Modify: `src/main.ts` - service worker 등록을 추가한다.
- Modify: `index.html` - manifest와 theme color meta를 연결한다.
- Create: `public/manifest.webmanifest` - PWA 설치 메타데이터를 정의한다.
- Create: `public/sw.js` - 앱 shell과 same-origin 요청 캐싱을 담당한다.
- Create: `public/icons/icon-192.svg` - 192 크기 앱 아이콘.
- Create: `public/icons/icon-512.svg` - 512 크기 앱 아이콘.
- Create: `src/pwa-assets.test.ts` - manifest와 service worker 파일이 설치 요건을 담는지 검증한다.

## Task 1: 저장소 계약을 비동기화하고 IndexedDB 저장소 추가

**Files:**
- Modify: `src/storage/budgetRepository.ts`
- Modify: `src/storage/localStorageBudgetRepository.ts`
- Create: `src/storage/indexedDbBudgetRepository.ts`
- Create: `src/storage/indexedDbBudgetRepository.test.ts`
- Modify: `src/storage/exportImport.test.ts`

- [ ] **Step 1: 실패하는 IndexedDB 저장소 테스트 작성**

`src/storage/indexedDbBudgetRepository.test.ts`를 추가한다.

```ts
import { beforeEach, describe, expect, test } from 'vitest';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import {
  IndexedDbBudgetRepository,
  type BudgetRecordStore
} from './indexedDbBudgetRepository';

const sampleBudgetData: BudgetData = {
  version: 1,
  months: {
    '2026-06': {
      month: '2026-06',
      income: 3_000_000
    }
  },
  expenses: [
    {
      id: 'expense-1',
      date: '2026-06-27',
      month: '2026-06',
      categoryId: 'lunch',
      amount: 12_000,
      memo: '점심'
    }
  ],
  personRecords: [
    {
      id: 'person-1',
      date: '2026-06-27',
      personName: '민수',
      direction: 'receivable',
      amount: 50_000,
      memo: '티켓',
      settled: false
    }
  ]
};

class MemoryBudgetRecordStore implements BudgetRecordStore {
  private records = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.records.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.records.set(key, value);
  }

  setRaw(key: string, value: unknown): void {
    this.records.set(key, value);
  }
}

describe('IndexedDbBudgetRepository', () => {
  let recordStore: MemoryBudgetRecordStore;
  let repository: IndexedDbBudgetRepository;

  beforeEach(() => {
    recordStore = new MemoryBudgetRecordStore();
    repository = new IndexedDbBudgetRepository(recordStore);
  });

  test('load returns empty budget data when IndexedDB has no current record', async () => {
    await expect(repository.load()).resolves.toEqual(createEmptyBudgetData());
  });

  test('save and load roundtrip using the current BudgetData record', async () => {
    await repository.save(sampleBudgetData);

    await expect(repository.load()).resolves.toEqual(sampleBudgetData);
  });

  test('load falls back to empty data when stored data is unsupported', async () => {
    recordStore.setRaw('current', { version: 2 });

    await expect(repository.load()).resolves.toEqual(createEmptyBudgetData());
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/storage/indexedDbBudgetRepository.test.ts`

Expected: FAIL with `Cannot find module './indexedDbBudgetRepository'`.

- [ ] **Step 3: 저장소 인터페이스를 비동기 계약으로 변경**

`src/storage/budgetRepository.ts`를 다음처럼 바꾼다.

```ts
import type { BudgetData } from '../domain/types';

export interface BudgetRepository {
  load(): Promise<BudgetData>;
  save(data: BudgetData): Promise<void>;
}
```

- [ ] **Step 4: localStorage 저장소를 비동기 계약에 맞춘다**

`src/storage/localStorageBudgetRepository.ts`의 `load`와 `save`를 다음처럼 바꾼다. 이 저장소는 자동 이관에는 사용하지 않고, 이전 테스트/개발 보조 구현으로만 남긴다.

```ts
import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
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

  async save(data: BudgetData): Promise<void> {
    this.storage.setItem(storageKey, stringifyBudgetData(data));
  }
}
```

- [ ] **Step 5: IndexedDB 저장소 구현**

`src/storage/indexedDbBudgetRepository.ts`를 추가한다.

```ts
import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
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

  async save(data: BudgetData): Promise<void> {
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
    const store = await this.objectStore('readwrite');

    await requestToPromise(store.put(value, key));
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
```

- [ ] **Step 6: export/import 테스트에서 localStorage 저장소 테스트 제거**

`src/storage/exportImport.test.ts`에서 `LocalStorageBudgetRepository`, `createEmptyBudgetData`, `beforeEach` import와 `describe('LocalStorageBudgetRepository', ...)` 블록을 제거한다. 파일 상단은 다음처럼 시작해야 한다.

```ts
import { describe, expect, test } from 'vitest';

import type { BudgetData } from '../domain/types';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';
```

- [ ] **Step 7: 저장소 테스트 통과 확인**

Run: `npm run test -- src/storage/indexedDbBudgetRepository.test.ts src/storage/exportImport.test.ts`

Expected: PASS. IndexedDB 저장소 테스트 3개와 JSON 테스트가 통과한다.

- [ ] **Step 8: 커밋**

```bash
git add src/storage/budgetRepository.ts src/storage/localStorageBudgetRepository.ts src/storage/indexedDbBudgetRepository.ts src/storage/indexedDbBudgetRepository.test.ts src/storage/exportImport.test.ts
git commit -m "feat: add indexeddb budget repository"
```

## Task 2: Pinia store 비동기 초기화로 전환

**Files:**
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/budgetStore.test.ts`

- [ ] **Step 1: 실패하는 store 테스트로 비동기 초기화 계약을 고정**

`src/stores/budgetStore.test.ts`를 다음 형태로 바꾼다. 핵심은 `createBudgetStoreForTest(repository)` helper를 만들고 모든 테스트가 `await store.initialize()`를 호출하는 것이다.

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { createBudgetStore, useBudgetStore } from './budgetStore';

class MemoryBudgetRepository implements BudgetRepository {
  savedData: BudgetData | undefined;

  constructor(private data: BudgetData = createEmptyBudgetData()) {}

  async load(): Promise<BudgetData> {
    return this.data;
  }

  async save(data: BudgetData): Promise<void> {
    this.savedData = structuredClone(data);
    this.data = structuredClone(data);
  }
}

function createBudgetStoreForTest(repository = new MemoryBudgetRepository()) {
  setActivePinia(createPinia());
  const useTestBudgetStore = createBudgetStore(repository);

  return {
    repository,
    store: useTestBudgetStore()
  };
}

describe('useBudgetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    let idCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initializes from the configured repository', async () => {
    const existingData: BudgetData = {
      version: 1,
      months: {
        '2026-06': { month: '2026-06', income: 1_000_000 }
      },
      expenses: [],
      personRecords: []
    };
    const { store } = createBudgetStoreForTest(new MemoryBudgetRepository(existingData));

    expect(store.isLoaded).toBe(false);

    await store.initialize();

    expect(store.isLoaded).toBe(true);
    expect(store.data.months['2026-06'].income).toBe(1_000_000);
  });

  test('sets income for the selected month and persists it', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');
    await store.setIncome(3_000_000);

    expect(store.monthSummary.income).toBe(3_000_000);
    expect(store.data.months['2026-06']).toEqual({ month: '2026-06', income: 3_000_000 });
    expect(repository.savedData?.months['2026-06'].income).toBe(3_000_000);
  });

  test('adds, lists, summarizes, and deletes expenses for the selected month', async () => {
    const { store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');
    await store.setIncome(500_000);
    await store.addExpense({
      date: '2026-06-27',
      categoryId: 'lunch',
      amount: 12_000,
      memo: ' lunch '
    });
    await store.addExpense({
      date: '2026-07-01',
      categoryId: 'transport',
      amount: 4_000,
      memo: 'bus'
    });

    expect(store.monthExpenses).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        date: '2026-06-27',
        month: '2026-06',
        categoryId: 'lunch',
        amount: 12_000,
        memo: 'lunch'
      }
    ]);
    expect(store.monthSummary.expenseTotal).toBe(12_000);
    expect(store.monthSummary.categoryTotals).toEqual({ lunch: 12_000 });

    await store.deleteExpense('00000000-0000-4000-8000-000000000001');

    expect(store.monthExpenses).toEqual([]);
    expect(store.monthSummary.expenseTotal).toBe(0);
  });

  test('derives expense statistics for years and months', async () => {
    const { store } = createBudgetStoreForTest();
    await store.initialize();

    await store.addExpense({
      date: '2026-06-27',
      categoryId: 'lunch',
      amount: 12_000,
      memo: 'lunch'
    });
    await store.addExpense({
      date: '2026-06-28',
      categoryId: 'living',
      amount: 8_000,
      memo: 'living'
    });
    await store.addExpense({
      date: '2025-04-02',
      categoryId: 'transport',
      amount: 5_000,
      memo: 'bus'
    });

    expect(store.expenseYears).toEqual(['2026', '2025']);
    expect(store.yearlyExpenseStats).toEqual([
      { year: '2026', total: 20_000 },
      { year: '2025', total: 5_000 }
    ]);
    expect(store.getMonthlyExpenseStats('2026').find((stat) => stat.month === '2026-06')).toEqual({
      month: '2026-06',
      label: '6월',
      total: 20_000
    });
    expect(store.getMonthlyExpenseStats('2026')).toHaveLength(12);
  });

  test('adds person records and toggles settlement in active balances only', async () => {
    const { store } = createBudgetStoreForTest();
    await store.initialize();

    await store.addPersonRecord({
      date: '2026-06-27',
      personName: ' 민수 ',
      direction: 'receivable',
      amount: 50_000,
      memo: ' ticket '
    });
    await store.addPersonRecord({
      date: '2026-06-28',
      personName: '민수',
      direction: 'payable',
      amount: 10_000,
      memo: 'coffee'
    });

    expect(store.data.personRecords[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      date: '2026-06-27',
      personName: '민수',
      direction: 'receivable',
      amount: 50_000,
      memo: 'ticket',
      settled: false
    });
    expect(store.personBalances).toEqual([{ personName: '민수', balance: 40_000 }]);

    await store.togglePersonRecordSettled('00000000-0000-4000-8000-000000000001');

    expect(store.data.personRecords[0].settled).toBe(true);
    expect(store.personBalances).toEqual([{ personName: '민수', balance: -10_000 }]);
  });

  test('exports and imports JSON while preserving persisted data', async () => {
    const { repository, store } = createBudgetStoreForTest();
    await store.initialize();

    store.setSelectedMonth('2026-06');
    await store.setIncome(1_000_000);

    const exported = store.exportJson();
    const { store: nextStore } = createBudgetStoreForTest(repository);
    await nextStore.initialize();
    await nextStore.importJson(exported);

    expect(nextStore.data.months['2026-06'].income).toBe(1_000_000);
    expect(repository.savedData?.months['2026-06'].income).toBe(1_000_000);
  });

  test('default store uses the production store definition', () => {
    const store = useBudgetStore();

    expect(store.isLoaded).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/stores/budgetStore.test.ts`

Expected: FAIL because `createBudgetStore`, `initialize`, `isLoaded`, async action return values do not exist.

- [ ] **Step 3: store를 비동기 저장소 주입 구조로 변경**

`src/stores/budgetStore.ts`를 다음 구조로 바꾼다.

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  calculateMonthlyExpenseStats,
  calculateMonthSummary,
  calculatePersonBalances,
  calculateYearlyExpenseStats,
  createEmptyBudgetData,
  getCurrentMonth,
  toMonth
} from '../domain/calculations';
import type { BudgetData, CategoryId, PersonMoneyDirection } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { parseBudgetJson, stringifyBudgetData } from '../storage/exportImport';
import { IndexedDbBudgetRepository } from '../storage/indexedDbBudgetRepository';

const newId = (): string => crypto.randomUUID();

export function createBudgetStore(repository: BudgetRepository) {
  return defineStore('budget', () => {
    const selectedMonth = ref(getCurrentMonth());
    const data = ref<BudgetData>(createEmptyBudgetData());
    const isLoaded = ref(false);

    const monthSummary = computed(() =>
      calculateMonthSummary(selectedMonth.value, data.value.months, data.value.expenses)
    );
    const monthExpenses = computed(() =>
      data.value.expenses
        .filter((expense) => expense.month === selectedMonth.value)
        .sort((left, right) => right.date.localeCompare(left.date))
    );
    const registeredMonths = computed(() => {
      const months = new Set<string>(Object.keys(data.value.months));

      for (const expense of data.value.expenses) {
        months.add(expense.month);
      }

      return [...months].sort((left, right) => right.localeCompare(left));
    });
    const registeredYears = computed(() => {
      const years = new Set(registeredMonths.value.map((month) => month.slice(0, 4)));

      return [...years].sort((left, right) => right.localeCompare(left));
    });
    const yearlyExpenseStats = computed(() => calculateYearlyExpenseStats(data.value.expenses));
    const expenseYears = computed(() => yearlyExpenseStats.value.map((stat) => stat.year));
    const personBalances = computed(() => calculatePersonBalances(data.value.personRecords));

    const initialize = async (): Promise<void> => {
      data.value = await repository.load();
      isLoaded.value = true;
    };

    const persist = async (): Promise<void> => {
      await repository.save(data.value);
    };

    const setSelectedMonth = (month: string): void => {
      selectedMonth.value = month;
    };

    const setIncome = async (income: number): Promise<void> => {
      data.value.months[selectedMonth.value] = { month: selectedMonth.value, income };
      await persist();
    };

    const addExpense = async (payload: {
      date: string;
      categoryId: CategoryId;
      amount: number;
      memo: string;
    }): Promise<void> => {
      data.value.expenses.push({
        id: newId(),
        date: payload.date,
        month: toMonth(payload.date),
        categoryId: payload.categoryId,
        amount: payload.amount,
        memo: payload.memo.trim()
      });
      await persist();
    };

    const deleteExpense = async (id: string): Promise<void> => {
      data.value.expenses = data.value.expenses.filter((expense) => expense.id !== id);
      await persist();
    };

    const getMonthlyExpenseStats = (year: string) => calculateMonthlyExpenseStats(year, data.value.expenses);

    const addPersonRecord = async (payload: {
      date: string;
      personName: string;
      direction: PersonMoneyDirection;
      amount: number;
      memo: string;
    }): Promise<void> => {
      data.value.personRecords.push({
        id: newId(),
        date: payload.date,
        personName: payload.personName.trim(),
        direction: payload.direction,
        amount: payload.amount,
        memo: payload.memo.trim(),
        settled: false
      });
      await persist();
    };

    const togglePersonRecordSettled = async (id: string): Promise<void> => {
      const record = data.value.personRecords.find((item) => item.id === id);

      if (record) {
        record.settled = !record.settled;
        await persist();
      }
    };

    const exportJson = (): string => stringifyBudgetData(data.value);

    const importJson = async (raw: string): Promise<void> => {
      data.value = parseBudgetJson(raw);
      await persist();
    };

    return {
      selectedMonth,
      data,
      isLoaded,
      monthSummary,
      monthExpenses,
      registeredMonths,
      registeredYears,
      yearlyExpenseStats,
      expenseYears,
      personBalances,
      initialize,
      setSelectedMonth,
      setIncome,
      addExpense,
      deleteExpense,
      getMonthlyExpenseStats,
      addPersonRecord,
      togglePersonRecordSettled,
      exportJson,
      importJson
    };
  });
}

export const useBudgetStore = createBudgetStore(new IndexedDbBudgetRepository());
```

- [ ] **Step 4: store 테스트 통과 확인**

Run: `npm run test -- src/stores/budgetStore.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/stores/budgetStore.ts src/stores/budgetStore.test.ts
git commit -m "refactor: load budget store asynchronously"
```

## Task 3: 앱 UI를 store 로딩 상태와 async 액션에 맞추기

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.test.ts`
- Modify: `src/components/LedgerTab.vue`
- Modify: `src/components/PersonMoneyTab.vue`

- [ ] **Step 1: 실패하는 앱 테스트 보정**

`src/App.test.ts` 상단 import에 `flushPromises`를 추가한다.

```ts
import { flushPromises, mount } from '@vue/test-utils';
```

파일 안에 mount helper를 추가한다.

```ts
async function mountLoadedApp() {
  const wrapper = mount(App, { global: { plugins: [createPinia()] } });

  expect(wrapper.text()).toContain('가계부를 불러오는 중입니다');
  await flushPromises();

  return wrapper;
}
```

모든 `mount(App, { global: { plugins: [createPinia()] } })` 호출을 `await mountLoadedApp()`으로 바꾼다. `uses the revised input headings` 테스트도 async로 바꾼다.

첫 테스트의 localStorage 직접 검증은 IndexedDB 전환 후 의미가 없으므로 제거한다.

```ts
expect(localStorage.getItem('local-budget-app:v1')).toContain('"amount": 12000');
```

`hides backup status messages after three seconds` 테스트에서 mount도 `await mountLoadedApp()`로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/App.test.ts`

Expected: FAIL because App does not show `가계부를 불러오는 중입니다` and does not call `store.initialize()`.

- [ ] **Step 3: App 로딩 상태와 async import 반영**

`src/App.vue` template의 탭과 화면 영역을 `store.isLoaded` 기준으로 감싼다.

```vue
    <section v-if="!store.isLoaded" class="panel app-loading" aria-live="polite">
      <p class="empty-copy">가계부를 불러오는 중입니다.</p>
    </section>

    <template v-else>
      <nav class="tabs" aria-label="주요 화면">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="tab"
          :class="{ active: activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <LedgerTab v-if="activeTab === 'input'" />
      <DashboardTab v-else-if="activeTab === 'dashboard'" />
      <StatisticsTab v-else-if="activeTab === 'statistics'" />
      <PersonMoneyTab v-else />
    </template>
```

`src/App.vue` script import를 바꾼다.

```ts
import { onMounted, ref } from 'vue';
```

`const store = useBudgetStore();` 아래에 초기화를 추가한다.

```ts
onMounted(() => {
  void store.initialize();
});
```

`importBackup` 안의 저장 호출을 await한다.

```ts
    await store.importJson(await file.text());
```

- [ ] **Step 4: 입력/사람 폼 submit 함수를 async로 변경**

`src/components/LedgerTab.vue`에서 `saveIncome`과 `submitExpense`를 async로 바꾼다.

```ts
async function saveIncome(): Promise<void> {
  await store.setIncome(parseMoneyInput(incomeDraft.value));
  incomeDraft.value = '';
}
```

```ts
async function submitExpense(): Promise<void> {
  const amount = parseMoneyInput(expenseAmountDraft.value);

  if (amount <= 0) {
    return;
  }

  await store.addExpense({ ...expenseForm, amount });
  store.setSelectedMonth(toMonth(expenseForm.date));
  incomeDraft.value = formatMoneyInput(String(store.monthSummary.income));
  expenseAmountDraft.value = '';
  expenseForm.memo = '';
}
```

`src/components/PersonMoneyTab.vue`에서 submit과 toggle 호출을 async로 맞춘다. template의 버튼 클릭은 다음처럼 바꾼다.

```vue
              <button type="button" class="icon-button" data-testid="toggle-settled" @click="toggleSettled(record.id)">
                {{ record.settled ? '정산 취소' : '정산 완료' }}
              </button>
```

script에 함수를 추가한다.

```ts
async function toggleSettled(id: string): Promise<void> {
  await store.togglePersonRecordSettled(id);
}
```

`submitRecord`를 async로 바꾼다.

```ts
async function submitRecord(): Promise<void> {
  const amount = parseMoneyInput(amountDraft.value);

  if (!recordForm.personName.trim() || amount <= 0) {
    return;
  }

  await store.addPersonRecord({ ...recordForm, amount });
  amountDraft.value = '';
  recordForm.personName = '';
  recordForm.memo = '';
}
```

- [ ] **Step 5: App 테스트 통과 확인**

Run: `npm run test -- src/App.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/App.vue src/App.test.ts src/components/LedgerTab.vue src/components/PersonMoneyTab.vue
git commit -m "feat: initialize app data asynchronously"
```

## Task 4: PWA manifest, icons, service worker 추가

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.svg`
- Create: `public/icons/icon-512.svg`
- Create: `src/pwa-assets.test.ts`

- [ ] **Step 1: 실패하는 PWA 자산 테스트 작성**

`src/pwa-assets.test.ts`를 추가한다.

```ts
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

describe('PWA assets', () => {
  test('manifest exposes install metadata for the local budget app', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

    expect(manifest.name).toBe('로컬 가계부');
    expect(manifest.short_name).toBe('가계부');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#2864a6');
    expect(manifest.background_color).toBe('#eef4f7');
    expect(manifest.icons).toEqual([
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]);
  });

  test('service worker caches the app shell and same-origin GET requests', () => {
    const serviceWorker = readFileSync('public/sw.js', 'utf8');

    expect(serviceWorker).toContain("const cacheName = 'local-budget-app-v1'");
    expect(serviceWorker).toContain("'/manifest.webmanifest'");
    expect(serviceWorker).toContain("'/icons/icon-192.svg'");
    expect(serviceWorker).toContain("event.request.method !== 'GET'");
    expect(serviceWorker).toContain('event.request.url.startsWith(self.location.origin)');
  });

  test('index links manifest and theme color', () => {
    const html = readFileSync('index.html', 'utf8');

    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta name="theme-color" content="#2864a6" />');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/pwa-assets.test.ts`

Expected: FAIL because `public/manifest.webmanifest` and `public/sw.js` do not exist.

- [ ] **Step 3: manifest 추가**

`public/manifest.webmanifest`를 추가한다.

```json
{
  "name": "로컬 가계부",
  "short_name": "가계부",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#2864a6",
  "background_color": "#eef4f7",
  "icons": [
    {
      "src": "/icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 4: SVG 아이콘 추가**

`public/icons/icon-192.svg`를 추가한다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192" role="img" aria-label="로컬 가계부">
  <rect width="192" height="192" rx="42" fill="#2864a6"/>
  <rect x="42" y="40" width="108" height="112" rx="14" fill="#ffffff"/>
  <rect x="58" y="60" width="76" height="10" rx="5" fill="#d08b45"/>
  <rect x="58" y="86" width="76" height="8" rx="4" fill="#ccd8e1"/>
  <rect x="58" y="108" width="48" height="8" rx="4" fill="#ccd8e1"/>
  <circle cx="128" cy="124" r="18" fill="#d08b45"/>
  <path d="M119 124h18M128 115v18" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
</svg>
```

`public/icons/icon-512.svg`를 추가한다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="로컬 가계부">
  <rect width="512" height="512" rx="112" fill="#2864a6"/>
  <rect x="112" y="106" width="288" height="300" rx="38" fill="#ffffff"/>
  <rect x="154" y="160" width="204" height="28" rx="14" fill="#d08b45"/>
  <rect x="154" y="230" width="204" height="22" rx="11" fill="#ccd8e1"/>
  <rect x="154" y="288" width="128" height="22" rx="11" fill="#ccd8e1"/>
  <circle cx="342" cy="330" r="48" fill="#d08b45"/>
  <path d="M318 330h48M342 306v48" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 5: service worker 추가**

`public/sw.js`를 추가한다.

```js
const cacheName = 'local-budget-app-v1';
const appShellFiles = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(appShellFiles))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        const responseCopy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, responseCopy));

        return response;
      });
    })
  );
});
```

- [ ] **Step 6: index.html에 PWA metadata 연결**

`index.html`의 `<head>`를 다음처럼 보강한다.

```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2864a6" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>로컬 가계부</title>
  </head>
```

- [ ] **Step 7: service worker 등록**

`src/main.ts`를 다음처럼 바꾼다.

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles.css';

createApp(App).use(createPinia()).mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
```

- [ ] **Step 8: PWA 자산 테스트 통과 확인**

Run: `npm run test -- src/pwa-assets.test.ts`

Expected: PASS.

- [ ] **Step 9: 커밋**

```bash
git add index.html src/main.ts public/manifest.webmanifest public/sw.js public/icons/icon-192.svg public/icons/icon-512.svg src/pwa-assets.test.ts
git commit -m "feat: add pwa install assets"
```

## Task 5: 전체 검증과 갤럭시 설치 준비 확인

**Files:**
- Verify only

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm run test`

Expected: 모든 Vitest 테스트 통과.

- [ ] **Step 2: 프로덕션 빌드 실행**

Run: `npm run build`

Expected: `vue-tsc --noEmit`와 Vite build 통과. `dist/manifest.webmanifest`, `dist/sw.js`, `dist/icons/icon-192.svg`, `dist/icons/icon-512.svg`가 생성된다.

- [ ] **Step 3: 빌드 산출물 확인**

Run: `Get-ChildItem -Recurse .\dist | Select-Object FullName`

Expected: 출력에 다음 경로가 포함된다.

```text
dist\manifest.webmanifest
dist\sw.js
dist\icons\icon-192.svg
dist\icons\icon-512.svg
```

- [ ] **Step 4: 개발 서버 실행**

Run: `npm run dev -- --host 0.0.0.0`

Expected: Vite가 local/network URL을 출력한다. 갤럭시 S25 같은 와이파이에서 접속하려면 PC의 IPv4 주소와 포트를 사용한다.

- [ ] **Step 5: 브라우저 수동 검증**

브라우저에서 다음을 확인한다.

- 첫 실행 시 `가계부를 불러오는 중입니다.`가 잠깐 보인 뒤 입력 탭이 보인다.
- 월 수입/지출/사람 기록을 추가한 뒤 새로고침해도 유지된다.
- 내보내기 JSON이 생성된다.
- 가져오기 JSON이 IndexedDB에 저장되고 화면이 갱신된다.
- 개발자 도구 Application 탭에서 IndexedDB `local-budget-app` / object store `budget` / key `current`가 보인다.
- Application 탭에서 Manifest가 `로컬 가계부`로 인식된다.
- Service Worker가 등록된다.

- [ ] **Step 6: 갤럭시 S25 확인**

갤럭시 S25 Chrome에서 다음을 확인한다.

- PC와 같은 Wi-Fi에 연결한다.
- PC IPv4 주소로 `http://<PC_IP>:5173/`에 접속한다.
- Chrome 메뉴에서 홈 화면에 추가가 가능한지 확인한다.
- 홈 화면 아이콘으로 실행한다.
- 입력한 데이터가 갤럭시 S25 IndexedDB에 남는지 새로고침으로 확인한다.

- [ ] **Step 7: 최종 커밋 없음**

검증만 수행했다면 추가 커밋은 만들지 않는다. 검증 중 수정이 생기면 수정 파일만 테스트 후 별도 커밋한다.

## Self-Review

- Spec coverage: PWA 설치 자산, service worker, IndexedDB 저장소, 비동기 store 초기화, JSON 백업/복원 유지, localStorage 자동 이관 제외를 모두 태스크에 포함했다.
- Placeholder scan: `TBD`, `TODO`, `implement later`, "적절히 처리" 같은 자리표시자 지시는 없다.
- Type consistency: `BudgetRepository`, `IndexedDbBudgetRepository`, `BudgetRecordStore`, `createBudgetStore`, `initialize`, `isLoaded` 이름을 태스크 전반에서 일관되게 사용했다.

Plan complete and saved to `docs/superpowers/plans/2026-06-28-pwa-indexeddb-backup.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
