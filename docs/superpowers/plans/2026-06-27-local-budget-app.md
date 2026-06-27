# 로컬 가계부 앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vue 기반 로컬 웹앱으로 월별 가계부와 사람별 돈 기록 기능을 만든다.

**Architecture:** Vue 3 SPA를 Vite로 구성하고, Pinia store가 앱 상태를 관리한다. 저장소는 `BudgetRepository` 인터페이스 뒤에 숨기고 첫 구현은 localStorage를 사용해서, 나중에 Spring Boot API 저장소로 교체할 수 있게 한다. UI는 모바일 입력 중심을 기본 화면으로 두고, 월별 요약 대시보드는 별도 탭으로 제공한다.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, localStorage, CSS

---

## 파일 구조

- Create: `package.json` - npm 스크립트와 의존성 정의
- Create: `index.html` - Vite 진입 HTML
- Create: `vite.config.ts` - Vue/Vitest 설정
- Create: `tsconfig.json` - TypeScript 설정
- Create: `src/main.ts` - Vue 앱 부트스트랩
- Create: `src/App.vue` - 전체 앱 레이아웃과 탭 전환
- Create: `src/styles.css` - 전역 스타일
- Create: `src/domain/types.ts` - 지출, 월별 수입, 사람별 돈 기록 타입
- Create: `src/domain/categories.ts` - 기본 카테고리 정의
- Create: `src/domain/calculations.ts` - 월별 합계와 사람별 미정산 계산
- Create: `src/domain/calculations.test.ts` - 계산 로직 테스트
- Create: `src/storage/budgetRepository.ts` - 저장소 인터페이스
- Create: `src/storage/localStorageBudgetRepository.ts` - localStorage 구현체
- Create: `src/storage/exportImport.ts` - JSON 내보내기/가져오기 유틸
- Create: `src/storage/exportImport.test.ts` - 백업/복원 테스트
- Create: `src/stores/budgetStore.ts` - Pinia 상태 관리
- Create: `src/components/LedgerTab.vue` - 가계부 탭
- Create: `src/components/DashboardTab.vue` - 월별 요약 대시보드 탭
- Create: `src/components/PersonMoneyTab.vue` - 사람별 돈 기록 탭
- Create: `src/components/SummaryCard.vue` - 요약 카드

## UI 방향

구현 UI는 `docs/ui-samples/budget-ui-options.html`의 구조를 따른다.

- 기본 탭은 `입력`이다.
- `입력` 탭은 B안처럼 모바일에서 빠르게 지출을 추가하는 흐름을 우선한다.
- A안의 월별 합계, 카테고리 합계, 사람별 미정산 요약은 `대시보드` 탭으로 분리한다.
- 세 번째 탭은 `사람` 또는 `사람별 돈`으로 표시하고, 사람별 돈 기록 입력과 전체 기록을 보여준다.
- 색상은 사용자가 최종 선택한 팔레트를 적용한다. 팔레트 선택 전에는 샘플의 `세이지 + 앰버`, `오션 블루 + 코퍼`, `잉크 퍼플 + 클레이` 중 하나를 CSS 변수로 쉽게 교체할 수 있게 구성한다.

## Task 1: Vue 프로젝트 기반 만들기

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/styles.css`

- [ ] **Step 1: 프로젝트 파일을 생성한다**

`package.json`:

```json
{
  "name": "local-budget-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vue-tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "pinia": "^2.3.0",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.1.0"
  }
}
```

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>로컬 가계부</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

`src/main.ts`:

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles.css';

createApp(App).use(createPinia()).mount('#app');
```

`src/App.vue`:

```vue
<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">개인 기록용</p>
        <h1>로컬 가계부</h1>
      </div>
    </header>

    <nav class="tabs" aria-label="주요 화면">
      <button type="button" class="tab active">가계부</button>
      <button type="button" class="tab">사람별 돈 기록</button>
    </nav>

    <section class="empty-panel">
      <h2>앱을 준비 중입니다</h2>
      <p>다음 작업에서 월별 가계부와 사람별 돈 기록 기능을 연결합니다.</p>
    </section>
  </main>
</template>
```

`src/styles.css`:

