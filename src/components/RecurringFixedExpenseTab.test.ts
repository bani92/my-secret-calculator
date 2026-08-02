import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { reactive } from 'vue';

import RecurringFixedExpenseTab from './RecurringFixedExpenseTab.vue';

const mockedStore = vi.hoisted(() => ({
  store: undefined as any
}));

vi.mock('../stores/budgetStore', () => ({
  useBudgetStore: () => mockedStore.store
}));

describe('RecurringFixedExpenseTab', () => {
  beforeEach(() => {
    mockedStore.store = reactive({
      data: {
        recurringFixedExpenseRules: [
          { id: 'rule-1', dayOfMonth: 1, categoryId: 'fixed', amount: 10000, memo: '통신요금', active: true },
          { id: 'rule-2', dayOfMonth: 5, categoryId: 'fixed', amount: 30000, memo: '자동차보험', active: true }
        ]
      },
      addRecurringFixedExpenseRule: vi.fn(async () => undefined),
      updateRecurringFixedExpenseRule: vi.fn(async () => undefined),
      deleteRecurringFixedExpenseRule: vi.fn(async () => undefined),
      getRecurringFixedExpenseStatuses: vi.fn(() => [
        { ruleId: 'rule-1', label: '8월 1일 통신요금', state: 'created' },
        { ruleId: 'rule-2', label: '8월 5일 자동차보험', state: 'scheduled' }
      ])
    });
  });

  test('lists recurring fixed expense rules and current-month statuses', () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    expect(wrapper.text()).toContain('통신요금');
    expect(wrapper.text()).toContain('10,000원');
    expect(wrapper.text()).toContain('자동차보험');
    expect(wrapper.text()).toContain('8월 1일 통신요금');
    expect(wrapper.text()).toContain('생성됨');
    expect(wrapper.text()).toContain('예정');
  });

  test('sorts recurring fixed expense rules by recurring day', () => {
    mockedStore.store.data.recurringFixedExpenseRules = [
      { id: 'rule-25', dayOfMonth: 25, categoryId: 'fixed', amount: 25000, memo: '25일 비용', active: true },
      { id: 'rule-1', dayOfMonth: 1, categoryId: 'fixed', amount: 10000, memo: '1일 비용', active: true },
      { id: 'rule-10', dayOfMonth: 10, categoryId: 'fixed', amount: 100000, memo: '10일 비용', active: true }
    ];

    const wrapper = mount(RecurringFixedExpenseTab);

    expect(wrapper.findAll('.recurring-rule-list .recurring-rule-item').map((item) => item.find('strong').text())).toEqual([
      '1일',
      '10일',
      '25일'
    ]);
  });

  test('adds a recurring fixed expense rule from the dialog', async () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    await wrapper.get('[data-testid="open-recurring-rule-add"]').trigger('click');
    await wrapper.get('[data-testid="recurring-rule-day"]').setValue('15');
    await wrapper.get('[data-testid="recurring-rule-category"]').setValue('fixed');
    await wrapper.get('[data-testid="recurring-rule-amount"]').setValue('50000');
    await wrapper.get('[data-testid="recurring-rule-memo"]').setValue('관리비');
    await wrapper.get('[data-testid="save-recurring-rule"]').trigger('click');

    expect(mockedStore.store.addRecurringFixedExpenseRule).toHaveBeenCalledWith({
      dayOfMonth: 15,
      categoryId: 'fixed',
      amount: 50000,
      memo: '관리비',
      active: true
    });
  });

  test('uses compact dialog controls for recurring day, active state, and actions', async () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    await wrapper.get('[data-testid="open-recurring-rule-add"]').trigger('click');

    const dayControl = wrapper.get('[data-testid="recurring-rule-day"]');
    expect(dayControl.element.tagName).toBe('SELECT');
    expect(dayControl.findAll('option').map((option) => option.text()).slice(0, 3)).toEqual([
      '1일',
      '2일',
      '3일'
    ]);
    expect(dayControl.findAll('option')[14].text()).toBe('15일');
    expect(wrapper.get('[data-testid="recurring-rule-active"]').classes()).toContain('checkbox-field');
    expect(wrapper.get('[data-testid="cancel-recurring-rule"]').classes()).toContain('dialog-action-button');
    expect(wrapper.get('[data-testid="save-recurring-rule"]').classes()).toContain('dialog-action-button');
  });

  test('updates and deletes an existing recurring fixed expense rule', async () => {
    const wrapper = mount(RecurringFixedExpenseTab);

    await wrapper.get('[data-testid="edit-recurring-rule-rule-1"]').trigger('click');
    await wrapper.get('[data-testid="recurring-rule-amount"]').setValue('20000');
    await wrapper.get('[data-testid="save-recurring-rule"]').trigger('click');

    expect(mockedStore.store.updateRecurringFixedExpenseRule).toHaveBeenCalledWith({
      id: 'rule-1',
      dayOfMonth: 1,
      categoryId: 'fixed',
      amount: 20000,
      memo: '통신요금',
      active: true
    });

    await wrapper.get('[data-testid="delete-recurring-rule-rule-1"]').trigger('click');

    expect(mockedStore.store.deleteRecurringFixedExpenseRule).toHaveBeenCalledWith('rule-1');
  });
});
