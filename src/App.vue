<template>
  <main class="app-shell">
    <section v-if="!authStore.isInitialized" class="panel">
      <p class="empty-copy">로그인 상태를 확인하는 중입니다.</p>
    </section>

    <LoginForm
      v-else-if="!authStore.session"
      :loading="authStore.isLoading"
      :error-message="authStore.errorMessage"
      @submit="login"
    />

    <template v-else>
      <header class="app-header">
        <div>
          <p class="eyebrow">개인 기록용</p>
          <h1>로컬 가계부</h1>
        </div>
        <div class="backup-actions">
          <template v-if="store.isLoaded">
            <button type="button" class="secondary-button" @click="downloadBackup">내보내기</button>
            <label class="file-button">
              가져오기
              <input type="file" accept="application/json" @change="importBackup" />
            </label>
          </template>
          <button type="button" class="secondary-button" aria-label="로그아웃" @click="logout">로그아웃</button>
        </div>
      </header>

      <p v-if="statusMessage" class="status-message" role="status">{{ statusMessage }}</p>

      <section v-if="!store.isLoaded" class="panel">
        <p class="empty-copy">{{ store.loadError || '가계부를 불러오는 중입니다.' }}</p>
        <button v-if="store.loadError" type="button" class="primary-button" @click="retryInitializeBudget">
          다시 시도
        </button>
      </section>

      <template v-else>
        <nav class="tabs" aria-label="주요 화면">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="tab"
            :class="{ active: activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <LedgerTab v-if="activeTab === 'input'" :initial-expense-date="pendingExpenseDate" />
        <DashboardTab v-else-if="activeTab === 'dashboard'" />
        <StatisticsTab v-else-if="activeTab === 'statistics'" />
        <CalendarTab v-else-if="activeTab === 'calendar'" @select-date="selectCalendarDate" />
        <PersonMoneyTab v-else />
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onErrorCaptured, onMounted, ref, watch } from 'vue';

import CalendarTab from './components/CalendarTab.vue';
import DashboardTab from './components/DashboardTab.vue';
import LedgerTab from './components/LedgerTab.vue';
import LoginForm from './components/LoginForm.vue';
import PersonMoneyTab from './components/PersonMoneyTab.vue';
import StatisticsTab from './components/StatisticsTab.vue';
import { useAuthStore } from './stores/authStore';
import { useBudgetStore } from './stores/budgetStore';

type TabId = 'input' | 'dashboard' | 'statistics' | 'calendar' | 'people';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'input', label: '입력' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'statistics', label: '통계' },
  { id: 'calendar', label: '캘린더' },
  { id: 'people', label: '사람' }
];

const authStore = useAuthStore();
const store = useBudgetStore();
const activeTab = ref<TabId>('input');
const pendingExpenseDate = ref<string | undefined>();
const statusMessage = ref('');
let statusTimer: ReturnType<typeof setTimeout> | undefined;
let budgetSessionVersion = 0;

onMounted(() => {
  void authStore.initialize().catch(() => undefined);
});

watch(
  () => authStore.session?.user.id,
  (userId) => {
    const version = ++budgetSessionVersion;
    store.reset();

    if (userId) {
      void initializeBudget(version, userId);
    }
  },
  { immediate: true }
);

onErrorCaptured(() => {
  showStatus('변경사항을 저장하지 못했습니다.');
  return false;
});

async function initializeBudget(
  version = budgetSessionVersion,
  userId = authStore.session?.user.id
): Promise<void> {
  try {
    await store.initialize();

    if (version !== budgetSessionVersion || authStore.session?.user.id !== userId) {
      store.reset();
      const currentUserId = authStore.session?.user.id;

      if (currentUserId) {
        void initializeBudget(budgetSessionVersion, currentUserId);
      }
    }
  } catch {
    if (version === budgetSessionVersion && authStore.session?.user.id === userId) {
      showStatus('가계부를 불러오지 못했습니다.');
    }
  }
}

function retryInitializeBudget(): void {
  void initializeBudget();
}

async function login(credentials: { email: string; password: string }): Promise<void> {
  try {
    await authStore.login(credentials.email, credentials.password);
  } catch {
    // The auth store exposes its own user-facing error message.
  }
}

async function logout(): Promise<void> {
  try {
    await authStore.logout();
    store.reset();
  } catch {
    showStatus('로그아웃하지 못했습니다.');
  }
}

function showStatus(message: string): void {
  statusMessage.value = message;

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(() => {
    statusMessage.value = '';
  }, 3_000);
}

function selectCalendarDate(date: string): void {
  pendingExpenseDate.value = date;
  activeTab.value = 'input';
  showStatus(`${date} 날짜로 지출 입력을 준비했습니다.`);
}

async function downloadBackup(): Promise<void> {
  try {
    const blob = new Blob([await store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `local-budget-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showStatus('백업 파일을 내보냈습니다.');
  } catch {
    showStatus('백업 파일을 내보내지 못했습니다.');
  }
}

async function importBackup(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  try {
    await store.importJson(await file.text());
    showStatus('백업 파일을 가져왔습니다.');
  } catch (error) {
    showStatus(isUnsupportedBackupError(error) ? '지원하지 않는 백업 파일입니다.' : '백업 파일을 저장하지 못했습니다.');
  } finally {
    input.value = '';
  }
}

function isUnsupportedBackupError(error: unknown): boolean {
  return error instanceof SyntaxError || (error instanceof Error && error.message === '지원하지 않는 백업 파일입니다');
}
</script>