```css
:root {
  color: #1f2933;
  background: #f7f4ef;
  font-family: Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  max-width: 1120px;
  margin: 0 auto 20px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #607466;
  font-size: 0.875rem;
  font-weight: 700;
}

h1,
h2,
p {
  margin-top: 0;
}

.tabs {
  display: flex;
  gap: 8px;
  max-width: 1120px;
  margin: 0 auto 16px;
}

.tab {
  min-height: 40px;
  border: 1px solid #d0d7d2;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  padding: 0 14px;
  cursor: pointer;
}

.tab.active {
  background: #1f6f5b;
  color: #ffffff;
  border-color: #1f6f5b;
}

.empty-panel {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
  border: 1px solid #d9ded9;
  border-radius: 8px;
  background: #ffffff;
}

@media (max-width: 640px) {
  .app-shell {
    padding: 16px;
  }

  .tabs {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: 의존성을 설치한다**

Run: `npm install`

Expected: `node_modules`와 `package-lock.json`이 생성된다.

- [ ] **Step 3: 빌드를 확인한다**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드가 성공한다.

- [ ] **Step 4: 커밋한다**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json src/main.ts src/App.vue src/styles.css
git commit -m "feat: scaffold vue budget app"
```

## Task 2: 도메인 타입과 계산 로직 만들기

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/categories.ts`
- Create: `src/domain/calculations.ts`
- Create: `src/domain/calculations.test.ts`

- [ ] **Step 1: 실패하는 계산 테스트를 작성한다**

`src/domain/calculations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateMonthSummary, calculatePersonBalances } from './calculations';
import type { Expense, MonthRecord, PersonMoneyRecord } from './types';

describe('calculateMonthSummary', () => {
  it('선택한 월의 수입, 지출, 남은 금액, 지출률을 계산한다', () => {
    const months: Record<string, MonthRecord> = {
      '2026-06': { month: '2026-06', income: 3000000 }
    };
    const expenses: Expense[] = [
      { id: 'e1', date: '2026-06-01', month: '2026-06', categoryId: 'lunch', amount: 12000, memo: '점심' },
      { id: 'e2', date: '2026-06-02', month: '2026-06', categoryId: 'transport', amount: 3000, memo: '버스' },
      { id: 'e3', date: '2026-07-01', month: '2026-07', categoryId: 'living', amount: 50000, memo: '다른 달' }
    ];

    const summary = calculateMonthSummary('2026-06', months, expenses);

    expect(summary.income).toBe(3000000);
    expect(summary.expenseTotal).toBe(15000);
    expect(summary.remaining).toBe(2985000);
    expect(summary.spendingRatio).toBeCloseTo(0.005);
    expect(summary.categoryTotals).toEqual({ lunch: 12000, transport: 3000 });
  });

  it('수입이 없으면 지출률을 null로 둔다', () => {
    const summary = calculateMonthSummary('2026-06', {}, [
      { id: 'e1', date: '2026-06-01', month: '2026-06', categoryId: 'lunch', amount: 12000, memo: '점심' }
    ]);

    expect(summary.income).toBe(0);
    expect(summary.expenseTotal).toBe(12000);
    expect(summary.remaining).toBe(-12000);
    expect(summary.spendingRatio).toBeNull();
  });
});

