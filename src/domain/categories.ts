import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: 'food', label: '식비' },
  { id: 'transportation', label: '교통' },
  { id: 'housing', label: '주거' },
  { id: 'utilities', label: '공과금' },
  { id: 'healthcare', label: '의료' },
  { id: 'culture', label: '문화' },
  { id: 'shopping', label: '쇼핑' },
  { id: 'education', label: '교육' },
  { id: 'savings', label: '저축' },
  { id: 'other', label: '기타' }
];
