import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

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
    vi.useRealTimers();
  });

  test('starts on the input tab and records income and expenses', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    expect(wrapper.get('[aria-selected="true"]').text()).toBe('입력');

    const incomeInput = wrapper.get<HTMLInputElement>('[aria-label="월 수입"]');
    await incomeInput.setValue('3000000');

    expect(incomeInput.element.value).toBe('3,000,000');

    await wrapper.get('[data-testid="save-income"]').trigger('click');

    expect(incomeInput.element.value).toBe('');

    const expenseAmountInput = wrapper.get<HTMLInputElement>('[aria-label="지출 금액"]');
    await expenseAmountInput.setValue('12000');

    expect(expenseAmountInput.element.value).toBe('12,000');

    await wrapper.get('[aria-label="지출 메모"]').setValue('점심');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    expect(wrapper.text()).toContain('3,000,000원');
    expect(wrapper.text()).toContain('12,000원');
    expect(wrapper.text()).toContain('점심');
    expect(localStorage.getItem('local-budget-app:v1')).toContain('"amount": 12000');
  });

  test('shows monthly totals on the dashboard tab', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.get('[aria-label="월 수입"]').setValue('100000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('외식');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await wrapper.findAll('button').find((button) => button.text() === '대시보드')?.trigger('click');

    expect(wrapper.text()).toContain('이번 달 요약');
    expect(wrapper.text()).toContain('80,000원');
    expect(wrapper.text()).toContain('점심/외식');
  });

  test('selects a registered year and month from the dashboard', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.get('[aria-label="대상 월"]').setValue('2026-06');
    await wrapper.get('[aria-label="월 수입"]').setValue('100000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-10');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('6월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    await wrapper.get('[aria-label="대상 월"]').setValue('2025-04');
    await wrapper.get('[aria-label="월 수입"]').setValue('50000');
    await wrapper.get('[data-testid="save-income"]').trigger('click');
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2025-04-02');
    await wrapper.get('[aria-label="지출 금액"]').setValue('30000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('4월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    await wrapper.findAll('button').find((button) => button.text() === '대시보드')?.trigger('click');

    expect(wrapper.get('[data-testid="dashboard-year-list"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="dashboard-year-list"]').text()).toContain('2025');
    expect(wrapper.get('[data-testid="dashboard-month-list"]').text()).toContain('4월');
    expect(wrapper.text()).toContain('4월 지출');

    await wrapper.findAll('[data-testid="dashboard-year"]').find((button) => button.text() === '2026')?.trigger('click');

    expect(wrapper.get('[data-testid="dashboard-month-list"]').text()).toContain('6월');

    await wrapper.findAll('[data-testid="dashboard-month"]').find((button) => button.text().includes('6월'))?.trigger('click');

    expect(wrapper.text()).toContain('2026-06');
    expect(wrapper.text()).toContain('6월 지출');
    expect(wrapper.text()).not.toContain('4월 지출');
  });

  test('shows spending statistics by year and selected year months', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.findAll('button').find((button) => button.text() === '통계')?.trigger('click');

    expect(wrapper.text()).toContain('아직 지출 통계가 없습니다');

    await wrapper.findAll('button').find((button) => button.text() === '입력')?.trigger('click');
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-06-10');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('6월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2026-04-02');
    await wrapper.get('[aria-label="지출 금액"]').setValue('20000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('4월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');
    await wrapper.get('[aria-label="지출 날짜"]').setValue('2025-04-02');
    await wrapper.get('[aria-label="지출 금액"]').setValue('30000');
    await wrapper.get('[aria-label="지출 메모"]').setValue('작년 4월 지출');
    await wrapper.get('[data-testid="expense-form"]').trigger('submit');

    await wrapper.findAll('button').find((button) => button.text() === '통계')?.trigger('click');

    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('2026');
    expect(wrapper.get('[data-testid="yearly-expense-chart"]').text()).toContain('40,000원');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('지출월 평균');
    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('4월 외 1개월 · 20,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('6월');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('20,000원');

    await wrapper.findAll('[data-testid="stat-year"]').find((button) => button.text().includes('2025'))?.trigger('click');

    expect(wrapper.get('[data-testid="statistics-summary"]').text()).toContain('30,000원');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('4월');
    expect(wrapper.get('[data-testid="monthly-expense-chart"]').text()).toContain('30,000원');
  });

  test('records person money and keeps settled records in history', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.findAll('button').find((button) => button.text() === '사람')?.trigger('click');
    await wrapper.get('[aria-label="사람 이름"]').setValue('민수');
    const personAmountInput = wrapper.get<HTMLInputElement>('[aria-label="사람별 금액"]');
    await personAmountInput.setValue('50000');

    expect(personAmountInput.element.value).toBe('50,000');

    await wrapper.get('[aria-label="사람별 메모"]').setValue('티켓');
    await wrapper.get('[data-testid="person-form"]').trigger('submit');

    expect(wrapper.text()).toContain('받을 돈 50,000원');

    await wrapper.get('[data-testid="toggle-settled"]').trigger('click');

    expect(wrapper.text()).toContain('정산 취소');
    expect(wrapper.text()).toContain('티켓');
    expect(wrapper.text()).toContain('현재 미정산 내역이 없습니다');
  });

  test('uses the revised input headings', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    const headings = wrapper.findAll('h2').map((heading) => heading.text());

    expect(headings).toContain('월 수입');
    expect(headings).toContain('일일 지출');
    expect(headings).not.toContain('빠른 기록');
    expect(wrapper.find('.form-panel .section-heading span').exists()).toBe(false);
  });

  test('hides backup status messages after three seconds', async () => {
    vi.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:local-budget')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const wrapper = mount(App, { global: { plugins: [createPinia()] } });

    await wrapper.findAll('button').find((button) => button.text() === '내보내기')?.trigger('click');

    expect(wrapper.text()).toContain('백업 파일을 내보냈습니다.');

    vi.advanceTimersByTime(3_000);
    await nextTick();

    expect(wrapper.text()).not.toContain('백업 파일을 내보냈습니다.');
  });
});
