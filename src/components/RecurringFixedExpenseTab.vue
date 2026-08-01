<template>
  <section class="recurring-layout">
    <section class="panel">
      <div class="section-heading income-heading">
        <div>
          <span>반복 고정비</span>
          <h2>고정비 규칙</h2>
        </div>
        <div class="income-heading-actions">
          <button type="button" class="primary-button" data-testid="open-recurring-rule-add" @click="openAddDialog">
            추가
          </button>
        </div>
      </div>

      <p v-if="store.data.recurringFixedExpenseRules.length === 0" class="empty-copy">등록된 고정비 규칙이 없습니다.</p>
      <ul v-else class="recurring-rule-list">
        <li v-for="rule in store.data.recurringFixedExpenseRules" :key="rule.id" class="recurring-rule-item">
          <strong>{{ rule.dayOfMonth }}일</strong>
          <div class="recurring-rule-main">
            <strong>{{ rule.memo }}</strong>
            <span>{{ categoryLabel(rule.categoryId) }} · {{ rule.active ? '사용 중' : '중지됨' }}</span>
          </div>
          <strong>{{ formatWon(rule.amount) }}</strong>
          <div class="recurring-rule-actions">
            <button
              type="button"
              class="icon-button"
              :data-testid="`edit-recurring-rule-${rule.id}`"
              aria-label="고정비 규칙 수정"
              @click="openEditDialog(rule)"
            >
              수정
            </button>
            <button
              type="button"
              class="icon-button danger"
              :data-testid="`delete-recurring-rule-${rule.id}`"
              aria-label="고정비 규칙 삭제"
              @click="deleteRule(rule.id)"
            >
              삭제
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="panel">
      <div class="section-heading compact">
        <span>{{ currentMonth }}</span>
        <h2>이번 달 자동 생성</h2>
      </div>
      <p v-if="recurringStatuses.length === 0" class="empty-copy">표시할 자동 생성 내역이 없습니다.</p>
      <ul v-else class="recurring-status-list">
        <li v-for="status in recurringStatuses" :key="status.ruleId" class="recurring-rule-item">
          <span>{{ status.label }}</span>
          <strong :class="status.state === 'created' ? 'positive' : 'muted'">
            {{ status.state === 'created' ? '생성됨' : '예정' }}
          </strong>
        </li>
      </ul>
    </section>

    <div v-if="dialogOpen" class="dialog-backdrop" @click.self="closeDialog">
      <section class="dialog-panel" role="dialog" aria-modal="true" :aria-label="editingRuleId ? '고정비 규칙 수정' : '고정비 규칙 추가'">
        <h3>{{ editingRuleId ? '고정비 규칙 수정' : '고정비 규칙 추가' }}</h3>
        <div class="dialog-form-grid">
          <label>
            반복일
            <input v-model.number="ruleForm.dayOfMonth" data-testid="recurring-rule-day" type="number" min="1" max="31" required />
          </label>
          <label>
            분류
            <select v-model="ruleForm.categoryId" data-testid="recurring-rule-category">
              <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.label }}</option>
            </select>
          </label>
          <label>
            금액
            <input
              :value="amountDraft"
              data-testid="recurring-rule-amount"
              type="text"
              inputmode="numeric"
              required
              @input="updateAmount"
            />
          </label>
          <label class="wide">
            메모
            <input v-model="ruleForm.memo" data-testid="recurring-rule-memo" type="text" required />
          </label>
          <label class="wide">
            <input v-model="ruleForm.active" type="checkbox" />
            사용
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary-button" @click="closeDialog">취소</button>
          <button type="button" class="primary-button" data-testid="save-recurring-rule" @click="saveRule">저장</button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { getCurrentMonth } from '../domain/calculations';
import { categories } from '../domain/categories';
import type { CategoryId, RecurringFixedExpenseRule } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';
import { formatMoneyInput, parseMoneyInput } from '../utils/money';

const store = useBudgetStore();
const currentMonth = getCurrentMonth();
const recurringStatuses = computed(() => store.getRecurringFixedExpenseStatuses(currentMonth));
const dialogOpen = ref(false);
const ruleForm = reactive({
  dayOfMonth: 1,
  categoryId: 'fixed' as CategoryId,
  memo: '',
  active: true
});
const amountDraft = ref('');
const editingRuleId = ref<string | null>(null);

function openAddDialog(): void {
  editingRuleId.value = null;
  ruleForm.dayOfMonth = 1;
  ruleForm.categoryId = 'fixed';
  ruleForm.memo = '';
  ruleForm.active = true;
  amountDraft.value = '';
  dialogOpen.value = true;
}

function openEditDialog(rule: RecurringFixedExpenseRule): void {
  editingRuleId.value = rule.id;
  ruleForm.dayOfMonth = rule.dayOfMonth;
  ruleForm.categoryId = rule.categoryId;
  ruleForm.memo = rule.memo;
  ruleForm.active = rule.active;
  amountDraft.value = formatMoneyInput(String(rule.amount));
  dialogOpen.value = true;
}

function closeDialog(): void {
  dialogOpen.value = false;
  editingRuleId.value = null;
}

function updateAmount(event: Event): void {
  amountDraft.value = formatMoneyInput((event.target as HTMLInputElement).value);
}

async function saveRule(): Promise<void> {
  const amount = parseMoneyInput(amountDraft.value);

  if (!Number.isInteger(ruleForm.dayOfMonth) || ruleForm.dayOfMonth < 1 || ruleForm.dayOfMonth > 31 || amount <= 0 || !ruleForm.memo.trim()) {
    return;
  }

  const payload = { ...ruleForm, amount };

  if (editingRuleId.value) {
    await store.updateRecurringFixedExpenseRule({ id: editingRuleId.value, ...payload });
  } else {
    await store.addRecurringFixedExpenseRule(payload);
  }

  closeDialog();
}

async function deleteRule(id: string): Promise<void> {
  await store.deleteRecurringFixedExpenseRule(id);
}

function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
</script>
