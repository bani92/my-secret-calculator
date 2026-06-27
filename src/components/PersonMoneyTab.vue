<template>
  <section class="workspace-grid">
    <form class="panel form-panel" data-testid="person-form" @submit.prevent="submitRecord">
      <div class="section-heading">
        <span>사람</span>
        <h2>사람별 돈 기록</h2>
      </div>

      <label>
        날짜
        <input v-model="form.date" aria-label="사람별 날짜" type="date" required />
      </label>

      <label>
        이름
        <input v-model="form.personName" aria-label="사람 이름" type="text" required />
      </label>

      <label>
        방향
        <select v-model="form.direction" aria-label="돈 방향">
          <option value="receivable">받을 돈</option>
          <option value="payable">갚을 돈</option>
        </select>
      </label>

      <label>
        금액
        <input
          :value="amountDraft"
          aria-label="사람별 금액"
          type="text"
          inputmode="numeric"
          required
          @input="updateAmount"
        />
      </label>

      <label>
        메모
        <input v-model="form.memo" aria-label="사람별 메모" type="text" />
      </label>

      <button type="submit" class="primary-button">기록 추가</button>
    </form>

    <section class="content-stack">
      <section class="panel">
        <div class="section-heading compact">
          <span>미정산</span>
          <h2>현재 미정산</h2>
        </div>
        <p v-if="store.personBalances.length === 0" class="empty-copy">현재 미정산 내역이 없습니다.</p>
        <ul v-else class="metric-list">
          <li v-for="balance in store.personBalances" :key="balance.personName">
            <span>{{ balance.personName }}</span>
            <strong :class="balance.balance > 0 ? 'positive' : 'negative'">{{ formatBalance(balance.balance) }}</strong>
          </li>
        </ul>
      </section>

      <section class="panel">
        <div class="section-heading compact">
          <span>전체</span>
          <h2>거래 기록</h2>
        </div>
        <p v-if="orderedRecords.length === 0" class="empty-copy">아직 주고받은 돈 기록이 없습니다.</p>
        <ul v-else class="record-list">
          <li v-for="record in orderedRecords" :key="record.id" :class="{ muted: record.settled }">
            <div>
              <strong>{{ record.personName }} · {{ directionLabel(record.direction) }}</strong>
              <span>{{ record.date }} · {{ record.memo || '메모 없음' }}</span>
            </div>
            <div class="record-actions">
              <strong>{{ formatWon(record.amount) }}</strong>
              <button
                type="button"
                class="secondary-button"
                data-testid="toggle-settled"
                @click="store.togglePersonRecordSettled(record.id)"
              >
                {{ record.settled ? '정산 취소' : '정산 완료' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import type { PersonMoneyDirection } from '../domain/types';
import { useBudgetStore } from '../stores/budgetStore';
import { formatMoneyInput, parseMoneyInput } from '../utils/money';

const store = useBudgetStore();
const form = reactive({
  date: new Date().toISOString().slice(0, 10),
  personName: '',
  direction: 'receivable' as PersonMoneyDirection,
  memo: ''
});
const amountDraft = ref('');

const orderedRecords = computed(() =>
  [...store.data.personRecords].sort((left, right) => right.date.localeCompare(left.date))
);

function submitRecord(): void {
  const amount = parseMoneyInput(amountDraft.value);

  if (!form.personName.trim() || amount <= 0) {
    return;
  }

  store.addPersonRecord({ ...form, amount });
  form.personName = '';
  amountDraft.value = '';
  form.memo = '';
}

function updateAmount(event: Event): void {
  amountDraft.value = formatMoneyInput((event.target as HTMLInputElement).value);
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function directionLabel(direction: PersonMoneyDirection): string {
  return direction === 'receivable' ? '받을 돈' : '갚을 돈';
}

function formatBalance(amount: number): string {
  return amount > 0 ? `받을 돈 ${formatWon(amount)}` : `갚을 돈 ${formatWon(Math.abs(amount))}`;
}
</script>
