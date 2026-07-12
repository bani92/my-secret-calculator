<template>
  <section class="login-shell">
    <form class="panel login-form" @submit.prevent="submit">
      <div class="section-heading compact">
        <h1>가계부 로그인</h1>
      </div>

      <label>
        이메일
        <input v-model="email" aria-label="이메일" type="email" autocomplete="email" required />
      </label>

      <label>
        비밀번호
        <input v-model="password" aria-label="비밀번호" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

      <button type="submit" class="primary-button" :disabled="loading">로그인</button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ loading: boolean; errorMessage: string }>();

const emit = defineEmits<{
  submit: [credentials: { email: string; password: string }];
}>();

const email = ref('');
const password = ref('');

function submit(): void {
  emit('submit', { email: email.value, password: password.value });
  password.value = '';
}
</script>
