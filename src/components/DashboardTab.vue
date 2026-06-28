<template>
  <section class="dashboard-layout">
    <section class="panel dashboard-period-panel">
      <div class="section-heading compact">
        <span>등록 년도</span>
        <h2>조회할 기간 선택</h2>
      </div>

      <p v-if="store.registeredYears.length === 0" class="empty-copy">아직 등록된 월이 없습니다.</p>
      <template v-else>
        <div class="year-selector" data-testid="dashboard-year-list" aria-label="등록 년도">
          <button
            v-for="year in store.registeredYears"
            :key="year"
            type="button"
            class="year-button"
            :class="{ active: selectedYear === year }"
            data-testid="dashboard-year"
            @click="selectYear(year)"
          >
            {{ year }}
          </button>
        </div>

        <div class="month-chip-list" data-testid="dashboard-month-list" aria-label="등록 월">
          <button
            v-for="month in monthsForSelectedYear"
            :key="month"
            type="button"
            class="month-chip"
            :class="{ active: store.selectedMonth === month }"
            data-testid="dashboard-month"
            @click="store.setSelectedMonth(month)"
          >
            <strong>{{ formatMonthLabel(month) }}</strong>
            <span>{{ month }}</span>
          </button>
        </div>
      </template>
    </section>

    <section class="panel dashboard-hero">
      <div class="section-heading compact">
        <span>{{ store.selectedMonth }}</span>
        <h2>이번 달 요약</h2>
      </div>
      <div class="summary-grid">
        <SummaryCard label="월 수입" :value="formatWon(store.monthSummary.income)" />
        <SummaryCard label="지출" :value="formatWon(store.monthSummary.expenseTotal)" />
        <SummaryCard label="남은 금액" :value="formatWon(store.monthSummary.remaining)" />
        <SummaryCard label="지출률" :value="formatRatio(store.monthSummary.spendingRatio)" />
      </div>
    </section>

    <section class="dashboard-columns">
      <section class="panel">
        <div class="section-heading compact">
          <span>분류</span>
          <h2>카테고리별 지출</h2>
        </div>
        <p v-if="visibleCategoryTotals.length === 0" class="empty-copy">아직 분류별 지출이 없습니다.</p>
        <ul v-else class="metric-list">
          <li v-for="category in visibleCategoryTotals" :key="category.id">
            <span>{{ category.label }}</span>
            <strong>{{ formatWon(category.amount) }}</strong>
          </li>
        </ul>
      </section>

      <section class="panel">
        <div class="section-heading compact">
          <span>목록</span>
          <h2>월별 지출 목록</h2>
        </div>
        <p v-if="store.monthExpenses.length === 0" class="empty-copy">대시보드에 표시할 지출이 없습니다.</p>
        <ul v-else class="record-list">
          <li v-for="expense in store.monthExpenses" :key="expense.id">
            <div>
              <strong>{{ expense.memo || categoryLabel(expense.categoryId) }}</strong>
              <span>{{ expense.date }} · {{ categoryLabel(expense.categoryId) }}</span>
            </div>
            <strong>{{ formatWon(expense.amount) }}</strong>
          </li>
        </ul>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import SummaryCard from './SummaryCard.vue';
import { categories } from '../domain/categories';
import type { CategoryId } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';

const store = useBudgetStore();
const selectedYear = ref(store.selectedMonth.slice(0, 4));

const monthsForSelectedYear = computed(() =>
  store.registeredMonths.filter((month) => month.startsWith(`${selectedYear.value}-`))
);

const visibleCategoryTotals = computed(() =>
  categories
    .map((category) => ({
      ...category,
      amount: store.monthSummary.categoryTotals[category.id] ?? 0
    }))
    .filter((category) => category.amount > 0)
);

watch(
  () => store.selectedMonth,
  (month) => {
    const year = month.slice(0, 4);

    if (store.registeredYears.includes(year)) {
      selectedYear.value = year;
    }
  }
);

watch(
  () => store.registeredYears,
  (years) => {
    if (years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0];
    }
  },
  { immediate: true }
);

function selectYear(year: string): void {
  selectedYear.value = year;
  const latestMonth = store.registeredMonths.find((month) => month.startsWith(`${year}-`));

  if (latestMonth) {
    store.setSelectedMonth(latestMonth);
  }
}

function formatMonthLabel(month: string): string {
  return `${Number(month.slice(5, 7))}월`;
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function formatRatio(ratio: number | null): string {
  return ratio === null ? '-' : `${Math.round(ratio * 100)}%`;
}

function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}
</script>