describe('calculatePersonBalances', () => {
  it('정산 완료되지 않은 기록만 사람별 미정산 금액에 반영한다', () => {
    const records: PersonMoneyRecord[] = [
      { id: 'p1', date: '2026-06-01', personName: '민수', direction: 'receivable', amount: 30000, memo: '티켓', settled: false },
      { id: 'p2', date: '2026-06-02', personName: '민수', direction: 'payable', amount: 10000, memo: '커피', settled: false },
      { id: 'p3', date: '2026-06-03', personName: '민수', direction: 'receivable', amount: 5000, memo: '정산됨', settled: true },
      { id: 'p4', date: '2026-06-04', personName: '지연', direction: 'payable', amount: 15000, memo: '저녁', settled: false }
    ];

    expect(calculatePersonBalances(records)).toEqual([
      { personName: '민수', balance: 20000 },
      { personName: '지연', balance: -15000 }
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test -- src/domain/calculations.test.ts`

Expected: `Cannot find module './calculations'` 또는 동일한 의미의 실패가 나온다.

- [ ] **Step 3: 타입과 계산 로직을 구현한다**

`src/domain/types.ts`:

```ts
export type CategoryId =
  | 'lunch'
  | 'living'
  | 'fixed'
  | 'dating'
  | 'groceries'
  | 'transport'
  | 'health'
  | 'gifts'
  | 'other';

export type PersonMoneyDirection = 'receivable' | 'payable';

export interface MonthRecord {
  month: string;
  income: number;
}

export interface Expense {
  id: string;
  date: string;
  month: string;
  categoryId: CategoryId;
  amount: number;
  memo: string;
}

export interface PersonMoneyRecord {
  id: string;
  date: string;
  personName: string;
  direction: PersonMoneyDirection;
  amount: number;
  memo: string;
  settled: boolean;
}

export interface BudgetData {
  version: 1;
  months: Record<string, MonthRecord>;
  expenses: Expense[];
  personRecords: PersonMoneyRecord[];
}
```

`src/domain/categories.ts`:

```ts
import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
}

export const categories: Category[] = [
  { id: 'lunch', label: '점심/외식' },
  { id: 'living', label: '생활비' },
  { id: 'fixed', label: '고정비' },
  { id: 'dating', label: '데이트/여가' },
  { id: 'groceries', label: '장보기/식재료' },
  { id: 'transport', label: '교통' },
  { id: 'health', label: '의료/건강' },
  { id: 'gifts', label: '선물/경조사' },
  { id: 'other', label: '기타' }
];
```

`src/domain/calculations.ts`:

```ts
import type { BudgetData, Expense, MonthRecord, PersonMoneyRecord } from './types';

export interface MonthSummary {
  income: number;
  expenseTotal: number;
  remaining: number;
  spendingRatio: number | null;
  categoryTotals: Record<string, number>;
}

export interface PersonBalance {
  personName: string;
  balance: number;
}

export const createEmptyBudgetData = (): BudgetData => ({
  version: 1,
  months: {},
  expenses: [],
  personRecords: []
});

export const getCurrentMonth = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const toMonth = (date: string): string => date.slice(0, 7);

export const calculateMonthSummary = (
  month: string,
  months: Record<string, MonthRecord>,
  expenses: Expense[]
): MonthSummary => {
  const income = months[month]?.income ?? 0;
  const monthExpenses = expenses.filter((expense) => expense.month === month);
  const expenseTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryTotals = monthExpenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.categoryId] = (totals[expense.categoryId] ?? 0) + expense.amount;
    return totals;
  }, {});

  return {
    income,
    expenseTotal,
    remaining: income - expenseTotal,
    spendingRatio: income > 0 ? expenseTotal / income : null,
    categoryTotals
  };
};

export const calculatePersonBalances = (records: PersonMoneyRecord[]): PersonBalance[] => {
  const balances = records.reduce<Record<string, number>>((totals, record) => {
    if (record.settled) {
      return totals;
    }

    const signedAmount = record.direction === 'receivable' ? record.amount : -record.amount;
    totals[record.personName] = (totals[record.personName] ?? 0) + signedAmount;
    return totals;
  }, {});

  return Object.entries(balances)
    .map(([personName, balance]) => ({ personName, balance }))
    .filter((entry) => entry.balance !== 0)
    .sort((a, b) => a.personName.localeCompare(b.personName, 'ko'));
};
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npm run test -- src/domain/calculations.test.ts`

Expected: `2 passed` 이상의 성공 결과가 나온다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/domain/types.ts src/domain/categories.ts src/domain/calculations.ts src/domain/calculations.test.ts
git commit -m "feat: add budget domain calculations"
```

## Task 3: localStorage 저장소와 백업/복원 만들기

**Files:**
- Create: `src/storage/budgetRepository.ts`
- Create: `src/storage/localStorageBudgetRepository.ts`
- Create: `src/storage/exportImport.ts`
- Create: `src/storage/exportImport.test.ts`

- [ ] **Step 1: 백업/복원 실패 테스트를 작성한다**

`src/storage/exportImport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';
import type { BudgetData } from '../domain/types';

describe('exportImport', () => {
  it('BudgetData를 보기 좋은 JSON 문자열로 변환한다', () => {
    const data: BudgetData = {
      version: 1,
      months: { '2026-06': { month: '2026-06', income: 3000000 } },
      expenses: [],
      personRecords: []
    };

    expect(stringifyBudgetData(data)).toContain('"version": 1');
    expect(stringifyBudgetData(data)).toContain('"2026-06"');
  });

  it('정상 JSON을 BudgetData로 복원한다', () => {
    const parsed = parseBudgetJson('{"version":1,"months":{},"expenses":[],"personRecords":[]}');

    expect(parsed).toEqual({ version: 1, months: {}, expenses: [], personRecords: [] });
  });

  it('지원하지 않는 구조는 거부한다', () => {
    expect(() => parseBudgetJson('{"version":2}')).toThrow('지원하지 않는 백업 파일입니다.');
  });
});
```

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test -- src/storage/exportImport.test.ts`

Expected: `Cannot find module './exportImport'` 또는 동일한 의미의 실패가 나온다.

- [ ] **Step 3: 저장소와 백업/복원 코드를 구현한다**

`src/storage/budgetRepository.ts`:

```ts
import type { BudgetData } from '../domain/types';

export interface BudgetRepository {
  load(): BudgetData;
  save(data: BudgetData): void;
}
```

`src/storage/localStorageBudgetRepository.ts`:

```ts
import { createEmptyBudgetData } from '../domain/calculations';
import type { BudgetData } from '../domain/types';
import { parseBudgetJson, stringifyBudgetData } from './exportImport';
import type { BudgetRepository } from './budgetRepository';

const STORAGE_KEY = 'local-budget-app:v1';

export class LocalStorageBudgetRepository implements BudgetRepository {
  load(): BudgetData {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyBudgetData();
    }

    try {
      return parseBudgetJson(raw);
    } catch {
      return createEmptyBudgetData();
    }
  }

  save(data: BudgetData): void {
    window.localStorage.setItem(STORAGE_KEY, stringifyBudgetData(data));
  }
}
```

`src/storage/exportImport.ts`:

```ts
import type { BudgetData } from '../domain/types';

export const stringifyBudgetData = (data: BudgetData): string => JSON.stringify(data, null, 2);

export const parseBudgetJson = (raw: string): BudgetData => {
  const parsed = JSON.parse(raw) as Partial<BudgetData>;

  if (
    parsed.version !== 1 ||
    typeof parsed.months !== 'object' ||
    parsed.months === null ||
    !Array.isArray(parsed.expenses) ||
    !Array.isArray(parsed.personRecords)
  ) {
    throw new Error('지원하지 않는 백업 파일입니다.');
  }

  return {
    version: 1,
    months: parsed.months as BudgetData['months'],
    expenses: parsed.expenses,
    personRecords: parsed.personRecords
  };
};
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npm run test -- src/storage/exportImport.test.ts`

Expected: `3 passed` 이상의 성공 결과가 나온다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/storage/budgetRepository.ts src/storage/localStorageBudgetRepository.ts src/storage/exportImport.ts src/storage/exportImport.test.ts
git commit -m "feat: add local budget storage"
```

## Task 4: Pinia store 만들기

**Files:**
- Create: `src/stores/budgetStore.ts`

- [ ] **Step 1: store를 구현한다**

`src/stores/budgetStore.ts`:

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { calculateMonthSummary, calculatePersonBalances, getCurrentMonth, toMonth } from '../domain/calculations';
import type { BudgetData, CategoryId, PersonMoneyDirection } from '../domain/types';
import { LocalStorageBudgetRepository } from '../storage/localStorageBudgetRepository';
import { parseBudgetJson, stringifyBudgetData } from '../storage/exportImport';

const repository = new LocalStorageBudgetRepository();
const newId = (): string => crypto.randomUUID();

export const useBudgetStore = defineStore('budget', () => {
  const selectedMonth = ref(getCurrentMonth());
  const data = ref<BudgetData>(repository.load());

  const monthSummary = computed(() =>
    calculateMonthSummary(selectedMonth.value, data.value.months, data.value.expenses)
  );
  const monthExpenses = computed(() =>
    data.value.expenses
      .filter((expense) => expense.month === selectedMonth.value)
      .sort((a, b) => b.date.localeCompare(a.date))
  );
  const personBalances = computed(() => calculatePersonBalances(data.value.personRecords));

  const persist = (): void => repository.save(data.value);

  const setSelectedMonth = (month: string): void => {
    selectedMonth.value = month;
  };

  const setIncome = (income: number): void => {
    data.value.months[selectedMonth.value] = { month: selectedMonth.value, income };
    persist();
  };

  const addExpense = (payload: { date: string; categoryId: CategoryId; amount: number; memo: string }): void => {
    data.value.expenses.push({
      id: newId(),
      date: payload.date,
      month: toMonth(payload.date),
      categoryId: payload.categoryId,
      amount: payload.amount,
      memo: payload.memo.trim()
    });
    persist();
  };

  const deleteExpense = (id: string): void => {
    data.value.expenses = data.value.expenses.filter((expense) => expense.id !== id);
    persist();
  };

  const addPersonRecord = (payload: {
    date: string;
    personName: string;
    direction: PersonMoneyDirection;
    amount: number;
    memo: string;
  }): void => {
    data.value.personRecords.push({
      id: newId(),
      date: payload.date,
      personName: payload.personName.trim(),
      direction: payload.direction,
      amount: payload.amount,
      memo: payload.memo.trim(),
      settled: false
    });
    persist();
  };

  const togglePersonRecordSettled = (id: string): void => {
    const record = data.value.personRecords.find((item) => item.id === id);
    if (record) {
      record.settled = !record.settled;
      persist();
    }
  };

  const exportJson = (): string => stringifyBudgetData(data.value);

  const importJson = (raw: string): void => {
    data.value = parseBudgetJson(raw);
    persist();
  };

  return {
    selectedMonth,
    data,
    monthSummary,
    monthExpenses,
    personBalances,
    setSelectedMonth,
    setIncome,
    addExpense,
    deleteExpense,
    addPersonRecord,
    togglePersonRecordSettled,
    exportJson,
    importJson
  };
});
```

- [ ] **Step 2: 빌드를 확인한다**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드가 성공한다.

- [ ] **Step 3: 커밋한다**

```bash
git add src/stores/budgetStore.ts
git commit -m "feat: add budget store"
```

## Task 5: 가계부 탭 구현하기

**Files:**
- Create: `src/components/SummaryCard.vue`
- Create: `src/components/LedgerTab.vue`
- Modify: `src/App.vue`
- Modify: `src/styles.css`

- [ ] **Step 1: 요약 카드와 가계부 탭을 구현한다**

`src/components/SummaryCard.vue`:

```vue
<template>
  <article class="summary-card">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>
```

`src/components/LedgerTab.vue`:

```vue
<template>
  <section class="screen-grid">
    <form class="panel form-panel" @submit.prevent="submitExpense">
      <h2>월별 가계부</h2>
      <label>
        월 선택
        <input v-model="store.selectedMonth" type="month" />
      </label>
      <label>
        월 수입
        <input v-model.number="incomeDraft" type="number" min="0" inputmode="numeric" />
      </label>
      <button type="button" class="primary-button" @click="store.setIncome(incomeDraft)">수입 저장</button>

      <hr />

      <label>
        날짜
        <input v-model="expenseForm.date" type="date" required />
      </label>
      <label>
        카테고리
        <select v-model="expenseForm.categoryId">
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.label }}
          </option>
        </select>
      </label>
      <label>
        금액
        <input v-model.number="expenseForm.amount" type="number" min="1" inputmode="numeric" required />
      </label>
      <label>
        메모
        <input v-model="expenseForm.memo" type="text" placeholder="예: 회사 근처 점심" />
      </label>
      <button type="submit" class="primary-button">지출 추가</button>
    </form>

    <section class="content-stack">
      <div class="summary-grid">
        <SummaryCard label="수입" :value="formatWon(store.monthSummary.income)" />
        <SummaryCard label="지출" :value="formatWon(store.monthSummary.expenseTotal)" />
        <SummaryCard label="남은 금액" :value="formatWon(store.monthSummary.remaining)" />
        <SummaryCard label="지출률" :value="formatRatio(store.monthSummary.spendingRatio)" />
      </div>

      <section class="panel">
        <h2>카테고리별 지출</h2>
        <ul class="category-list">
          <li v-for="category in visibleCategoryTotals" :key="category.id">
            <span>{{ category.label }}</span>
            <strong>{{ formatWon(category.amount) }}</strong>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h2>지출 목록</h2>
        <ul class="record-list">
          <li v-for="expense in store.monthExpenses" :key="expense.id">
            <div>
              <strong>{{ categoryLabel(expense.categoryId) }}</strong>
              <span>{{ expense.date }} · {{ expense.memo || '메모 없음' }}</span>
            </div>
            <div class="record-actions">
              <strong>{{ formatWon(expense.amount) }}</strong>
              <button type="button" class="ghost-button" @click="store.deleteExpense(expense.id)">삭제</button>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import SummaryCard from './SummaryCard.vue';
