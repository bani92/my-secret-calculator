# 항목별 통계 필터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `통계` 탭 상단에 `지출 항목` 콤보박스를 추가해서 전체 지출 또는 특정 항목 기준으로 년도별/월별 지출 통계를 전환한다.

**Architecture:** 저장 구조와 Pinia store API는 변경하지 않고, `StatisticsTab.vue` 안에서 선택된 카테고리에 따라 `store.data.expenses`를 필터링한다. 기존 도메인 계산 함수 `calculateYearlyExpenseStats`와 `calculateMonthlyExpenseStats`에 필터링된 배열을 전달해서 그래프와 요약 카드를 같은 기준으로 갱신한다.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, @vue/test-utils, CSS

---

## 파일 구조

- Modify: `src/App.test.ts` - 앱 통합 흐름에서 통계 항목 필터의 기본값, 전체 통계, 특정 항목 통계, 빈 상태를 검증한다.
- Modify: `src/components/StatisticsTab.vue` - 필터 select, 필터링 computed, 선택 년도 보정, 항목별 빈 상태를 추가한다.
- Modify: `src/styles.css` - 필터 패널의 작은 레이아웃 보조 클래스만 추가한다.

## 구현 기준

- 기본값은 `전체 지출`이다.
- 필터 옵션은 `전체 지출` 다음에 `src/domain/categories.ts`의 `categories` 순서를 그대로 사용한다.
- `all`은 전체 지출, 그 외 값은 `CategoryId`로 처리한다.
- 특정 항목에 지출이 전혀 없으면 `선택한 항목의 지출 기록이 없습니다.`를 보여준다.
- 전체 지출 데이터가 아예 없으면 기존 빈 상태 `아직 지출 통계가 없습니다`를 유지한다.
- 특정 항목 필터는 localStorage에 별도로 저장하지 않는다.

### Task 1: 항목 필터 앱 테스트 추가

**Files:**
- Modify: `src/App.test.ts`

- [ ] **Step 1: 실패하는 통합 테스트를 작성한다**

`src/App.test.ts`의 기존 `shows spending statistics by year and selected year months` 테스트 아래에 다음 테스트를 추가한다.

```ts
  test('filters spending statistics by expense category', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-10');
    await wrapper.get('[aria-label="지출 분류"]').setValue('lunch');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-12');
    await wrapper.get('[aria-label="지출 분류"]').setValue('transport');
    await wrapper.get('[aria-label="지출 금액"]').setValue('7000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('버스');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    await wrapper.get('[aria-label="지출 날짜"]').setValue('2025-04-02');
    await wrapper.get('[aria-label="지출 분류"]').setValue('lunch');
    await wrapper.get('[aria-label="지출 금액"]').setValue('30000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('작년 점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    await wrapper.findAll('button').find((button) => button.text() === '통계')?.trigger('click');

    const categoryFilter = wrapper.get<HTMLSelectElement>('[aria-label="지출 항목"]');

    expect(categoryFilter.element.value).toBe('all');
    expect(categoryFilter.text()).toContain('전체 지출');
    expect(categoryFilter.text()).toContain('점심/외식');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('27,000원');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2025');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('30,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('27,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('27,000원');

    await categoryFilter.setValue('lunch');

    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('20,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('총 지출');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('20,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('6월 · 20,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('6월');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('20,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).not.toContain('27,000원');

    await categoryFilter.setValue('health');

    expect(wrapper.text()).toContain('선택한 항목의 지출 기록이 없습니다.');
    expect(wrapper.find('[data-testid="yearly-expense-chart"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="statistics-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="monthly-expense-chart"]').exists()).toBe(false);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/App.test.ts`

Expected: `Unable to get [aria-label="지출 항목"]` 또는 같은 의미로 필터 select가 없어서 실패한다.

### Task 2: `StatisticsTab.vue`에 필터 상태와 UI 구현

**Files:**
- Modify: `src/components/StatisticsTab.vue`

- [ ] **Step 1: script import를 교체한다**

`src/components/StatisticsTab.vue`의 import 영역을 다음처럼 바꾼다.

```ts
import { computed, ref, watch } from 'vue';

import SummaryCard from './SummaryCard.vue';
import { categories } from '../domain/categories';
import { calculateMonthlyExpenseStats, calculateYearlyExpenseStats } from '../domain/calculations';
import type { CategoryId } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';
```

- [ ] **Step 2: 필터 타입과 computed를 추가한다**

`const store = useBudgetStore();` 아래의 기존 통계 computed 블록을 다음 코드로 교체한다.

