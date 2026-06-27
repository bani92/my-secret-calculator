<template>
  <section class="dashboard-layout">
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
import { computed } from 'vue';

import SummaryCard from './SummaryCard.vue';
import { categories } from '../domain/categories';
import type { CategoryId } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';

const store = useBudgetStore();

const visibleCategoryTotals = computed(() =>
  categories
    .map((category) => ({
      ...category,
      amount: store.monthSummary.categoryTotals[category.id] ?? 0
    }))
    .filter((category) => category.amount > 0)
);

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
