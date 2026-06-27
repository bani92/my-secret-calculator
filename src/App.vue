<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">개인 기록용</p>
        <h1>로컬 가계부</h1>
      </div>
      <p class="header-note">빠른 입력을 먼저 준비하고 있어요.</p>
    </header>

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

    <section class="placeholder-layout" aria-live="polite">
      <section class="input-panel">
        <div class="section-heading">
          <span>{{ activeLabel }}</span>
          <h2>{{ activePanel.title }}</h2>
        </div>
        <p>{{ activePanel.description }}</p>
      </section>

      <section class="preview-panel">
        <div class="summary-strip">
          <article>
            <span>이번 달</span>
            <strong>0원</strong>
          </article>
          <article>
            <span>지출</span>
            <strong>0원</strong>
          </article>
          <article>
            <span>남은 금액</span>
            <strong>0원</strong>
          </article>
        </div>

        <div class="empty-state">
          <h2>{{ activePanel.emptyTitle }}</h2>
          <p>{{ activePanel.emptyText }}</p>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

type TabId = 'input' | 'dashboard' | 'people';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'input', label: '입력' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'people', label: '사람' }
];

const panels: Record<TabId, { title: string; description: string; emptyTitle: string; emptyText: string }> = {
  input: {
    title: '빠른 기록 영역',
    description: '다음 작업에서 날짜, 항목, 금액, 메모 입력을 연결합니다.',
    emptyTitle: '아직 입력 기능은 연결되지 않았습니다',
    emptyText: '월별 수입과 지출 기록은 도메인 로직을 추가한 뒤 이 화면에 붙입니다.'
  },
  dashboard: {
    title: '월별 요약 영역',
    description: '수입, 지출, 남은 금액, 카테고리별 합계를 보여줄 자리입니다.',
    emptyTitle: '대시보드 자리를 준비했습니다',
    emptyText: '월별 합계와 사람별 미정산 요약은 계산 로직을 추가한 뒤 표시합니다.'
  },
  people: {
    title: '사람별 기록 영역',
    description: '사람별로 받을 돈과 갚을 돈을 기록할 자리입니다.',
    emptyTitle: '사람 탭의 기본 구조를 만들었습니다',
    emptyText: '정산 완료 후에도 거래 기록은 남도록 이후 작업에서 연결합니다.'
  }
};

const activeTab = ref<TabId>('input');
const activePanel = computed(() => panels[activeTab.value]);
const activeLabel = computed(() => tabs.find((tab) => tab.id === activeTab.value)?.label ?? '');
</script>
