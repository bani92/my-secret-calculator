import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import App from './App.vue';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());

    let idCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('starts on the input tab and records income and expenses', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    expect(wrapper.get('[aria-selected="true"]').text()).toBe('입력');

    await wrapper.get('[aria-label="월 수입"]').setValue(3_000_000);
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await wrapper.get('[aria-label="지출 금액"]').setValue(12_000);
    await wrapper.get('[aria-label="지출 메모"]').setValue('점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    expect(wrapper.text()).toContain('3,000,000원');
    expect(wrapper.text()).toContain('12,000원');
    expect(wrapper.text()).toContain('점심');
    expect(localStorage.getItem('local-budget-app:v1')).toContain('"amount": 12000');
  });

  test('shows monthly totals on the dashboard tab', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.get('[aria-label="월 수입"]').setValue(100_000);
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await wrapper.get('[aria-label="지출 금액"]').setValue(20_000);
    await wrapper.get('[aria-label="지출 메모"]').setValue('외식');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await wrapper.findAll('button').find((button) => button.text() === '대시보드')?.trigger('click');

    expect(wrapper.text()).toContain('이번 달 요약');
    expect(wrapper.text()).toContain('80,000원');
    expect(wrapper.text()).toContain('점심/외식');
  });

  test('records person money and keeps settled records in history', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.findAll('button').find((button) => button.text() === '사람')?.trigger('click');
    await wrapper.get('[aria-label="사람 이름"]').setValue('민수');
    await wrapper.get('[aria-label="사람별 금액"]').setValue(50_000);
    await wrapper.get('[aria-label="사람별 메모"]').setValue('티켓');
    await wrapper.get('[data-testid="person-form"]').trigger('submit');

    expect(wrapper.text()).toContain('받을 돈 50,000원');

    await wrapper.get('[data-testid="toggle-settled"]').trigger('click');

    expect(wrapper.text()).toContain('정산 취소');
    expect(wrapper.text()).toContain('티켓');
    expect(wrapper.text()).toContain('현재 미정산 내역이 없습니다');
  });
});
