import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  calculateMonthlyExpenseStats,
  calculateMonthSummary,
  calculatePersonBalances,
  calculateYearlyExpenseStats,
  createEmptyBudgetData,
  getCurrentMonth,
  toMonth
} from '../domain/calculations';
import type { BudgetData, CategoryId, PersonMoneyDirection } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { parseBudgetJson, stringifyBudgetData } from '../storage/exportImport';
import { IndexedDbBudgetRepository } from '../storage/indexedDbBudgetRepository';

const newId = (): string => crypto.randomUUID();

export function createBudgetStore(repository: BudgetRepository) {
  return defineStore('budget', () => {
    const selectedMonth = ref(getCurrentMonth());
    const data = ref<BudgetData>(createEmptyBudgetData());
    const isLoaded = ref(false);

    const monthSummary = computed(() =>
      calculateMonthSummary(selectedMonth.value, data.value.months, data.value.expenses)
    );
    const monthExpenses = computed(() =>
      data.value.expenses
        .filter((expense) => expense.month === selectedMonth.value)
        .sort((left, right) => right.date.localeCompare(left.date))
    );
    const registeredMonths = computed(() => {
      const months = new Set<string>(Object.keys(data.value.months));

      for (const expense of data.value.expenses) {
        months.add(expense.month);
      }

      return [...months].sort((left, right) => right.localeCompare(left));
    });
    const registeredYears = computed(() => {
      const years = new Set(registeredMonths.value.map((month) => month.slice(0, 4)));

      return [...years].sort((left, right) => right.localeCompare(left));
    });
    const yearlyExpenseStats = computed(() => calculateYearlyExpenseStats(data.value.expenses));
    const expenseYears = computed(() => yearlyExpenseStats.value.map((stat) => stat.year));
    const personBalances = computed(() => calculatePersonBalances(data.value.personRecords));

    const initialize = async (): Promise<void> => {
      data.value = await repository.load();
      isLoaded.value = true;
    };

    const persist = async (): Promise<void> => {
      await repository.save(parseBudgetJson(stringifyBudgetData(data.value)));
    };

    const setSelectedMonth = (month: string): void => {
      selectedMonth.value = month;
    };

    const setIncome = async (income: number): Promise<void> => {
      data.value.months[selectedMonth.value] = { month: selectedMonth.value, income };
      await persist();
    };

    const addExpense = async (payload: {
      date: string;
      categoryId: CategoryId;
      amount: number;
      memo: string;
    }): Promise<void> => {
      data.value.expenses.push({
        id: newId(),
        date: payload.date,
        month: toMonth(payload.date),
        categoryId: payload.categoryId,
        amount: payload.amount,
        memo: payload.memo.trim()
      });
      await persist();
    };

    const deleteExpense = async (id: string): Promise<void> => {
      data.value.expenses = data.value.expenses.filter((expense) => expense.id !== id);
      await persist();
    };

    const getMonthlyExpenseStats = (year: string) => calculateMonthlyExpenseStats(year, data.value.expenses);

    const addPersonRecord = async (payload: {
      date: string;
      personName: string;
      direction: PersonMoneyDirection;
      amount: number;
      memo: string;
    }): Promise<void> => {
      data.value.personRecords.push({
        id: newId(),
        date: payload.date,
        personName: payload.personName.trim(),
        direction: payload.direction,
        amount: payload.amount,
        memo: payload.memo.trim(),
        settled: false
      });
      await persist();
    };

    const togglePersonRecordSettled = async (id: string): Promise<void> => {
      const record = data.value.personRecords.find((item) => item.id === id);

      if (record) {
        record.settled = !record.settled;
        await persist();
      }
    };

    const exportJson = (): string => stringifyBudgetData(data.value);

    const importJson = async (raw: string): Promise<void> => {
      data.value = parseBudgetJson(raw);
      await persist();
    };

    return {
      selectedMonth,
      data,
      isLoaded,
      monthSummary,
      monthExpenses,
      registeredMonths,
      registeredYears,
      yearlyExpenseStats,
      expenseYears,
      personBalances,
      initialize,
      setSelectedMonth,
      setIncome,
      addExpense,
      deleteExpense,
      getMonthlyExpenseStats,
      addPersonRecord,
      togglePersonRecordSettled,
      exportJson,
      importJson
    };
  });
}

export const useBudgetStore = createBudgetStore(new IndexedDbBudgetRepository());