import { categories } from '../domain/categories';
import type { CategoryId } from '../domain/types';
import { getCurrentMonth } from '../domain/calculations';
import { useBudgetStore } from '../stores/budgetStore';

const store = useBudgetStore();
const today = new Date().toISOString().slice(0, 10);
const incomeDraft = ref(store.monthSummary.income);
const expenseForm = reactive({
  date: today,
  categoryId: 'lunch' as CategoryId,
  amount: 0,
  memo: ''
});

watch(
  () => store.selectedMonth,
  () => {
    incomeDraft.value = store.monthSummary.income;
  }
);

const formatWon = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;
const formatRatio = (ratio: number | null): string => (ratio === null ? '-' : `${Math.round(ratio * 100)}%`);
const categoryLabel = (id: CategoryId): string => categories.find((category) => category.id === id)?.label ?? id;

const visibleCategoryTotals = computed(() =>
  categories
    .map((category) => ({
      ...category,
      amount: store.monthSummary.categoryTotals[category.id] ?? 0
    }))
    .filter((category) => category.amount > 0)
);

const submitExpense = (): void => {
  if (expenseForm.amount <= 0) {
    return;
  }

  store.addExpense({ ...expenseForm });
  store.setSelectedMonth(getCurrentMonth(new Date(`${expenseForm.date}T00:00:00`)));
  expenseForm.amount = 0;
  expenseForm.memo = '';
};
</script>
```

- [ ] **Step 2: App에서 탭을 연결하고 스타일을 확장한다**

`src/App.vue`:

```vue
<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">개인 기록용</p>
        <h1>로컬 가계부</h1>
      </div>
    </header>

    <nav class="tabs" aria-label="주요 화면">
      <button type="button" class="tab active">가계부</button>
      <button type="button" class="tab">사람별 돈 기록</button>
    </nav>

    <LedgerTab />
  </main>
