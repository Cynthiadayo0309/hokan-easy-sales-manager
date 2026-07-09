<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import type { MonthlyDashboard, MonthClosingStatus } from '@shared/types/app-api';
import { formatMoneyCompact } from '../utils/display';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const dashboard = ref<MonthlyDashboard | null>(null);
const closingStatus = ref<MonthClosingStatus | null>(null);
const loading = ref(true);
const saving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const targetMonth = computed(() => `${selectedMonth.value}-01`);
const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-');
  return `${year}年${Number(month)}月`;
});
const missingEntryWarnings = computed(
  () => closingStatus.value?.warnings.filter((warning) => warning.type === 'missing_entry') ?? []
);
const missingTargetWarnings = computed(
  () => closingStatus.value?.warnings.filter((warning) => warning.type === 'missing_target') ?? []
);

function setMessage(text: string): void {
  message.value = text;
  errorMessage.value = null;
}

function setError(text: string): void {
  errorMessage.value = text;
  message.value = null;
}

async function loadHistory(): Promise<void> {
  loading.value = true;
  message.value = null;
  errorMessage.value = null;

  try {
    dashboard.value = await window.hokanApp.dashboard.getMonthly({
      targetMonth: targetMonth.value
    });
    closingStatus.value = await window.hokanApp.closings.getStatus({
      targetMonth: targetMonth.value
    });
  } catch {
    setError('過去月の情報を読み込めませんでした。もう一度開き直してください。');
  } finally {
    loading.value = false;
  }
}

async function closeMonth(): Promise<void> {
  if (saving.value) {
    return;
  }

  if (missingEntryWarnings.value.length > 0) {
    setError('月次入力が未完了の施設があります。すべて入力完了にしてから締めてください。');
    return;
  }

  const hasWarnings = missingTargetWarnings.value.length > 0;
  const confirmed = window.confirm(
    hasWarnings
      ? '月間目標が未設定の項目があります。このまま月を締めますか？'
      : `${monthLabel.value}を締めます。締め後は通常入力できません。`
  );

  if (!confirmed) {
    return;
  }

  saving.value = true;

  try {
    closingStatus.value = await window.hokanApp.closings.closeMonth({
      targetMonth: targetMonth.value,
      acknowledgeWarnings: hasWarnings
    });
    setMessage(`${monthLabel.value}を締めました。`);
  } catch {
    setError('月を締められませんでした。未入力と目標設定を確認してください。');
  } finally {
    saving.value = false;
  }
}

async function reopenMonth(): Promise<void> {
  if (saving.value) {
    return;
  }

  const confirmed = window.confirm(
    `${monthLabel.value}を再開します。入力と目標編集が可能になります。`
  );
  if (!confirmed) {
    return;
  }

  saving.value = true;

  try {
    closingStatus.value = await window.hokanApp.closings.reopenMonth({
      targetMonth: targetMonth.value
    });
    setMessage(`${monthLabel.value}を再開しました。`);
  } catch {
    setError('月を再開できませんでした。もう一度お試しください。');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadHistory();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">過去月・月締め</p>
      <h2>{{ monthLabel }}の確認</h2>
      <p>過去月の実績を確認し、入力が終わった月を締めます。締めた月は通常入力できません。</p>
    </div>

    <p v-if="message" class="message success" aria-live="polite">{{ message }}</p>
    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>

    <section class="panel dashboard-toolbar" :aria-busy="loading || saving">
      <div>
        <p class="card-label">対象年月</p>
        <h2>{{ monthLabel }}</h2>
      </div>
      <label class="month-field compact">
        <span>年月を選ぶ</span>
        <input v-model="selectedMonth" type="month" @change="loadHistory" />
      </label>
    </section>

    <p v-if="loading" class="message">過去月を読み込んでいます。</p>

    <template v-else-if="dashboard && closingStatus">
      <div class="summary-grid">
        <section class="summary-card">
          <p class="card-label">月間累計</p>
          <strong>{{ formatMoneyCompact(dashboard.summary.actualSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">前月との差</p>
          <strong>{{ formatMoneyCompact(closingStatus.comparison.differenceYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">締め状態</p>
          <strong>{{ closingStatus.status === 'closed' ? '締め済み' : '未締め' }}</strong>
        </section>
      </div>

      <section class="panel" :aria-busy="saving">
        <div class="panel-heading">
          <div>
            <h2>月締め</h2>
            <p class="card-label">
              未入力 {{ missingEntryWarnings.length }}件 / 目標未設定
              {{ missingTargetWarnings.length }}件
            </p>
          </div>
          <button
            v-if="closingStatus.status === 'open'"
            class="primary-button"
            :disabled="saving || missingEntryWarnings.length > 0"
            type="button"
            @click="closeMonth"
          >
            {{ saving ? '月締め中' : 'この月を締める' }}
          </button>
          <button
            v-else
            class="secondary-button"
            :disabled="saving"
            type="button"
            @click="reopenMonth"
          >
            {{ saving ? '再開中' : 'この月を再開する' }}
          </button>
        </div>

        <p v-if="missingEntryWarnings.length > 0" class="message error">
          月次入力が未完了の施設があります。すべて入力完了にすると月締めできます。
        </p>
        <p v-else-if="missingTargetWarnings.length > 0" class="message">
          月間目標が未設定の項目があります。確認してから月締めしてください。
        </p>
        <p v-else class="message success">月締めできます。</p>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>確認が必要な項目</h2>
          <span class="status-text">{{ closingStatus.warnings.length }}件</span>
        </div>
        <div class="warning-list">
          <p v-if="closingStatus.warnings.length === 0" class="message success">
            確認が必要な項目はありません。
          </p>
          <p
            v-for="warning in closingStatus.warnings.slice(0, 20)"
            :key="`${warning.type}-${warning.facilityId}-${warning.periodIndex}-${warning.nursingCategoryId}`"
            class="message"
          >
            {{ warning.message }}
          </p>
        </div>
      </section>
    </template>
  </section>
</template>
