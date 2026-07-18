import type { CategoryId, IncomeCategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
}

export const categories: Category[] = [
  { id: 'lunch', label: '점심/외식' },
  { id: 'living', label: '생활비' },
  { id: 'fixed', label: '고정비' },
  { id: 'dating', label: '데이트/여가' },
  { id: 'groceries', label: '장보기/식재료' },
  { id: 'transport', label: '교통' },
  { id: 'health', label: '의료/건강' },
  { id: 'gifts', label: '선물/경조사' },
  { id: 'other', label: '기타' }
];

export const incomeCategories: Array<{ id: IncomeCategoryId; label: string }> = [
  { id: 'salary', label: '월급' },
  { id: 'side', label: '부수입' },
  { id: 'carryOver', label: '전월 이월' },
  { id: 'refund', label: '환급' },
  { id: 'transfer', label: '이체' },
  { id: 'other', label: '기타' }
];