</template>

<script setup lang="ts">
import LedgerTab from './components/LedgerTab.vue';
</script>
```

Append to `src/styles.css`:

```css
.screen-grid {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
  max-width: 1120px;
  margin: 0 auto;
}

.panel {
  border: 1px solid #d9ded9;
  border-radius: 8px;
  background: #ffffff;
  padding: 18px;
}

.form-panel {
  display: grid;
  align-content: start;
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
}

input,
select {
  min-height: 42px;
  width: 100%;
  border: 1px solid #cbd5d1;
  border-radius: 8px;
  padding: 0 12px;
  background: #ffffff;
  color: #1f2933;
}

hr {
  width: 100%;
  border: 0;
  border-top: 1px solid #e2e8e5;
}

.primary-button,
.ghost-button {
  min-height: 40px;
  border-radius: 8px;
  cursor: pointer;
}

.primary-button {
  border: 1px solid #1f6f5b;
  background: #1f6f5b;
  color: #ffffff;
  font-weight: 800;
}

.ghost-button {
  border: 1px solid #cbd5d1;
  background: #ffffff;
  color: #334155;
}

.content-stack {
  display: grid;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  min-height: 96px;
  border: 1px solid #d9ded9;
  border-radius: 8px;
  background: #ffffff;
  padding: 14px;
  display: grid;
  align-content: space-between;
}