```ts
type CategoryFilter = 'all' | CategoryId;

const store = useBudgetStore();
const selectedCategoryFilter = ref<CategoryFilter>('all');

const filteredExpenses = computed(() =>
  selectedCategoryFilter.value === 'all'
    ? store.data.expenses
    : store.data.expenses.filter((expense) => expense.categoryId === selectedCategoryFilter.value)
);
const yearlyExpenseStats = computed(() => calculateYearlyExpenseStats(filteredExpenses.value));
const expenseYears = computed(() => yearlyExpenseStats.value.map((stat) => stat.year));
const selectedYear = ref(expenseYears.value[0] ?? new Date().getFullYear().toString());

const monthlyStats = computed(() => calculateMonthlyExpenseStats(selectedYear.value, filteredExpenses.value));
const maxYearTotal = computed(() => Math.max(...yearlyExpenseStats.value.map((stat) => stat.total), 0));
const maxMonthTotal = computed(() => Math.max(...monthlyStats.value.map((stat) => stat.total), 0));
const selectedYearTotal = computed(
  () => yearlyExpenseStats.value.find((stat) => stat.year === selectedYear.value)?.total ?? 0
);
const spendingMonths = computed(() => monthlyStats.value.filter((stat) => stat.total > 0));
const selectedYearAverage = computed(() =>
  spendingMonths.value.length === 0 ? 0 : Math.round(selectedYearTotal.value / spendingMonths.value.length)
);
const highestMonthTotal = computed(() => Math.max(...monthlyStats.value.map((stat) => stat.total), 0));
const highestMonths = computed(() =>
  highestMonthTotal.value > 0 ? monthlyStats.value.filter((stat) => stat.total === highestMonthTotal.value) : []
);
const highestMonthLabel = computed(() => {
  if (highestMonths.value.length === 0) {
    return '-';
  }

  const [firstMonth] = highestMonths.value;
  const tieSuffix = highestMonths.value.length > 1 ? ` 외 ${highestMonths.value.length - 1}개월` : '';

  return `${firstMonth.label}${tieSuffix} · ${formatWon(highestMonthTotal.value)}`;
});
```

- [ ] **Step 3: 선택 년도 watch 기준을 바꾼다**

기존 `watch(() => store.expenseYears, ...)` 블록을 다음 코드로 교체한다.

```ts
watch(
  expenseYears,
  (years) => {
    if (years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0];
    }
  },
  { immediate: true }
);
```

- [ ] **Step 4: template에 필터 패널과 항목 빈 상태를 추가한다**

`<template v-else>` 바로 아래에 다음 필터 패널을 추가한다.

```vue
      <section class="panel statistics-filter-panel">
        <div class="section-heading compact">
          <span>통계 기준</span>
          <h2>지출 항목</h2>
        </div>

        <label class="statistics-filter-field">
          지출 항목
          <select v-model="selectedCategoryFilter" aria-label="지출 항목">
            <option value="all">전체 지출</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.label }}
            </option>
          </select>
        </label>
      </section>
```

필터 패널 아래의 기존 년도별/요약/월별 섹션 3개를 다음 wrapper로 감싼다.

```vue
      <section v-if="expenseYears.length === 0" class="panel">
        <p class="empty-copy">선택한 항목의 지출 기록이 없습니다.</p>
      </section>

      <template v-else>
        <section class="panel">
          <div class="section-heading compact">
            <span>년도별</span>
            <h2>년도별 총 지출</h2>
          </div>

          <div class="yearly-stat-chart" data-testid="yearly-expense-chart" aria-label="년도별 총 지출">
            <button
              v-for="stat in yearlyExpenseStats"
              :key="stat.year"
              type="button"
              class="year-stat-row"
              :class="{ active: selectedYear === stat.year }"
              data-testid="stat-year"
              :aria-label="`${stat.year}년 총 지출 ${formatWon(stat.total)}`"
              @click="selectedYear = stat.year"
            >
              <span class="stat-label">{{ stat.year }}</span>
              <span class="stat-track">
                <span class="stat-fill" :style="{ width: barWidth(stat.total, maxYearTotal) }"></span>
              </span>
              <strong>{{ formatWon(stat.total) }}</strong>
            </button>
          </div>
        </section>

        <section class="summary-grid" data-testid="statistics-summary" aria-label="선택 년도 지출 요약">
          <SummaryCard label="총 지출" :value="formatWon(selectedYearTotal)" />
          <SummaryCard label="지출월 평균" :value="formatWon(selectedYearAverage)" />
          <SummaryCard label="최고 지출 월" :value="highestMonthLabel" />
        </section>

        <section class="panel">
          <div class="section-heading compact">
            <span>{{ selectedYear }}</span>
            <h2>월별 지출 흐름</h2>
          </div>

          <div class="monthly-stat-chart" data-testid="monthly-expense-chart" aria-label="월별 지출 흐름">
            <div
              v-for="stat in monthlyStats"
              :key="stat.month"
              class="month-stat-row"
              :class="{ highlight: stat.total > 0 && stat.total === highestMonthTotal }"
              :aria-label="`${stat.label} 지출 ${formatWon(stat.total)}`"
            >
              <span class="stat-label">{{ stat.label }}</span>
              <span class="stat-track">
                <span class="stat-fill" :style="{ width: barWidth(stat.total, maxMonthTotal) }"></span>
              </span>
              <strong>{{ formatWon(stat.total) }}</strong>
            </div>
          </div>
        </section>
      </template>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/App.test.ts`

