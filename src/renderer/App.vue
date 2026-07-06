<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useRoute } from 'vue-router';

import { useAppStatusStore } from './stores/app-status';
import { formatAppEnvironment } from './utils/display';

const route = useRoute();
const appStatus = useAppStatusStore();

const screenTitleByRouteName: Record<string, string> = {
  home: 'ホーム',
  'initial-setup': '初期設定',
  'weekly-input': '週次入力',
  facility: '施設別',
  history: '過去月',
  settings: '目標・単価設定',
  backup: 'バックアップ・設定'
};

const currentScreenTitle = computed(() => {
  const routeName = typeof route.name === 'string' ? route.name : '';
  return screenTitleByRouteName[routeName] ?? '訪看かんたん売上管理';
});

const statusLabel = computed(() => {
  if (appStatus.loading) {
    return '確認中';
  }

  if (appStatus.errorMessage) {
    return '状態確認エラー';
  }

  return appStatus.info ? formatAppEnvironment(appStatus.info.environment) : '準備完了';
});

const internalApiReady = computed(() => Boolean(window.hokanApp));

onMounted(() => {
  if (internalApiReady.value) {
    void appStatus.loadStatus();
  }
});
</script>

<template>
  <div v-if="!internalApiReady" class="startup-error-shell">
    <section class="startup-error-panel" role="alert" aria-live="assertive">
      <p class="eyebrow">起動エラー</p>
      <h1>アプリ内部通信を初期化できませんでした</h1>
      <p>
        アプリを開き直してください。繰り返し表示される場合は、開発者へこの画面をお知らせください。
      </p>
    </section>
  </div>

  <div v-else class="app-shell">
    <aside class="side-menu" aria-label="メインメニュー">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">訪</span>
        <div>
          <p class="brand-name">訪看かんたん売上管理</p>
          <p class="brand-subtitle">週1回の入力をかんたんに</p>
        </div>
      </div>

      <nav class="nav-list">
        <RouterLink to="/">ホーム</RouterLink>
        <RouterLink to="/weekly-input">週次入力</RouterLink>
        <RouterLink to="/facility">施設別</RouterLink>
        <RouterLink to="/history">過去月</RouterLink>
        <RouterLink to="/settings">目標・単価設定</RouterLink>
        <RouterLink to="/backup">バックアップ・設定</RouterLink>
      </nav>
    </aside>

    <div class="main-area">
      <header class="top-bar">
        <div>
          <p class="screen-label">現在の画面</p>
          <h1>{{ currentScreenTitle }}</h1>
        </div>
        <div class="top-status">
          <span class="status-pill">{{ statusLabel }}</span>
          <span v-if="appStatus.info" class="version-label">v{{ appStatus.info.version }}</span>
        </div>
      </header>

      <main class="content-area">
        <RouterView />
      </main>
    </div>
  </div>
</template>
