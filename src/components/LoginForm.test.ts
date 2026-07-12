import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';

import LoginForm from './LoginForm.vue';

describe('LoginForm', () => {
  test('submits the entered email and password', async () => {
    const wrapper = mount(LoginForm, { props: { loading: false, errorMessage: '' } });

    await wrapper.get('[aria-label="이메일"]').setValue('owner@example.com');
    await wrapper.get('[aria-label="비밀번호"]').setValue('password');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ email: 'owner@example.com', password: 'password' }]);
  });

  test('displays the supplied login error without signup controls', () => {
    const wrapper = mount(LoginForm, {
      props: { loading: false, errorMessage: '이메일 또는 비밀번호를 확인해주세요.' }
    });

    expect(wrapper.get('[role="alert"]').text()).toBe('이메일 또는 비밀번호를 확인해주세요.');
    expect(wrapper.text()).not.toContain('회원가입');
  });

  test('disables login while loading', () => {
    const wrapper = mount(LoginForm, { props: { loading: true, errorMessage: '' } });

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
  });
});
