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
import type { BudgetData, CategoryId, Expense, PersonMoneyDirection } from '../domain/types';
import type { BudgetRepository } from '../storage/budgetRepository';
import { parseBudgetJson, stringifyBudgetData } from '../storage/exportImport';
import { requireSupabaseClient } from '../lib/supabaseClient';
import { SupabaseBudgetRepository } from '../storage/supabaseBudgetRepository';

const newId = (): string => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`;
};

const cloneBudgetData = (budgetData: BudgetData): BudgetData => parseBudgetJson(stringifyBudgetData(budgetData));
const expenseSortKey = (expense: Expense): string => expense.createdAt ?? `${expense.date}T00:00:00.000Z`;

const isValidExpenseDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
};

export function createBudgetStore(repository: BudgetRepository) {
  return defineStore('budget', () => {
    const selectedMonth = ref(getCurrentMonth());
    const data = ref<BudgetData>(createEmptyBudgetData());
    const isLoaded = ref(false);
    const loadError = ref('');
    let initializePromise: Promise<void> | undefined;

    const monthSummary = computed(() =>
      calculateMonthSummary(selectedMonth.value, data.value.months, data.value.expenses)
    );
    const getMonthSummary = (month: string) =>
      calculateMonthSummary(month, data.value.months, data.value.expenses);
    const monthExpenses = computed(() =>
      data.value.expenses
        .filter((expense) => expense.month === selectedMonth.value)
        .sort((left, right) => expenseSortKey(right).localeCompare(expenseSortKey(left)))
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
      initializePromise ??= repository
        .load()
        .then((loadedData) => {
          data.value = loadedData;
          isLoaded.value = true;
          loadError.value = '';
        })
        .catch((error: unknown) => {
          initializePromise = undefined;
          isLoaded.value = false;
          loadError.value = '가계부를 불러오지 못했습니다.';
          throw error;
        });

      await initializePromise;
    };

    const ensureInitialized = async (): Promise<void> => {
      if (!isLoaded.value) {
        await initialize();
      }
    };

    const setSelectedMonth = (month: string): void => {
      selectedMonth.value = month;
    };

    const setIncome = async (income: number): Promise<void> => {
      await ensureInitialized();
      const nextData = cloneBudgetData(data.value);
      nextData.months[selectedMonth.value] = { month: selectedMonth.value, income };
      const validatedData = cloneBudgetData(nextData);
      const record = validatedData.months[selectedMonth.value];

      await repository.setIncome(record);
      data.value.months[record.month] = record;
    };

    const addIncome = async (amount: number): Promise<void> => {
      await ensureInitialized();

      if (amount <= 0) {
        throw new Error('추가 금액은 0원보다 커야 합니다.');
      }

      await setIncome(monthSummary.value.income + amount);
    };

    const addExpense = async (payload: {
      date: string;
      categoryId: CategoryId;
      amount: number;
      memo: string;
    }): Promise<void> => {
      await ensureInitialized();
      const nextData = cloneBudgetData(data.value);
      const nextExpense = {
        id: newId(),
        createdAt: new Date().toISOString(),
        date: payload.date,
        month: toMonth(payload.date),
        categoryId: payload.categoryId,
        amount: payload.amount,
        memo: payload.memo.trim()
      };
      nextData.expenses.push(nextExpense);
      const validatedData = cloneBudgetData(nextData);
      const expense = validatedData.expenses[validatedData.expenses.length - 1];

      await repository.addExpense(expense);
      data.value.expenses.push(expense);
    };

    const deleteExpense = async (id: string): Promise<void> => {
      await ensureInitialized();
      const nextData = cloneBudgetData(data.value);
      nextData.expenses = nextData.expenses.filter((expense) => expense.id !== id);
      cloneBudgetData(nextData);

      await repository.deleteExpense(id);
      data.value.expenses = nextData.expenses;
    };

    const updateExpense = async (payload: {
      id: string;
      date: string;
      categoryId: CategoryId;
      amount: number;
      memo: string;
    }): Promise<void> => {
      await ensureInitialized();

      if (!isValidExpenseDate(payload.date)) {
        throw new Error('지출 날짜를 입력해주세요.');
      }

      if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
        throw new Error('지출 금액은 0원보다 커야 합니다.');
      }

      const existing = data.value.expenses.find((expense) => expense.id === payload.id);

      if (!existing) {
        return;
      }

      const nextExpense: Expense = {
        ...existing,
        date: payload.date,
        month: toMonth(payload.date),
        categoryId: payload.categoryId,
        amount: payload.amount,
        memo: payload.memo.trim()
      };

      await repository.updateExpense(nextExpense);
      data.value.expenses = data.value.expenses.map((expense) =>
        expense.id === nextExpense.id ? nextExpense : expense
      );
    };

    const getMonthlyExpenseStats = (year: string) => calculateMonthlyExpenseStats(year, data.value.expenses);

    const addPersonRecord = async (payload: {
      date: string;
      personName: string;
      direction: PersonMoneyDirection;
      amount: number;
      memo: string;
    }): Promise<void> => {
      await ensureInitialized();
      const nextData = cloneBudgetData(data.value);
      const nextRecord = {
        id: newId(),
        date: payload.date,
        personName: payload.personName.trim(),
        direction: payload.direction,
        amount: payload.amount,
        memo: payload.memo.trim(),
        settled: false
      };
      nextData.personRecords.push(nextRecord);
      const validatedData = cloneBudgetData(nextData);
      const record = validatedData.personRecords[validatedData.personRecords.length - 1];

      await repository.addPersonRecord(record);
      data.value.personRecords.push(record);
    };

    const togglePersonRecordSettled = async (id: string): Promise<void> => {
      await ensureInitialized();
      const record = data.value.personRecords.find((item) => item.id === id);

      if (record) {
        const nextSettled = !record.settled;
        const nextData = cloneBudgetData(data.value);
        const nextRecord = nextData.personRecords.find((item) => item.id === id);

        if (nextRecord) {
          nextRecord.settled = nextSettled;
        }
        cloneBudgetData(nextData);

        await repository.setPersonRecordSettled(id, nextSettled);
        record.settled = nextSettled;
      }
    };

    const exportJson = async (): Promise<string> => {
      await ensureInitialized();

      return stringifyBudgetData(data.value);
    };

    const importJson = async (raw: string): Promise<void> => {
      await ensureInitialized();
      const parsed = parseBudgetJson(raw);

      await repository.replaceAll(parsed);
      data.value = parsed;
    };

    const reset = (): void => {
      data.value = createEmptyBudgetData();
      isLoaded.value = false;
      loadError.value = '';
      initializePromise = undefined;
    };

    return {
      selectedMonth,
      data,
      isLoaded,
      loadError,
      monthSummary,
      monthExpenses,
      registeredMonths,
      registeredYears,
      yearlyExpenseStats,
      expenseYears,
      personBalances,
      initialize,
      reset,
      setSelectedMonth,
      setIncome,
      addIncome,
      addExpense,
      deleteExpense,
      updateExpense,
      getMonthSummary,
      getMonthlyExpenseStats,
      addPersonRecord,
      togglePersonRecordSettled,
      exportJson,
      importJson
    };
  });
}

export const useBudgetStore = createBudgetStore(new SupabaseBudgetRepository(requireSupabaseClient));
