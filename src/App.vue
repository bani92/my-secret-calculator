<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">개인 기록장</p>
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
          <span>{{ activeTabLabel }}</span>
          <h2>{{ activePanel.title }}</h2>
        </div>

        <form class="placeholder-form">
          <label>
            날짜
            <input type="date" disabled />
          </label>
          <label>
            금액
            <input type="text" inputmode="numeric" placeholder="0" disabled />
          </label>
          <label>
            메모
            <input type="text" placeholder="다음 작업에서 연결됩니다" disabled />
          </label>
          <button type="button" disabled>기록 준비 중</button>
        </form>
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

const panelCopy: Record<TabId, { title: string; emptyTitle: string; emptyText: string }> = {
  input: {
    title: '빠른 기록 영역',
    emptyTitle: '아직 입력 기능은 연결되지 않았습니다',
    emptyText: '다음 작업에서 월별 수입과 지출 기록을 이 화면에 연결합니다.'
  },
  dashboard: {
    title: '요약 미리보기',
    emptyTitle: '대시보드 자리만 준비했습니다',
    emptyText: '월별 합계, 카테고리 합계, 사람별 미정산 요약이 여기에 들어옵니다.'
  },
  people: {
    title: '사람별 기록 영역',
    emptyTitle: '사람 탭의 뼈대를 만들었습니다',
    emptyText: '받을 돈과 갚을 돈 기록은 도메인 로직이 추가된 뒤 연결됩니다.'
  }
};

const activeTab = ref<TabId>('input');
const activePanel = computed(() => panelCopy[activeTab.value]);
const activeTabLabel = computed(() => tabs.find((tab) => tab.id === activeTab.value)?.label ?? '');
</script>
