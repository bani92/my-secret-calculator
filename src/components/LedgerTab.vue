<template>
  <section class="workspace-grid">
    <form class="panel form-panel" @submit.prevent="submitExpense" data-testid="expense-form">
      <div class="section-heading income-heading">
        <h2>월 수입</h2>
        <div class="income-heading-actions">
          <button type="button" class="secondary-button" data-testid="open-carry-over" @click="openCarryOverDialog">
            전월 이월
          </button>
          <button type="button" class="secondary-button" data-testid="open-add-income" @click="openAddIncomeDialog">
            수입 추가
          </button>
        </div>
      </div>

      <p v-if="carryOverMessage" class="income-status" role="status">{{ carryOverMessage }}</p>

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
          <input
            :value="incomeDraft"
            aria-label="월 수입"
            data-testid="income-input"
            type="text"
            inputmode="numeric"
            @input="updateIncome"
          />
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
              <button
                type="button"
                class="icon-button"
                :data-testid="`edit-expense-${expense.id}`"
                @click="openExpenseEdit(expense)"
              >
                수정
              </button>
              <button type="button" class="icon-button danger" aria-label="지출 삭제" @click="store.deleteExpense(expense.id)">
                삭제
              </button>
            </div>
          </li>
        </ul>
      </section>
    </section>

    <div v-if="carryOverDialogOpen" class="dialog-backdrop" @click.self="carryOverDialogOpen = false">
      <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="전월 이월">
        <h3>전월 이월</h3>
        <p>{{ previousMonth(store.selectedMonth) }} 남은 금액을 이번 달 수입에 더합니다.</p>
        <dl class="dialog-summary-list">
          <div>
            <dt>전월 남은 돈</dt>
            <dd>{{ formatWon(carryOverAmount) }}</dd>
          </div>
          <div>
            <dt>현재 월 수입</dt>
            <dd>{{ formatWon(store.monthSummary.income) }}</dd>
          </div>
          <div>
            <dt>반영 후 월 수입</dt>
            <dd>{{ formatWon(carryOverPreview) }}</dd>
          </div>
        </dl>
        <div class="dialog-actions">
          <button type="button" class="secondary-button" @click="carryOverDialogOpen = false">취소</button>
          <button type="button" class="primary-button" @click="confirmCarryOver">이월하기</button>
        </div>
      </section>
    </div>

    <div v-if="addIncomeDialogOpen" class="dialog-backdrop" @click.self="addIncomeDialogOpen = false">
      <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="수입 추가">
        <h3>수입 추가</h3>
        <label>
          추가 금액
          <input
            :value="incomeAdditionDraft"
            aria-label="추가 수입 금액"
            data-testid="add-income-amount"
            type="text"
            inputmode="numeric"
            @input="updateIncomeAddition"
          />
        </label>
        <p class="dialog-preview">반영 후 월 수입 <strong>{{ formatWon(incomeAdditionPreview) }}</strong></p>
        <p v-if="incomeDialogError" class="dialog-error" role="alert">{{ incomeDialogError }}</p>
        <div class="dialog-actions">
          <button type="button" class="secondary-button" @click="addIncomeDialogOpen = false">취소</button>
          <button type="button" class="primary-button" data-testid="confirm-add-income" @click="confirmAddIncome">추가</button>
        </div>
      </section>
    </div>

    <div v-if="editingExpenseId" class="dialog-backdrop" @click.self="closeExpenseEdit">
      <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="지출 수정">
        <h3>지출 수정</h3>
        <div class="dialog-form-grid">
          <label>
            날짜
            <input v-model="expenseEditForm.date" data-testid="edit-expense-date" type="date" required />
          </label>
          <label>
            분류
            <select v-model="expenseEditForm.categoryId" data-testid="edit-expense-category">
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.label }}
              </option>
            </select>
          </label>
          <label>
            금액
            <input
              :value="expenseEditAmountDraft"
              data-testid="edit-expense-amount"
              type="text"
              inputmode="numeric"
              @input="expenseEditAmountDraft = formatMoneyInput(($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="wide">
            메모
            <input v-model="expenseEditForm.memo" data-testid="edit-expense-memo" type="text" />
          </label>
        </div>
        <p v-if="expenseEditError" class="dialog-error" role="alert">{{ expenseEditError }}</p>
        <div class="dialog-actions">
          <button type="button" class="secondary-button" @click="closeExpenseEdit">취소</button>
          <button type="button" class="primary-button" data-testid="confirm-edit-expense" @click="confirmExpenseEdit">
            저장
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import SummaryCard from './SummaryCard.vue';
import { categories } from '../domain/categories';
import type { CategoryId, Expense } from '../domain/types';
import { toMonth } from '../domain/calculations';
import { useBudgetStore } from '../stores/budgetStore';
import { formatMoneyInput, parseMoneyInput } from '../utils/money';

