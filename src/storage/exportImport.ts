import type { BudgetData } from '../domain/types';

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

export function stringifyBudgetData(data: BudgetData): string {
  return JSON.stringify(data, null, 2);
}

export function parseBudgetJson(raw: string): BudgetData {
  const parsed = JSON.parse(raw);

  if (!isSupportedBudgetData(parsed)) {
    throw new Error(unsupportedBackupErrorMessage);
  }

  return parsed;
}

function isSupportedBudgetData(value: unknown): value is BudgetData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<BudgetData>;

  return (
    candidate.version === 1 &&
    isMonthRecords(candidate.months) &&
    Array.isArray(candidate.expenses) &&
    candidate.expenses.every(isExpense) &&
    Array.isArray(candidate.personRecords) &&
    candidate.personRecords.every(isPersonMoneyRecord)
  );
}

function isMonthRecords(value: unknown): value is BudgetData['months'] {
  return isPlainObject(value) && Object.values(value).every(isMonthRecord);
}

function isMonthRecord(value: unknown): value is BudgetData['months'][string] {
  if (!isPlainObject(value)) {
    return false;
  }

  return typeof value.month === 'string' && isFiniteNumber(value.income);
}

function isExpense(value: unknown): value is BudgetData['expenses'][number] {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.month === 'string' &&
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
    typeof value.date === 'string' &&
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
