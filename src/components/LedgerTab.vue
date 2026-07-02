<template>
  <section class="workspace-grid">
    <form class="panel form-panel" @submit.prevent="submitExpense" data-testid="expense-form">
      <div class="section-heading">
        <h2>월 수입</h2>
      </div>

      <label>
        대상 월
        <input
          :value="store.selectedMonth"
          aria-label="대상 월"
          type="month"
          @input="store.setSelectedMonth(($event.target as HTMLInputElement).value)"
        />
      </label>

      <div class="inline-field">
        <label>
          월 수입
          <input :value="incomeDraft" aria-label="월 수입" type="text" inputmode="numeric" @input="updateIncome" />
        </label>
        <button type="button" class="secondary-button" data-testid="save-income" @click="saveIncome">저장</button>
      </div>

      <hr />

      <div class="section-heading compact">
        <h2>일일 지출</h2>
      </div>

      <label>
        날짜
        <input v-model="expenseForm.date" aria-label="지출 날짜" type="date" required />
      </label>

      <label>
        분류
        <select v-model="expenseForm.categoryId" aria-label="지출 분류">
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.label }}
          </option>
        </select>
      </label>

      <label>
        금액
        <input
          :value="expenseAmountDraft"
          aria-label="지출 금액"
          type="text"
          inputmode="numeric"
          required
          @input="updateExpenseAmount"
        />
      </label>

      <label>
        메모
        <input v-model="expenseForm.memo" aria-label="지출 메모" type="text" />
      </label>

      <button type="submit" class="primary-button">지출 추가</button>
    </form>

    <section class="content-stack">
      <section class="summary-grid" aria-label="이번 달 빠른 요약">
        <SummaryCard label="월 수입" :value="formatWon(store.monthSummary.income)" />
        <SummaryCard label="지출" :value="formatWon(store.monthSummary.expenseTotal)" />
        <SummaryCard label="남은 금액" :value="formatWon(store.monthSummary.remaining)" />
      </section>

      <section class="panel">
        <div class="section-heading compact">
          <span>{{ store.selectedMonth }}</span>
          <h2>최근 지출</h2>
        </div>

        <p v-if="store.monthExpenses.length === 0" class="empty-copy">이번 달 첫 지출을 기록해보세요.</p>
        <ul v-else class="record-list">
          <li v-for="expense in store.monthExpenses" :key="expense.id">
            <div>
              <strong>{{ expense.memo || categoryLabel(expense.categoryId) }}</strong>
              <span>{{ expense.date }} · {{ categoryLabel(expense.categoryId) }}</span>
            </div>
            <div class="record-actions">
              <strong>{{ formatWon(expense.amount) }}</strong>
              <button type="button" class="icon-button danger" aria-label="지출 삭제" @click="store.deleteExpense(expense.id)">
                삭제
              </button>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';

import SummaryCard from './SummaryCard.vue';
import { categories } from '../domain/categories';
import type { CategoryId } from '../domain/types';
import { toMonth } from '../domain/calculations';
import { useBudgetStore } from '../stores/budgetStore';
import { formatMoneyInput, parseMoneyInput } from '../utils/money';

const props = defineProps<{
  initialExpenseDate?: string;
}>();

const store = useBudgetStore();
const today = new Date().toISOString().slice(0, 10);
const incomeDraft = ref(formatMoneyInput(String(store.monthSummary.income)));
const expenseAmountDraft = ref('');
const expenseForm = reactive({
  date: props.initialExpenseDate ?? today,
  categoryId: 'lunch' as CategoryId,
  memo: ''
});

if (props.initialExpenseDate) {
  store.setSelectedMonth(toMonth(props.initialExpenseDate));
}

watch(
  () => store.selectedMonth,
  () => {
    incomeDraft.value = formatMoneyInput(String(store.monthSummary.income));
  }
);

watch(
  () => props.initialExpenseDate,
  (date) => {
    if (!date) {
      return;
    }

    expenseForm.date = date;
    store.setSelectedMonth(toMonth(date));
  }
);

function updateIncome(event: Event): void {
  incomeDraft.value = formatMoneyInput((event.target as HTMLInputElement).value);
}

async function saveIncome(): Promise<void> {
  await store.setIncome(parseMoneyInput(incomeDraft.value));
  incomeDraft.value = '';
}

function updateExpenseAmount(event: Event): void {
  expenseAmountDraft.value = formatMoneyInput((event.target as HTMLInputElement).value);
}

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

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}
</script>
