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
          <h2>거래 내역</h2>
        </div>

        <p v-if="store.ledgerGroups.length === 0" class="empty-copy">이번 달 첫 거래를 기록해보세요.</p>
        <div v-else class="ledger-day-list">
          <section v-for="group in store.ledgerGroups" :key="group.date" class="ledger-day-group">
            <header class="ledger-day-header">
              <span>{{ formatLedgerDate(group.date) }}</span>
              <strong>{{ formatSignedWon(group.total) }}</strong>
            </header>
            <ul class="ledger-entry-list">
              <li v-for="entry in group.entries" :key="`${entry.kind}-${entry.id}`" class="ledger-entry">
                <div class="ledger-entry-main">
                  <strong>{{ entry.memo || ledgerCategoryLabel(entry) }}</strong>
                  <span>{{ entry.date }} · {{ ledgerCategoryLabel(entry) }}</span>
                </div>
                <div class="ledger-entry-side">
                  <strong :class="['ledger-entry-amount', entry.kind]">{{ formatSignedWon(entry.signedAmount) }}</strong>
                  <div class="ledger-entry-actions">
                    <button
                      v-if="entry.kind === 'expense'"
                      type="button"
                      class="icon-button"
                      :data-testid="`edit-expense-${entry.id}`"
                      @click="openExpenseEdit(entry.record)"
                    >
                      수정
                    </button>
                    <button
                      v-else
                      type="button"
                      class="icon-button"
                      :data-testid="`edit-income-${entry.id}`"
                      @click="openIncomeEdit(entry.record)"
                    >
                      수정
                    </button>
                    <button
                      v-if="entry.kind === 'expense'"
                      type="button"
                      class="icon-button danger"
                      aria-label="지출 삭제"
                      @click="store.deleteExpense(entry.id)"
                    >
                      삭제
                    </button>
                    <button
                      v-else
                      type="button"
                      class="icon-button danger"
                      aria-label="수입 삭제"
                      @click="store.deleteIncomeRecord(entry.id)"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>
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
        <div class="dialog-form-grid">
          <label>
            날짜
            <input v-model="incomeForm.date" data-testid="add-income-date" type="date" required />
          </label>
          <label>
            분류
            <select v-model="incomeForm.categoryId" data-testid="add-income-category">
              <option v-for="category in incomeCategories" :key="category.id" :value="category.id">
                {{ category.label }}
              </option>
            </select>
          </label>
          <label>
            금액
            <input
              :value="incomeAdditionDraft"
              aria-label="추가 수입 금액"
              data-testid="add-income-amount"
              type="text"
              inputmode="numeric"
              @input="updateIncomeAddition"
            />
          </label>
          <label class="wide">
            메모
            <input v-model="incomeForm.memo" data-testid="add-income-memo" type="text" />
          </label>
        </div>
        <p v-if="incomeDialogError" class="dialog-error" role="alert">{{ incomeDialogError }}</p>
        <div class="dialog-actions">
          <button type="button" class="secondary-button" @click="addIncomeDialogOpen = false">취소</button>
          <button type="button" class="primary-button" data-testid="confirm-add-income" @click="confirmAddIncome">추가</button>
        </div>
      </section>
    </div>

    <div v-if="editingIncomeId" class="dialog-backdrop" @click.self="closeIncomeEdit">
      <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="수입 수정">
        <h3>수입 수정</h3>
        <div class="dialog-form-grid">
          <label>
            날짜
            <input v-model="incomeEditForm.date" data-testid="edit-income-date" type="date" required />
          </label>
          <label>
            분류
            <select v-model="incomeEditForm.categoryId" data-testid="edit-income-category">
              <option v-for="category in incomeCategories" :key="category.id" :value="category.id">
                {{ category.label }}
              </option>
            </select>
          </label>
          <label>
            금액
            <input
              :value="incomeEditAmountDraft"
              data-testid="edit-income-amount"
              type="text"
              inputmode="numeric"
              @input="incomeEditAmountDraft = formatMoneyInput(($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="wide">
            메모
            <input v-model="incomeEditForm.memo" data-testid="edit-income-memo" type="text" />
          </label>
        </div>
        <p v-if="incomeEditError" class="dialog-error" role="alert">{{ incomeEditError }}</p>
        <div class="dialog-actions">
          <button type="button" class="secondary-button" @click="closeIncomeEdit">취소</button>
          <button type="button" class="primary-button" data-testid="confirm-edit-income" @click="confirmIncomeEdit">
            저장
          </button>
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
import { categories, incomeCategories } from '../domain/categories';
import type { CategoryId, Expense, IncomeCategoryId, IncomeRecord } from '../domain/types';
import type { LedgerEntry } from '../domain/calculations';
import { toMonth } from '../domain/calculations';
import { useBudgetStore } from '../stores/budgetStore';
import { formatMoneyInput, parseMoneyInput } from '../utils/money';