const props = defineProps<{
  initialExpenseDate?: string;
}>();

const store = useBudgetStore();
const today = new Date().toISOString().slice(0, 10);
const incomeDraft = ref(formatMoneyInput(String(store.monthSummary.income)));
const addIncomeDialogOpen = ref(false);
const carryOverDialogOpen = ref(false);
const incomeAdditionDraft = ref('');
const incomeDialogError = ref('');
const carryOverMessage = ref('');
const expenseAmountDraft = ref('');
const editingExpenseId = ref<string | null>(null);
const expenseEditError = ref('');
const expenseEditAmountDraft = ref('');
const expenseForm = reactive({
  date: props.initialExpenseDate ?? today,
  categoryId: 'lunch' as CategoryId,
  memo: ''
});
const expenseEditForm = reactive({
  date: today,
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

function previousMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() - 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const previousMonthSummary = computed(() => store.getMonthSummary(previousMonth(store.selectedMonth)));
const carryOverAmount = computed(() => previousMonthSummary.value.remaining);
const carryOverPreview = computed(() => store.monthSummary.income + carryOverAmount.value);
const incomeAdditionPreview = computed(() => store.monthSummary.income + parseMoneyInput(incomeAdditionDraft.value));

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
  const nextIncome = parseMoneyInput(incomeDraft.value);

  await store.setIncome(nextIncome);
  incomeDraft.value = formatMoneyInput(String(nextIncome));
}

function openCarryOverDialog(): void {
  carryOverMessage.value = '';

  if (carryOverAmount.value <= 0) {
    carryOverMessage.value = '이월한 남은 돈이 없습니다';
    return;
  }

  carryOverDialogOpen.value = true;
}

async function confirmCarryOver(): Promise<void> {
  await store.addIncome(carryOverAmount.value);
  incomeDraft.value = formatMoneyInput(String(store.monthSummary.income));
  carryOverDialogOpen.value = false;
}

function openAddIncomeDialog(): void {
  incomeAdditionDraft.value = '';
  incomeDialogError.value = '';
  addIncomeDialogOpen.value = true;
}

function updateIncomeAddition(event: Event): void {
  incomeAdditionDraft.value = formatMoneyInput((event.target as HTMLInputElement).value);
}

async function confirmAddIncome(): Promise<void> {
  const amount = parseMoneyInput(incomeAdditionDraft.value);

  if (amount <= 0) {
    incomeDialogError.value = '추가 금액은 0원보다 커야 합니다.';
    return;
  }

  await store.addIncome(amount);
  incomeDraft.value = formatMoneyInput(String(store.monthSummary.income));
  addIncomeDialogOpen.value = false;
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

function openExpenseEdit(expense: Expense): void {
  editingExpenseId.value = expense.id;
  expenseEditError.value = '';
  expenseEditForm.date = expense.date;
  expenseEditForm.categoryId = expense.categoryId;
  expenseEditForm.memo = expense.memo;
  expenseEditAmountDraft.value = formatMoneyInput(String(expense.amount));
}

function closeExpenseEdit(): void {
  editingExpenseId.value = null;
  expenseEditError.value = '';
}

async function confirmExpenseEdit(): Promise<void> {
  if (!editingExpenseId.value) {
    return;
  }

  const amount = parseMoneyInput(expenseEditAmountDraft.value);

  if (!expenseEditForm.date) {
    expenseEditError.value = '지출 날짜를 입력해주세요.';
    return;
  }

  if (amount <= 0) {
    expenseEditError.value = '지출 금액은 0원보다 커야 합니다.';
    return;
  }

  await store.updateExpense({
    id: editingExpenseId.value,
    date: expenseEditForm.date,
    categoryId: expenseEditForm.categoryId,
    amount,
    memo: expenseEditForm.memo
  });
  store.setSelectedMonth(toMonth(expenseEditForm.date));
  closeExpenseEdit();
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}
</script>