Expected: `App.test.ts`의 모든 테스트가 통과한다.

### Task 3: 필터 패널 스타일 보강

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 필터 패널 스타일을 추가한다**

`src/styles.css`에서 `.statistics-layout .summary-grid` 규칙 아래에 다음 CSS를 추가한다.

```css
.statistics-filter-panel {
  display: grid;
  grid-template-columns: minmax(180px, 0.4fr) minmax(220px, 0.6fr);
  align-items: end;
  gap: var(--space-4);
}

.statistics-filter-panel .section-heading {
  margin-bottom: 0;
}

.statistics-filter-field {
  max-width: 360px;
}
```

`@media (max-width: 860px)` 블록의 selector 목록에 `.statistics-filter-panel`을 추가해서 모바일에서 한 열로 내려가게 한다.

```css
@media (max-width: 860px) {
  .workspace-grid,
  .dashboard-columns,
  .month-chip-list,
  .summary-grid,
  .statistics-layout .summary-grid,
  .statistics-filter-panel,
  .dashboard-hero .summary-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: 앱 테스트 재실행**

Run: `npm run test -- src/App.test.ts`

Expected: `App.test.ts`의 모든 테스트가 통과한다.

### Task 4: 전체 검증과 수동 확인

**Files:**
- Verify only

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm run test`

Expected: 모든 Vitest 테스트가 통과한다.

- [ ] **Step 2: 프로덕션 빌드 실행**

Run: `npm run build`

Expected: `vue-tsc --noEmit`와 `vite build`가 통과한다.

- [ ] **Step 3: 개발 서버 실행**

Run: `npm run dev`

Expected: Vite 개발 서버가 `http://127.0.0.1:5173/` 또는 사용 가능한 다음 포트에서 실행된다.

- [ ] **Step 4: 브라우저에서 통계 필터 확인**

`http://127.0.0.1:5173/`에서 다음을 확인한다.

- 지출이 없으면 `통계` 탭에 `아직 지출 통계가 없습니다`가 보인다.
- 지출을 추가한 뒤 `통계` 탭 상단에 `통계 기준`과 `지출 항목` select가 보인다.
- 기본 select 값은 `전체 지출`이다.
- `전체 지출`에서는 모든 항목 합산 통계가 보인다.
- `점심/외식` 같은 특정 항목을 선택하면 년도별 그래프, 요약 카드, 월별 그래프가 해당 항목 금액으로 바뀐다.
- 지출이 없는 항목을 선택하면 `선택한 항목의 지출 기록이 없습니다.`가 보이고 그래프/요약 카드는 숨겨진다.
- 375px 근처 모바일 폭에서 select와 그래프 금액 텍스트가 겹치지 않는다.

- [ ] **Step 5: 변경 파일 확인**

Run: `git status --short`

Expected: 변경 파일은 `src/App.test.ts`, `src/components/StatisticsTab.vue`, `src/styles.css`, `docs/superpowers/plans/2026-06-28-category-statistics-filter.md`이고, 기존 `HANDOFF.txt` 수정은 사용자/이전 세션 변경으로 별도 취급한다.

- [ ] **Step 6: 커밋 전 사용자에게 범위 보고**

커밋을 만들기 전 다음 범위를 사용자에게 알린다.

```text
커밋 대상 예정:
- src/App.test.ts
- src/components/StatisticsTab.vue
- src/styles.css
- docs/superpowers/plans/2026-06-28-category-statistics-filter.md

제외:
- HANDOFF.txt
```

사용자가 커밋을 승인하면 다음 명령을 사용한다.

```bash
git add src/App.test.ts src/components/StatisticsTab.vue src/styles.css docs/superpowers/plans/2026-06-28-category-statistics-filter.md
git commit -m "feat: add category filter to spending statistics"
```

## Self-Review

- Spec coverage: `전체 지출` 기본값, 카테고리 옵션, 전체/특정 항목 기준 년도별 그래프, 요약 카드, 월별 그래프, 항목별 빈 상태, localStorage 미저장을 모두 포함했다.
- Placeholder scan: `TBD`, `TODO`, `implement later`, "적절히 처리" 같은 자리표시자 지시는 없다.
- Type consistency: 필터 타입은 `CategoryFilter = 'all' | CategoryId`로 정의했고, template의 `selectedCategoryFilter`, `filteredExpenses`, `yearlyExpenseStats`, `expenseYears`, `monthlyStats` 이름이 script와 일치한다.

Plan complete and saved to `docs/superpowers/plans/2026-06-28-category-statistics-filter.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
