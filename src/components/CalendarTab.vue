<template>
  <section class="calendar-layout">
    <section class="panel">
      <div class="calendar-toolbar">
        <div class="section-heading">
          <span>{{ selectedMonth }}</span>
          <h2>월간 지출 캘린더</h2>
        </div>

        <div class="period-controls">
          <label>
            년도
            <select :value="selectedYear" aria-label="캘린더 년도" @change="changeYear">
              <option v-for="year in years" :key="year" :value="year">{{ year }}년</option>
            </select>
          </label>

          <label>
            월
            <select :value="selectedMonthNumber" aria-label="캘린더 월" @change="changeMonth">
              <option v-for="month in monthOptions" :key="month.value" :value="month.value">
                {{ month.label }}
              </option>
            </select>
          </label>
        </div>
      </div>
      <p class="empty-copy">날짜를 클릭하면 입력 탭으로 이동하고 해당 날짜가 지출 날짜로 선택됩니다.</p>
    </section>

    <section class="panel">
      <div class="calendar-grid" :aria-label="`${selectedYear}년 ${Number(selectedMonthNumber)}월 캘린더`">
        <div
          v-for="dayName in dayHeaders"
          :key="dayName.label"
          class="day-name"
          :class="{ weekend: dayName.weekend }"
        >
          {{ dayName.label }}
        </div>

        <div v-for="cell in leadingEmptyCells" :key="`empty-${cell}`" class="date-cell empty" aria-hidden="true"></div>

        <button
          v-for="day in daysInMonth"
          :key="day.date"
          type="button"
          class="date-cell"
          :class="{ weekend: day.weekend, 'has-expenses': day.expenses.length > 0 }"
          :data-testid="`calendar-date-${day.date}`"
          @click="selectDay(day)"
        >
          <span class="date-number">{{ day.day }}</span>
          <span v-if="day.expenses.length > 0" class="expense-count">{{ day.expenses.length }}건</span>

          <ul class="expense-list">
            <li v-for="expense in visibleExpenses(day.expenses)" :key="expense.id">
              <strong>{{ categoryLabel(expense.categoryId) }}</strong>
              <span>
                {{ formatWon(expense.amount) }}{{ hiddenExpenseSuffix(day.expenses, expense) }}
              </span>
            </li>
          </ul>
        </button>
      </div>
    </section>

    <div v-if="selectedExpenseDay" class="dialog-backdrop" @click.self="closeExpenseDialog">
      <section
        class="expense-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`${selectedExpenseDay.date} 지출 내역`"
        data-testid="calendar-expense-dialog"
      >
        <header class="expense-dialog-header">
          <div>
            <span>{{ selectedExpenseDay.date }}</span>
            <h3>지출 내역</h3>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="지출 내역 닫기"
            data-testid="calendar-expense-dialog-close"
            @click="closeExpenseDialog"
          >
            닫기
          </button>
        </header>

        <div class="expense-dialog-summary">
          <span>{{ selectedExpenseDay.expenses.length }}건</span>
          <strong>{{ formatWon(selectedExpenseTotal) }}</strong>
        </div>

        <ul class="expense-dialog-list">
          <li v-for="expense in selectedExpenseDay.expenses" :key="expense.id">
            <div>
              <strong>{{ categoryLabel(expense.categoryId) }}</strong>
              <span>{{ expense.memo || '메모 없음' }}</span>
            </div>
            <strong>{{ formatWon(expense.amount) }}</strong>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { categories } from '../domain/categories';
import type { CategoryId, Expense } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';

const emit = defineEmits<{
  (event: 'select-date', date: string): void;
}>();

interface CalendarDay {
  date: string;
  day: number;
  weekend: boolean;
  expenses: Expense[];
}

const store = useBudgetStore();
const selectedExpenseDay = ref<CalendarDay | null>(null);
const dayHeaders = [
  { label: '일', weekend: true },
  { label: '월', weekend: false },
  { label: '화', weekend: false },
  { label: '수', weekend: false },
  { label: '목', weekend: false },
  { label: '금', weekend: false },
  { label: '토', weekend: true }
];
const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, '0');

  return {
    value,
    label: `${index + 1}월`
  };
});

const selectedMonth = computed(() => store.selectedMonth);
const selectedYear = computed(() => selectedMonth.value.slice(0, 4));
const selectedMonthNumber = computed(() => selectedMonth.value.slice(5, 7));
const years = computed(() => {
  const yearSet = new Set([selectedYear.value, ...store.registeredYears]);

  return [...yearSet].sort((left, right) => right.localeCompare(left));
});
const expensesByDate = computed(() => {
  const groups = new Map<string, Expense[]>();

  for (const expense of store.data.expenses) {
    if (expense.month !== selectedMonth.value) {
      continue;
    }

    groups.set(expense.date, [...(groups.get(expense.date) ?? []), expense]);
  }

  return groups;
});
const leadingEmptyCells = computed(() => {
  const firstDay = new Date(Number(selectedYear.value), Number(selectedMonthNumber.value) - 1, 1).getDay();

  return Array.from({ length: firstDay }, (_, index) => index);
});
const daysInMonth = computed<CalendarDay[]>(() => {
  const year = Number(selectedYear.value);
  const monthIndex = Number(selectedMonthNumber.value) - 1;
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: lastDate }, (_, index) => {
    const day = index + 1;
    const date = `${selectedYear.value}-${selectedMonthNumber.value}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, monthIndex, day).getDay();

    return {
      date,
      day,
      weekend: dayOfWeek === 0 || dayOfWeek === 6,
      expenses: expensesByDate.value.get(date) ?? []
    };
  });
});
const selectedExpenseTotal = computed(() =>
  selectedExpenseDay.value?.expenses.reduce((total, expense) => total + expense.amount, 0) ?? 0
);

onMounted(() => {
  window.addEventListener('keydown', closeExpenseDialogOnEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeExpenseDialogOnEscape);
});

function changeYear(event: Event): void {
  store.setSelectedMonth(`${(event.target as HTMLSelectElement).value}-${selectedMonthNumber.value}`);
}

function changeMonth(event: Event): void {
  store.setSelectedMonth(`${selectedYear.value}-${(event.target as HTMLSelectElement).value}`);
}

function selectDay(day: CalendarDay): void {
  if (day.expenses.length > 0) {
    selectedExpenseDay.value = day;
    return;
  }

  emit('select-date', day.date);
}

function closeExpenseDialog(): void {
  selectedExpenseDay.value = null;
}

function closeExpenseDialogOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeExpenseDialog();
  }
}

function visibleExpenses(expenses: Expense[]): Expense[] {
  return expenses.slice(0, 3);
}

function hiddenExpenseSuffix(expenses: Expense[], expense: Expense): string {
  const hiddenCount = expenses.length - 3;
  const thirdVisibleExpense = expenses[2];

  return hiddenCount > 0 && expense.id === thirdVisibleExpense?.id ? ` 외 ${hiddenCount}건` : '';
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}
</script>