.summary-card span,
.record-list span {
  color: #64748b;
  font-size: 0.875rem;
}

.summary-card strong {
  font-size: 1.25rem;
}

.category-list,
.record-list {
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.category-list li,
.record-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #eef2ef;
  padding-top: 10px;
}

.record-list li > div {
  display: grid;
  gap: 4px;
}

.record-actions {
  justify-items: end;
}

@media (max-width: 860px) {
  .screen-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: 빌드를 확인한다**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드가 성공한다.

- [ ] **Step 4: 커밋한다**

```bash
git add src/components/SummaryCard.vue src/components/LedgerTab.vue src/App.vue src/styles.css
git commit -m "feat: add household ledger tab"
```

## Task 6: 사람별 돈 기록 탭 구현하기

**Files:**
- Create: `src/components/PersonMoneyTab.vue`
- Modify: `src/App.vue`
- Modify: `src/styles.css`

- [ ] **Step 1: 사람별 돈 기록 탭을 구현한다**

`src/components/PersonMoneyTab.vue`:

```vue
<template>
  <section class="screen-grid">
    <form class="panel form-panel" @submit.prevent="submitRecord">
      <h2>사람별 돈 기록</h2>
      <label>
        날짜
        <input v-model="form.date" type="date" required />
      </label>
      <label>
        사람
        <input v-model="form.personName" type="text" required placeholder="예: 민수" />
      </label>
      <label>
        방향
        <select v-model="form.direction">
          <option value="receivable">받을 돈</option>
          <option value="payable">갚을 돈</option>
        </select>
      </label>
      <label>
        금액
        <input v-model.number="form.amount" type="number" min="1" inputmode="numeric" required />
      </label>
      <label>
        메모
        <input v-model="form.memo" type="text" placeholder="예: 영화 티켓" />
      </label>
      <button type="submit" class="primary-button">기록 추가</button>
    </form>

    <section class="content-stack">
      <section class="panel">
        <h2>현재 미정산</h2>
        <ul class="category-list">
          <li v-for="balance in store.personBalances" :key="balance.personName">
            <span>{{ balance.personName }}</span>
            <strong :class="balance.balance > 0 ? 'positive' : 'negative'">{{ formatBalance(balance.balance) }}</strong>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h2>전체 거래 기록</h2>
        <ul class="record-list">
          <li v-for="record in orderedRecords" :key="record.id" :class="{ muted: record.settled }">
            <div>
              <strong>{{ record.personName }} · {{ record.direction === 'receivable' ? '받을 돈' : '갚을 돈' }}</strong>
              <span>{{ record.date }} · {{ record.memo || '메모 없음' }}</span>
            </div>
            <div class="record-actions">
              <strong>{{ formatWon(record.amount) }}</strong>
              <button type="button" class="ghost-button" @click="store.togglePersonRecordSettled(record.id)">
                {{ record.settled ? '정산 취소' : '정산 완료' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { PersonMoneyDirection } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';

const store = useBudgetStore();
const form = reactive({
  date: new Date().toISOString().slice(0, 10),
  personName: '',
  direction: 'receivable' as PersonMoneyDirection,
  amount: 0,
  memo: ''
});

const orderedRecords = computed(() =>
  [...store.data.personRecords].sort((a, b) => b.date.localeCompare(a.date))
);

const formatWon = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;
const formatBalance = (amount: number): string =>
  amount > 0 ? `받을 돈 ${formatWon(amount)}` : `갚을 돈 ${formatWon(Math.abs(amount))}`;

const submitRecord = (): void => {
  if (!form.personName.trim() || form.amount <= 0) {
    return;
  }

  store.addPersonRecord({ ...form });
  form.personName = '';
  form.amount = 0;
  form.memo = '';
};
</script>
```

- [ ] **Step 2: App에 실제 탭 전환을 연결한다**

`src/App.vue`:

```vue
<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">개인 기록용</p>
        <h1>로컬 가계부</h1>
      </div>
    </header>

    <nav class="tabs" aria-label="주요 화면">
      <button type="button" class="tab" :class="{ active: activeTab === 'ledger' }" @click="activeTab = 'ledger'">
        가계부
      </button>
      <button type="button" class="tab" :class="{ active: activeTab === 'people' }" @click="activeTab = 'people'">
        사람별 돈 기록
      </button>
    </nav>

    <LedgerTab v-if="activeTab === 'ledger'" />
    <PersonMoneyTab v-else />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LedgerTab from './components/LedgerTab.vue';
import PersonMoneyTab from './components/PersonMoneyTab.vue';

const activeTab = ref<'ledger' | 'people'>('ledger');
</script>
```

Append to `src/styles.css`:

```css
.positive {
  color: #166534;
}

.negative {
  color: #b42318;
}

.muted {
  opacity: 0.62;
}
```

- [ ] **Step 3: 빌드를 확인한다**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드가 성공한다.

- [ ] **Step 4: 커밋한다**

```bash
git add src/components/PersonMoneyTab.vue src/App.vue src/styles.css
git commit -m "feat: add person money records"
```

## Task 7: JSON 내보내기/가져오기 UI 추가하기

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`

- [ ] **Step 1: App에 백업/복원 UI를 추가한다**

`src/App.vue`의 `<header class="app-header">`를 다음으로 교체한다:

```vue
<header class="app-header">
  <div>
    <p class="eyebrow">개인 기록용</p>
    <h1>로컬 가계부</h1>
  </div>
  <div class="backup-actions">
    <button type="button" class="ghost-button" @click="downloadBackup">내보내기</button>
    <label class="file-button">
      가져오기
      <input type="file" accept="application/json" @change="importBackup" />
    </label>
  </div>
</header>
```

`src/App.vue`의 `<script setup lang="ts">`를 다음으로 교체한다:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import LedgerTab from './components/LedgerTab.vue';
import PersonMoneyTab from './components/PersonMoneyTab.vue';
import { useBudgetStore } from './stores/budgetStore';

const store = useBudgetStore();
const activeTab = ref<'ledger' | 'people'>('ledger');

const downloadBackup = (): void => {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `local-budget-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const importBackup = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  store.importJson(text);
  input.value = '';
};
</script>
```

Append to `src/styles.css`:

```css
.backup-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.file-button {
  min-height: 40px;
  border: 1px solid #cbd5d1;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.file-button input {
  display: none;
}

