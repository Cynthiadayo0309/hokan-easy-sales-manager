<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useAppStatusStore } from '../stores/app-status';
import { formatAppEnvironment } from '../utils/display';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const working = ref(false);
const workingAction = ref<'detailCsv' | 'monthlyCsv' | 'backup' | 'restore' | null>(null);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const appStatus = useAppStatusStore();

const targetMonth = computed(() => `${selectedMonth.value}-01`);
const isWorkingOn = computed(
  () => (action: typeof workingAction.value) => workingAction.value === action
);

function setMessage(text: string): void {
  message.value = text;
  errorMessage.value = null;
}

function setError(text: string): void {
  errorMessage.value = text;
  message.value = null;
}

async function exportDetailCsv(): Promise<void> {
  if (working.value) {
    return;
  }

  working.value = true;
  workingAction.value = 'detailCsv';

  try {
    const result = await window.hokanApp.export.detailCsv({ targetMonth: targetMonth.value });
    if (result.ok) {
      setMessage(result.message);
    } else {
      setError(result.message);
    }
  } catch {
    setError('詳細CSVを保存できませんでした。もう一度お試しください。');
  } finally {
    working.value = false;
    workingAction.value = null;
  }
}

async function exportMonthlyCsv(): Promise<void> {
  if (working.value) {
    return;
  }

  working.value = true;
  workingAction.value = 'monthlyCsv';

  try {
    const result = await window.hokanApp.export.monthlyCsv({ targetMonth: targetMonth.value });
    if (result.ok) {
      setMessage(result.message);
    } else {
      setError(result.message);
    }
  } catch {
    setError('月間集計CSVを保存できませんでした。もう一度お試しください。');
  } finally {
    working.value = false;
    workingAction.value = null;
  }
}

async function createBackup(): Promise<void> {
  if (working.value) {
    return;
  }

  working.value = true;
  workingAction.value = 'backup';

  try {
    const result = await window.hokanApp.backup.create();
    if (result.ok) {
      setMessage(result.message);
    } else {
      setError(result.message);
    }
  } catch {
    setError('バックアップを作成できませんでした。もう一度お試しください。');
  } finally {
    working.value = false;
    workingAction.value = null;
  }
}

async function restoreBackup(): Promise<void> {
  if (working.value) {
    return;
  }

  const firstConfirm = window.confirm(
    '現在のデータはバックアップの内容に置き換わります。先に現在のデータを自動退避します。'
  );
  if (!firstConfirm) {
    return;
  }

  const secondConfirm = window.confirm('復元を実行します。よろしいですか？');
  if (!secondConfirm) {
    return;
  }

  working.value = true;
  workingAction.value = 'restore';

  try {
    const result = await window.hokanApp.backup.restore();
    if (result.ok) {
      setMessage(result.message);
    } else {
      setError(result.message);
    }
  } catch {
    setError('バックアップから復元できませんでした。現在のデータは維持されています。');
  } finally {
    working.value = false;
    workingAction.value = null;
  }
}

onMounted(() => {
  if (!appStatus.info && !appStatus.loading) {
    void appStatus.loadStatus();
  }
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">バックアップ・設定</p>
      <h2>データを守る・出力する</h2>
      <p>CSV出力、バックアップ作成、バックアップからの復元をここで行います。</p>
    </div>

    <p v-if="message" class="message success" aria-live="polite">{{ message }}</p>
    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>

    <section class="panel" :aria-busy="working">
      <div class="panel-heading">
        <div>
          <h2>CSV出力</h2>
          <p class="card-label">Excelで開きやすいUTF-8 CSVを保存します</p>
        </div>
        <label class="month-field compact">
          <span>対象年月</span>
          <input v-model="selectedMonth" type="month" />
        </label>
      </div>
      <div class="backup-action-grid">
        <button class="primary-button" :disabled="working" type="button" @click="exportDetailCsv">
          {{ isWorkingOn('detailCsv') ? '詳細CSVを出力中' : '詳細CSVを保存' }}
        </button>
        <button class="primary-button" :disabled="working" type="button" @click="exportMonthlyCsv">
          {{ isWorkingOn('monthlyCsv') ? '月間集計CSVを出力中' : '月間集計CSVを保存' }}
        </button>
      </div>
    </section>

    <section class="panel" :aria-busy="working">
      <div class="panel-heading">
        <div>
          <h2>バックアップ</h2>
          <p class="card-label">SQLite DBファイルとして保存・復元します</p>
        </div>
      </div>
      <div class="backup-action-grid">
        <button class="primary-button" :disabled="working" type="button" @click="createBackup">
          {{ isWorkingOn('backup') ? 'バックアップ中' : 'データをバックアップ' }}
        </button>
        <button class="danger-button" :disabled="working" type="button" @click="restoreBackup">
          {{ isWorkingOn('restore') ? '復元中' : 'バックアップから復元' }}
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>アプリ情報</h2>
          <p class="card-label">問い合わせや更新確認に使う情報です</p>
        </div>
      </div>
      <div class="app-info-grid">
        <div>
          <p class="card-label">アプリ名</p>
          <strong>{{ appStatus.info?.name ?? '訪看かんたん売上管理' }}</strong>
        </div>
        <div>
          <p class="card-label">バージョン</p>
          <strong>{{ appStatus.info ? `v${appStatus.info.version}` : '確認中' }}</strong>
        </div>
        <div>
          <p class="card-label">実行環境</p>
          <strong>{{
            appStatus.info ? formatAppEnvironment(appStatus.info.environment) : '確認中'
          }}</strong>
        </div>
        <div>
          <p class="card-label">データ保存先</p>
          <strong class="path-text">{{ appStatus.info?.userDataPath ?? '確認中' }}</strong>
        </div>
        <div>
          <p class="card-label">DBファイル</p>
          <strong class="path-text">{{ appStatus.info?.databasePath ?? '確認中' }}</strong>
        </div>
      </div>
    </section>
  </section>
</template>
