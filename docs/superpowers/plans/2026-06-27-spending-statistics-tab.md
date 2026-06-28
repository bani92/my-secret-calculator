# 지출 통계 탭 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `통계` 탭을 추가해서 년도별 총 지출과 선택 년도의 월별 지출 흐름을 CSS 막대 그래프로 보여준다.

**Architecture:** 기존 `BudgetData.expenses`에서 지출 통계를 파생 계산한다. 계산 로직은 테스트 가능한 도메인 함수로 분리하고, `StatisticsTab.vue`는 선택 년도 상태와 렌더링만 담당한다.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, CSS 막대 그래프

---

### Task 1: 지출 통계 계산 함수

**Files:**
- Modify: `src/domain/calculations.ts`
- Modify: `src/domain/calculations.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/calculations.test.ts`에 다음 테스트를 추가한다.

```ts
it('builds yearly and monthly expense statistics from expenses only', () => {
  const expenses: Expense[] = [
    {
      id: 'expense-1',
      date: '2026-06-10',
      month: '2026-06',
      categoryId: 'lunch',
      amount: 20_000,
      memo: ''
    },
    {
      id: 'expense-2',
      date: '2026-06-12',
      month: '2026-06',
      categoryId: 'living',
      amount: 30_000,
      memo: ''
    },
    {
      id: 'expense-3',
      date: '2025-04-02',
      month: '2025-04',
      categoryId: 'transport',
      amount: 12_000,
      memo: ''
    }
  ];

  expect(calculateYearlyExpenseStats(expenses)).toEqual([
    { year: '2026', total: 50_000 },
    { year: '2025', total: 12_000 }
  ]);

  expect(calculateMonthlyExpenseStats('2026', expenses)).toEqual([
    { month: '2026-01', label: '1월', total: 0 },
    { month: '2026-02', label: '2월', total: 0 },
    { month: '2026-03', label: '3월', total: 0 },
    { month: '2026-04', label: '4월', total: 0 },
    { month: '2026-05', label: '5월', total: 0 },
    { month: '2026-06', label: '6월', total: 50_000 },
    { month: '2026-07', label: '7월', total: 0 },
    { month: '2026-08', label: '8월', total: 0 },
    { month: '2026-09', label: '9월', total: 0 },
    { month: '2026-10', label: '10월', total: 0 },
    { month: '2026-11', label: '11월', total: 0 },
    { month: '2026-12', label: '12월', total: 0 }
  ]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/domain/calculations.test.ts`

Expected: `calculateYearlyExpenseStats` 또는 `calculateMonthlyExpenseStats`가 없어서 실패한다.

- [ ] **Step 3: 최소 구현**

`src/domain/calculations.ts`에 `ExpenseStat`, `MonthlyExpenseStat`, `calculateYearlyExpenseStats`, `calculateMonthlyExpenseStats`를 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- src/domain/calculations.test.ts`

Expected: 계산 테스트가 통과한다.

### Task 2: 스토어에 통계 파생 값 연결

**Files:**
- Modify: `src/stores/budgetStore.ts`
- Modify: `src/stores/budgetStore.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/stores/budgetStore.test.ts`에 지출 추가 후 `yearlyExpenseStats`와 `getMonthlyExpenseStats('2026')`가 예상값을 반환하는 테스트를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/stores/budgetStore.test.ts`

Expected: 스토어 반환값이 없어서 실패한다.

- [ ] **Step 3: 최소 구현**

`budgetStore`가 다음 값을 반환하게 한다.

- `yearlyExpenseStats`
- `expenseYears`
- `getMonthlyExpenseStats(year: string)`

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- src/stores/budgetStore.test.ts`

Expected: 스토어 테스트가 통과한다.

### Task 3: 통계 탭 UI 추가

**Files:**
- Create: `src/components/StatisticsTab.vue`
- Modify: `src/App.vue`
- Modify: `src/App.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: 실패하는 앱 테스트 작성**

`src/App.test.ts`에 다음 동작을 검증하는 테스트를 추가한다.

- `통계` 탭이 보인다.
- 지출이 없으면 빈 상태가 보인다.
- 지출을 등록한 뒤 `통계` 탭에서 년도별 총 지출과 월별 그래프 라벨이 보인다.
- 다른 년도를 누르면 월별 그래프 기준이 바뀐다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/App.test.ts`

Expected: `통계` 탭 또는 `StatisticsTab`이 없어서 실패한다.

- [ ] **Step 3: 최소 구현**

`StatisticsTab.vue`를 만들고 `App.vue`의 탭 목록에 `통계`를 추가한다. CSS 막대 그래프는 기존 패널과 버튼 스타일을 재사용하되, `stat-chart`, `stat-bar`, `stat-bar-fill` 계열 클래스를 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- src/App.test.ts`

Expected: 앱 테스트가 통과한다.

### Task 4: 전체 검증과 브라우저 확인

**Files:**
- Verify only

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm run test`

Expected: 모든 테스트 통과

- [ ] **Step 2: 빌드 실행**

Run: `npm run build`

Expected: TypeScript 검사와 Vite 빌드 통과

- [ ] **Step 3: 로컬 브라우저 확인**

`http://127.0.0.1:5173/`에서 `통계` 탭을 열고 다음을 확인한다.

- 지출 데이터가 없을 때 빈 상태가 보인다.
- 지출 데이터가 있을 때 년도별 지출 그래프가 보인다.
- 년도를 클릭하면 월별 그래프가 바뀐다.

- [ ] **Step 4: 최종 정리**

`git status --short`로 변경 파일을 확인하고, 의도한 파일만 변경되었는지 검토한다.
