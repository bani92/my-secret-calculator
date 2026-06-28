<template>
  <section class="dashboard-layout statistics-layout">
    <section v-if="store.expenseYears.length === 0" class="panel">
      <div class="section-heading compact">
        <span>지출 통계</span>
        <h2>아직 지출 통계가 없습니다</h2>
      </div>
      <p class="empty-copy">입력 탭에서 일일 지출을 추가하면 년도별, 월별 지출 흐름을 볼 수 있습니다.</p>
    </section>

    <template v-else>
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
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import SummaryCard from './SummaryCard.vue';
import {
  calculateMonthlyExpenseStats,
  calculateYearlyExpenseStats
} from '../domain/calculations';
import { categories } from '../domain/categories';
import type { CategoryId } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';

type CategoryFilter = 'all' | CategoryId;

const store = useBudgetStore();
const selectedYear = ref(store.expenseYears[0] ?? new Date().getFullYear().toString());
const selectedCategoryFilter = ref<CategoryFilter>('all');

const filteredExpenses = computed(() =>
  selectedCategoryFilter.value === 'all'
    ? store.data.expenses
    : store.data.expenses.filter((expense) => expense.categoryId === selectedCategoryFilter.value)
);
const yearlyExpenseStats = computed(() => calculateYearlyExpenseStats(filteredExpenses.value));
const expenseYears = computed(() => yearlyExpenseStats.value.map((stat) => stat.year));
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

watch(
  expenseYears,
  (years) => {
    if (years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0];
    }
  },
  { immediate: true }
);

function barWidth(total: number, maxTotal: number): string {
  if (total <= 0 || maxTotal <= 0) {
    return '0%';
  }

  return `${Math.max((total / maxTotal) * 100, 4)}%`;
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
</script>
