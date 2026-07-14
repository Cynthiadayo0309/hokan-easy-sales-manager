<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import type {
  AchievementResult,
  DashboardFacilityRow,
  MonthlyDashboard
} from '@shared/types/app-api';
import { formatMoneyCompact } from '../utils/display';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const selectedFacilityId = ref<number | null>(null);
const dashboard = ref<MonthlyDashboard | null>(null);
const loading = ref(true);
const errorMessage = ref<string | null>(null);

const targetMonth = computed(() => `${selectedMonth.value}-01`);
const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-');
  return `${year}年${Number(month)}月`;
});
const selectedFacility = computed<DashboardFacilityRow | null>(() => {
  const rows = dashboard.value?.facilityRows ?? [];
  return rows.find((row) => row.facilityId === selectedFacilityId.value) ?? rows[0] ?? null;
});
const noTarget = computed(() => (selectedFacility.value?.targetSalesYen ?? 0) === 0);
const noActual = computed(() => (selectedFacility.value?.actualSalesYen ?? 0) === 0);

async function loadFacilityDashboard(): Promise<void> {
  loading.value = true;
  errorMessage.value = null;

  try {
    dashboard.value = await window.hokanApp.dashboard.getMonthly({
      targetMonth: targetMonth.value
    });

    if (!dashboard.value.facilityRows.some((row) => row.facilityId === selectedFacilityId.value)) {
      selectedFacilityId.value = dashboard.value.facilityRows[0]?.facilityId ?? null;
    }
  } catch {
    errorMessage.value = '施設別の達成状況を読み込めませんでした。もう一度開き直してください。';
  } finally {
    loading.value = false;
  }
}

function formatAchievement(achievement: AchievementResult): string {
  return achievement.ratePercent === null ? '－' : `${achievement.ratePercent.toFixed(1)}%`;
}

function achievementNote(achievement: AchievementResult): string {
  if (achievement.status === 'not_set') {
    return '目標未設定';
  }

  if (achievement.status === 'exceeded') {
    return '目標超過';
  }

  if (achievement.status === 'achieved') {
    return '目標達成';
  }

  return '目標まで';
}

function formatRemaining(achievement: AchievementResult): string {
  return formatMoneyCompact(Math.abs(achievement.remainingYen));
}

onMounted(() => {
  void loadFacilityDashboard();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">施設別</p>
      <h2>{{ monthLabel }}の施設別概算</h2>
      <p>施設ごとの月間目標と、月次人数から計算した概算売上・概算達成率を確認します。</p>
    </div>

    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>

    <section class="panel dashboard-toolbar" :aria-busy="loading">
      <div>
        <p class="card-label">対象年月</p>
        <h2>{{ monthLabel }}</h2>
      </div>
      <div class="dashboard-month-actions">
        <label class="month-field compact">
          <span>年月を選ぶ</span>
          <input v-model="selectedMonth" type="month" @change="loadFacilityDashboard" />
        </label>
        <label v-if="dashboard && dashboard.facilityRows.length > 0" class="month-field compact">
          <span>施設を選ぶ</span>
          <select v-model.number="selectedFacilityId">
            <option
              v-for="facility in dashboard.facilityRows"
              :key="facility.facilityId"
              :value="facility.facilityId"
            >
              {{ facility.facilityName }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <p v-if="loading" class="message" aria-live="polite">施設別の達成状況を読み込んでいます。</p>

    <template v-else-if="dashboard && selectedFacility">
      <p v-if="noTarget" class="message">
        この施設の月間目標が設定されていません。「目標・単価設定」から登録してください。
      </p>
      <p v-else-if="noActual" class="message">
        この施設の実績はまだ入力されていません。「月次入力」から入力を始めてください。
      </p>

      <div class="summary-grid dashboard-summary-grid">
        <section class="summary-card">
          <p class="card-label">施設</p>
          <strong>{{ selectedFacility.facilityName }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">月間目標</p>
          <strong>{{ formatMoneyCompact(selectedFacility.targetSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">概算売上</p>
          <strong>{{ formatMoneyCompact(selectedFacility.actualSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">概算達成率</p>
          <strong>{{ formatAchievement(selectedFacility.achievement) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">{{ achievementNote(selectedFacility.achievement) }}</p>
          <strong>{{ formatRemaining(selectedFacility.achievement) }}</strong>
        </section>
      </div>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>施設一覧</h2>
            <p class="card-label">施設ごとの概算達成状況を比較します</p>
          </div>
          <span class="status-text">{{ dashboard.facilityRows.length }}施設</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>施設</span>
            <span>目標</span>
            <span>概算売上</span>
            <span>概算達成率</span>
          </div>
          <button
            v-for="row in dashboard.facilityRows"
            :key="row.facilityId"
            :class="[
              'dashboard-row',
              'dashboard-row-button',
              { active: row.facilityId === selectedFacilityId }
            ]"
            type="button"
            @click="selectedFacilityId = row.facilityId"
          >
            <strong>{{ row.facilityName }}</strong>
            <span>{{ formatMoneyCompact(row.targetSalesYen) }}</span>
            <span>{{ formatMoneyCompact(row.actualSalesYen) }}</span>
            <span>{{ formatAchievement(row.achievement) }}</span>
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>看護区分別内訳</h2>
            <p class="card-label">この月全体の看護区分別集計です</p>
          </div>
          <span class="status-text">{{ dashboard.nursingCategoryRows.length }}区分</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>看護区分</span>
            <span>目標</span>
            <span>概算売上</span>
            <span>人数</span>
          </div>
          <div
            v-for="row in dashboard.nursingCategoryRows"
            :key="row.nursingCategoryId"
            class="dashboard-row"
          >
            <strong>{{ row.nursingCategoryName }}</strong>
            <span>{{ formatMoneyCompact(row.targetSalesYen) }}</span>
            <span>{{ formatMoneyCompact(row.actualSalesYen) }}</span>
            <span>{{ row.actualPeopleCount.toLocaleString('ja-JP') }}人</span>
          </div>
        </div>
      </section>
    </template>

    <p v-else class="message">
      表示できる施設がありません。「目標・単価設定」で施設を登録してください。
    </p>
  </section>
</template>
