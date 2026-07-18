import { toMonth } from '../domain/calculations';
import type { BudgetData, IncomeRecord } from '../domain/types';

const unsupportedBackupErrorMessage = '지원하지 않는 백업 파일입니다';
const supportedCategoryIds = new Set([
  'lunch',
  'living',
  'fixed',
  'dating',
  'groceries',
  'transport',
  'health',
  'gifts',
  'other'
]);
const supportedPersonMoneyDirections = new Set(['receivable', 'payable']);
const supportedIncomeCategoryIds = new Set(['salary', 'side', 'carryOver', 'refund', 'transfer', 'other']);

export function stringifyBudgetData(data: BudgetData): string {
  return JSON.stringify(data, null, 2);
}

export function parseBudgetJson(raw: string): BudgetData {
  const parsed = JSON.parse(raw);

  if (!isSupportedBudgetData(parsed)) {
    throw new Error(unsupportedBackupErrorMessage);
  }

  return {
    ...parsed,
    incomeRecords: parsed.incomeRecords ?? []
  };
}

function isSupportedBudgetData(value: unknown): value is Omit<BudgetData, 'incomeRecords'> & {
  incomeRecords?: BudgetData['incomeRecords'];
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<BudgetData>;

  return (
    candidate.version === 1 &&
    isMonthRecords(candidate.months) &&
    Array.isArray(candidate.expenses) &&
    candidate.expenses.every(isExpense) &&
    (typeof candidate.incomeRecords === 'undefined' ||
      (Array.isArray(candidate.incomeRecords) && candidate.incomeRecords.every(isIncomeRecord))) &&
    Array.isArray(candidate.personRecords) &&
    candidate.personRecords.every(isPersonMoneyRecord)
  );
}

function isIncomeRecord(value: unknown): value is IncomeRecord {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isValidIsoDate(value.date) &&
    isMonth(value.month) &&
    toMonth(value.date) === value.month &&
    typeof value.categoryId === 'string' &&
    supportedIncomeCategoryIds.has(value.categoryId) &&
    isPositiveInteger(value.amount) &&
    typeof value.memo === 'string' &&
    (typeof value.createdAt === 'undefined' || typeof value.createdAt === 'string')
  );
}

function isMonthRecords(value: unknown): value is BudgetData['months'] {
  return isPlainObject(value) && Object.values(value).every(isMonthRecord);
}

function isMonthRecord(value: unknown): value is BudgetData['months'][string] {
  if (!isPlainObject(value)) {
    return false;
  }

  return isMonth(value.month) && isFiniteNumber(value.income);
}

function isExpense(value: unknown): value is BudgetData['expenses'][number] {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isValidIsoDate(value.date) &&
    isMonth(value.month) &&
    toMonth(value.date) === value.month &&
    typeof value.categoryId === 'string' &&
    supportedCategoryIds.has(value.categoryId) &&
    isFiniteNumber(value.amount) &&
    typeof value.memo === 'string' &&
    (typeof value.createdAt === 'undefined' || typeof value.createdAt === 'string')
  );
}

function isPersonMoneyRecord(value: unknown): value is BudgetData['personRecords'][number] {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isValidIsoDate(value.date) &&
    typeof value.personName === 'string' &&
    typeof value.direction === 'string' &&
    supportedPersonMoneyDirections.has(value.direction) &&
    isFiniteNumber(value.amount) &&
    typeof value.memo === 'string' &&
    typeof value.settled === 'boolean'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}
