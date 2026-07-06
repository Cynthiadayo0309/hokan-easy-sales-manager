<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { formatPeriodDateRange } from '@shared/calculations/periods';
import type { AchievementResult, DashboardSummary, MonthlyDashboard } from '@shared/types/app-api';
import { formatMoneyCompact } from '../utils/display';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const dashboard = ref<MonthlyDashboard | null>(null);
const loading = ref(true);
const errorMessage = ref<string | null>(null);

const targetMonth = computed(() => `${selectedMonth.value}-01`);
const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-');
  return `${year}年${Number(month)}月`;
});
const focusedPeriod = computed(() =>
  dashboard.value?.periodRows.find(
    (period) => period.monthlyPeriodId === dashboard.value?.inputStatus.monthlyPeriodId
  )
);

async function loadDashboard(): Promise<void> {
  loading.value = true;
  errorMessage.value = null;

  try {
    dashboard.value = await window.hokanApp.dashboard.getMonthly({
      targetMonth: targetMonth.value
    });
  } catch {
    errorMessage.value = '月間ダッシュボードを読み込めませんでした。もう一度開き直してください。';
  } finally {
    loading.value = false;
  }
}

function moveMonth(offset: number): void {
  const [yearText, monthText] = selectedMonth.value.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + offset, 1));
  selectedMonth.value = date.toISOString().slice(0, 7);
  void loadDashboard();
}

function moveToCurrentMonth(): void {
  selectedMonth.value = new Date().toISOString().slice(0, 7);
  void loadDashboard();
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

function formatForecast(summary: DashboardSummary): string {
  return summary.forecast.forecastSalesYen === null
    ? '－'
    : formatMoneyCompact(summary.forecast.forecastSalesYen);
}

function inputStatusText(): string {
  if (!dashboard.value) {
    return '';
  }

  const status = dashboard.value.inputStatus;
  if (!status.monthlyPeriodId) {
    return '対象期間がまだありません。';
  }

  return `第${status.periodIndex}期間: ${status.facilityCount}施設中${status.completedFacilityCount}施設が入力完了です。`;
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">月間ダッシュボード</p>
      <h2>{{ monthLabel }}の売上見込み</h2>
      <p>週次入力と月間目標をもとに、月間累計、達成率、目標までの金額、月末予測を確認します。</p>
    </div>

    <section class="panel dashboard-toolbar" :aria-busy="loading">
      <div>
        <p class="card-label">対象年月</p>
        <h2>{{ monthLabel }}</h2>
      </div>
      <div class="dashboard-month-actions">
        <button class="secondary-button" type="button" @click="moveMonth(-1)">前月</button>
        <button class="secondary-button" type="button" @click="moveToCurrentMonth">今月</button>
        <button class="secondary-button" type="button" @click="moveMonth(1)">翌月</button>
        <label class="month-field compact">
          <span>年月を選ぶ</span>
          <input v-model="selectedMonth" type="month" @change="loadDashboard" />
        </label>
      </div>
    </section>

    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>
    <p v-if="loading" class="message" aria-live="polite">月間ダッシュボードを読み込んでいます。</p>

    <template v-else-if="dashboard">
      <div class="summary-grid dashboard-summary-grid">
        <section class="summary-card">
          <p class="card-label">月間目標</p>
          <strong>{{ formatMoneyCompact(dashboard.summary.targetSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">月間累計</p>
          <strong>{{ formatMoneyCompact(dashboard.summary.actualSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">達成率</p>
          <strong>{{ formatAchievement(dashboard.summary.achievement) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">{{ achievementNote(dashboard.summary.achievement) }}</p>
          <strong>{{ formatRemaining(dashboard.summary.achievement) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">月末予測</p>
          <strong>{{ formatForecast(dashboard.summary) }}</strong>
          <span class="card-note">
            完了日数 {{ dashboard.summary.forecast.completedDayCount }}日 /
            {{ dashboard.summary.forecast.daysInMonth }}日
          </span>
        </section>
      </div>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>入力状況</h2>
            <p class="card-label">{{ inputStatusText() }}</p>
          </div>
          <RouterLink class="primary-button link-button" to="/weekly-input">週次入力へ</RouterLink>
        </div>
        <p v-if="focusedPeriod" class="message">
          {{ formatPeriodDateRange(focusedPeriod) }} の入力状況を確認しています。
        </p>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>施設別</h2>
          <span class="status-text">{{ dashboard.facilityRows.length }}施設</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>施設</span>
            <span>目標</span>
            <span>累計</span>
            <span>達成率</span>
            <span>予測</span>
          </div>
          <div v-for="row in dashboard.facilityRows" :key="row.facilityId" class="dashboard-row">
            <strong>{{ row.facilityName }}</strong>
            <span>{{ formatMoneyCompact(row.targetSalesYen) }}</span>
            <span>{{ formatMoneyCompact(row.actualSalesYen) }}</span>
            <span>{{ formatAchievement(row.achievement) }}</span>
            <span>{{ formatForecast(row) }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>看護区分別</h2>
          <span class="status-text">{{ dashboard.nursingCategoryRows.length }}区分</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>看護区分</span>
            <span>目標</span>
            <span>累計</span>
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

      <section class="panel">
        <div class="panel-heading">
          <h2>期間別推移</h2>
          <span class="status-text">{{ dashboard.periodRows.length }}期間</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>期間</span>
            <span>売上</span>
            <span>人数</span>
            <span>入力完了</span>
          </div>
          <div v-for="row in dashboard.periodRows" :key="row.monthlyPeriodId" class="dashboard-row">
            <strong>第{{ row.periodIndex }}期間 {{ formatPeriodDateRange(row) }}</strong>
            <span>{{ formatMoneyCompact(row.salesYen) }}</span>
            <span>{{ row.peopleCount.toLocaleString('ja-JP') }}人</span>
            <span>{{ row.facilityCount }}施設中{{ row.completedFacilityCount }}施設</span>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