@media (max-width: 640px) {
  .app-header {
    flex-direction: column;
  }

  .backup-actions {
    justify-content: stretch;
  }

  .backup-actions > * {
    flex: 1;
    justify-content: center;
  }
}
```

- [ ] **Step 2: 빌드를 확인한다**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드가 성공한다.

- [ ] **Step 3: 커밋한다**

```bash
git add src/App.vue src/styles.css
git commit -m "feat: add backup import export"
```

## Task 8: 전체 검증과 로컬 실행

**Files:**
- No file changes expected

- [ ] **Step 1: 전체 테스트를 실행한다**

Run: `npm run test`

Expected: 모든 Vitest 테스트가 통과한다.

- [ ] **Step 2: 프로덕션 빌드를 실행한다**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드가 성공한다.

- [ ] **Step 3: 개발 서버를 실행한다**

Run: `npm run dev`

Expected: Vite 개발 서버가 `http://127.0.0.1:5173/` 또는 사용 가능한 다음 포트에서 실행된다.

- [ ] **Step 4: 브라우저에서 수동 검증한다**

검증 항목:

- 월 수입을 저장하면 수입 카드가 갱신된다.
- 지출을 추가하면 지출, 남은 금액, 카테고리 합계가 갱신된다.
- 다른 월의 지출은 현재 월 목록에 보이지 않는다.
- 사람별 돈 기록을 추가하면 미정산 요약이 갱신된다.
- 정산 완료 버튼을 눌러도 전체 거래 기록에는 남아 있고 미정산 요약에서 빠진다.
- 새로고침 후에도 데이터가 유지된다.
- 내보내기 파일이 다운로드된다.
- 가져오기 후 화면에 데이터가 복원된다.
- 데스크톱 폭과 모바일 폭에서 텍스트와 버튼이 겹치지 않는다.

- [ ] **Step 5: 검증 결과를 커밋하지 않고 보고한다**

검증만 수행했으면 추가 커밋은 만들지 않는다. 검증 중 발견한 수정이 있으면 해당 파일만 수정하고 테스트를 다시 통과시킨 뒤 별도 커밋한다.

## Self-Review

- Spec coverage: 월별 가계부, 수입 입력, 카테고리별 합계, 사람별 돈 기록, 정산 완료 후 기록 보존, localStorage 저장, JSON 백업/복원, 모바일/데스크톱 검증이 모두 태스크에 포함되어 있다.
- Placeholder scan: 비어 있는 구현 지시나 자리표시자 표현을 사용하지 않았다.
- Type consistency: `BudgetData`, `Expense`, `MonthRecord`, `PersonMoneyRecord`, `CategoryId`, `PersonMoneyDirection` 이름이 태스크 전반에서 일관된다.
