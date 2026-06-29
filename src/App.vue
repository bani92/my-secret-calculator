<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">개인 기록용</p>
        <h1>로컬 가계부</h1>
      </div>
      <div v-if="store.isLoaded" class="backup-actions">
        <button type="button" class="secondary-button" @click="downloadBackup">내보내기</button>
        <label class="file-button">
          가져오기
          <input type="file" accept="application/json" @change="importBackup" />
        </label>
      </div>
    </header>

    <p v-if="statusMessage" class="status-message" role="status">{{ statusMessage }}</p>

    <section v-if="!store.isLoaded" class="panel">
      <p class="empty-copy">{{ store.loadError || '가계부를 불러오는 중입니다.' }}</p>
      <button v-if="store.loadError" type="button" class="primary-button" @click="initializeApp">다시 시도</button>
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

      <LedgerTab v-if="activeTab === 'input'" />
      <DashboardTab v-else-if="activeTab === 'dashboard'" />
      <StatisticsTab v-else-if="activeTab === 'statistics'" />
      <PersonMoneyTab v-else />
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import DashboardTab from './components/DashboardTab.vue';
import LedgerTab from './components/LedgerTab.vue';
import PersonMoneyTab from './components/PersonMoneyTab.vue';
import StatisticsTab from './components/StatisticsTab.vue';
import { useBudgetStore } from './stores/budgetStore';

type TabId = 'input' | 'dashboard' | 'statistics' | 'people';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'input', label: '입력' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'statistics', label: '통계' },
  { id: 'people', label: '사람' }
];

const store = useBudgetStore();
const activeTab = ref<TabId>('input');
const statusMessage = ref('');
let statusTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  void initializeApp();
});

async function initializeApp(): Promise<void> {
  try {
    await store.initialize();
  } catch {
    showStatus('가계부를 불러오지 못했습니다.');
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
