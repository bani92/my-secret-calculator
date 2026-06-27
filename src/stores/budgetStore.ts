import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  calculateMonthSummary,
  calculatePersonBalances,
  getCurrentMonth,
  toMonth
} from '../domain/calculations';
import type { BudgetData, CategoryId, PersonMoneyDirection } from '../domain/types';
import { parseBudgetJson, stringifyBudgetData } from '../storage/exportImport';
import { LocalStorageBudgetRepository } from '../storage/localStorageBudgetRepository';

const repository = new LocalStorageBudgetRepository();
const newId = (): string => crypto.randomUUID();

export const useBudgetStore = defineStore('budget', () => {
  const selectedMonth = ref(getCurrentMonth());
  const data = ref<BudgetData>(repository.load());

  const monthSummary = computed(() =>
    calculateMonthSummary(selectedMonth.value, data.value.months, data.value.expenses)
  );
  const monthExpenses = computed(() =>
    data.value.expenses
      .filter((expense) => expense.month === selectedMonth.value)
      .sort((left, right) => right.date.localeCompare(left.date))
  );
  const personBalances = computed(() => calculatePersonBalances(data.value.personRecords));

  const persist = (): void => {
    repository.save(data.value);
  };

  const setSelectedMonth = (month: string): void => {
    selectedMonth.value = month;
  };

  const setIncome = (income: number): void => {
    data.value.months[selectedMonth.value] = { month: selectedMonth.value, income };
    persist();
  };

  const addExpense = (payload: {
    date: string;
    categoryId: CategoryId;
    amount: number;
    memo: string;
  }): void => {
    data.value.expenses.push({
      id: newId(),
      date: payload.date,
      month: toMonth(payload.date),
      categoryId: payload.categoryId,
      amount: payload.amount,
      memo: payload.memo.trim()
    });
    persist();
  };

  const deleteExpense = (id: string): void => {
    data.value.expenses = data.value.expenses.filter((expense) => expense.id !== id);
    persist();
  };

  const addPersonRecord = (payload: {
    date: string;
    personName: string;
    direction: PersonMoneyDirection;
    amount: number;
    memo: string;
  }): void => {
    data.value.personRecords.push({
      id: newId(),
      date: payload.date,
      personName: payload.personName.trim(),
      direction: payload.direction,
      amount: payload.amount,
      memo: payload.memo.trim(),
      settled: false
    });
    persist();
  };

  const togglePersonRecordSettled = (id: string): void => {
    const record = data.value.personRecords.find((item) => item.id === id);

    if (record) {
      record.settled = !record.settled;
      persist();
    }
  };

  const exportJson = (): string => stringifyBudgetData(data.value);

  const importJson = (raw: string): void => {
    data.value = parseBudgetJson(raw);
    persist();
  };

  return {
    selectedMonth,
    data,
    monthSummary,
    monthExpenses,
    personBalances,
    setSelectedMonth,
    setIncome,
    addExpense,
    deleteExpense,
    addPersonRecord,
    togglePersonRecordSettled,
    exportJson,
    importJson
  };
});