const props = defineProps<{
  initialExpenseDate?: string;
}>();

const store = useBudgetStore();
const today = new Date().toISOString().slice(0, 10);
const baseIncome = computed(() => store.data.months[store.selectedMonth]?.income ?? 0);
const incomeDraft = ref(formatMoneyInput(String(baseIncome.value)));
const addIncomeDialogOpen = ref(false);
const carryOverDialogOpen = ref(false);
const incomeAdditionDraft = ref('');
const incomeDialogError = ref('');
const carryOverMessage = ref('');
const expenseAmountDraft = ref('');
const editingIncomeId = ref<string | null>(null);
const incomeEditError = ref('');
const incomeEditAmountDraft = ref('');
const editingExpenseId = ref<string | null>(null);
const expenseEditError = ref('');
const expenseEditAmountDraft = ref('');
const incomeForm = reactive({
  date: `${store.selectedMonth}-01`,
  categoryId: 'other' as IncomeCategoryId,
  memo: ''
});
const expenseForm = reactive({
  date: props.initialExpenseDate ?? today,
  categoryId: 'lunch' as CategoryId,
  memo: ''
});
const incomeEditForm = reactive({
  date: today,
  categoryId: 'other' as IncomeCategoryId,
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
    incomeDraft.value = formatMoneyInput(String(baseIncome.value));
    incomeForm.date = `${store.selectedMonth}-01`;
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
  await store.addIncomeRecord({
    date: `${store.selectedMonth}-01`,
    categoryId: 'carryOver',
    amount: carryOverAmount.value,
    memo: `${previousMonth(store.selectedMonth)} 잔액 이월`
  });
  carryOverDialogOpen.value = false;
}

function openAddIncomeDialog(): void {
  incomeAdditionDraft.value = '';
  incomeDialogError.value = '';
  incomeForm.date = `${store.selectedMonth}-01`;
  incomeForm.categoryId = 'other';
  incomeForm.memo = '';
  addIncomeDialogOpen.value = true;
}

function updateIncomeAddition(event: Event): void {
  incomeAdditionDraft.value = formatMoneyInput((event.target as HTMLInputElement).value);
}

async function confirmAddIncome(): Promise<void> {
  const amount = parseMoneyInput(incomeAdditionDraft.value);

  if (!incomeForm.date) {
    incomeDialogError.value = '수입 날짜를 입력해주세요.';
    return;
  }

  if (amount <= 0) {
    incomeDialogError.value = '수입 금액은 0원보다 커야 합니다.';
    return;
  }

  await store.addIncomeRecord({
    date: incomeForm.date,
    categoryId: incomeForm.categoryId,
    amount,
    memo: incomeForm.memo
  });
  store.setSelectedMonth(toMonth(incomeForm.date));
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
  incomeDraft.value = formatMoneyInput(String(baseIncome.value));
  expenseAmountDraft.value = '';
  expenseForm.memo = '';
}

function openIncomeEdit(record: IncomeRecord): void {
  editingIncomeId.value = record.id;
  incomeEditError.value = '';
  incomeEditForm.date = record.date;
  incomeEditForm.categoryId = record.categoryId;
  incomeEditForm.memo = record.memo;
  incomeEditAmountDraft.value = formatMoneyInput(String(record.amount));
}

function closeIncomeEdit(): void {
  editingIncomeId.value = null;
  incomeEditError.value = '';
}

async function confirmIncomeEdit(): Promise<void> {
  if (!editingIncomeId.value) {
    return;
  }

  const amount = parseMoneyInput(incomeEditAmountDraft.value);

  if (!incomeEditForm.date) {
    incomeEditError.value = '수입 날짜를 입력해주세요.';
    return;
  }

  if (amount <= 0) {
    incomeEditError.value = '수입 금액은 0원보다 커야 합니다.';
    return;
  }

  await store.updateIncomeRecord({
    id: editingIncomeId.value,
    date: incomeEditForm.date,
    categoryId: incomeEditForm.categoryId,
    amount,
    memo: incomeEditForm.memo
  });
  store.setSelectedMonth(toMonth(incomeEditForm.date));
  closeIncomeEdit();
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

function formatSignedWon(amount: number): string {
  if (amount > 0) {
    return `+${formatWon(amount)}`;
  }

  if (amount < 0) {
    return `-${formatWon(Math.abs(amount))}`;
  }

  return formatWon(0);
}

function formatLedgerDate(date: string): string {
  return `${Number(date.slice(8, 10))}일`;
}

function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}

function incomeCategoryLabel(id: IncomeCategoryId): string {
  return incomeCategories.find((category) => category.id === id)?.label ?? id;
}

function ledgerCategoryLabel(entry: LedgerEntry): string {
  return entry.kind === 'income' ? incomeCategoryLabel(entry.categoryId) : categoryLabel(entry.categoryId);
}
</script>
