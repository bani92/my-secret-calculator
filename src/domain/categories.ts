import type { CategoryId } from './types';

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
