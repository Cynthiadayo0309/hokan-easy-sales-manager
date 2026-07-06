<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { formatPeriodDateRange } from '@shared/calculations/periods';
import type {
  AchievementResult,
  DashboardFacilityRow,
  DashboardSummary,
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

function formatForecast(summary: DashboardSummary): string {
  return summary.forecast.forecastSalesYen === null
    ? '－'
    : formatMoneyCompact(summary.forecast.forecastSalesYen);
}

onMounted(() => {
  void loadFacilityDashboard();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">施設別</p>
      <h2>{{ monthLabel }}の施設別達成状況</h2>
      <p>施設ごとの月間目標、累計、達成率、目標までの金額、月末予測を確認します。</p>
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
        この施設の実績はまだ入力されていません。「週次入力」から入力を始めてください。
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
          <p class="card-label">月間累計</p>
          <strong>{{ formatMoneyCompact(selectedFacility.actualSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">達成率</p>
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
            <h2>月末予測</h2>
            <p class="card-label">
              入力完了日数 {{ selectedFacility.forecast.completedDayCount }}日 /
              {{ selectedFacility.forecast.daysInMonth }}日
            </p>
          </div>
          <span class="status-text">{{ formatForecast(selectedFacility) }}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>施設一覧</h2>
            <p class="card-label">施設ごとの達成状況を比較します</p>
          </div>
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
            <span>{{ formatForecast(row) }}</span>
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
          <div>
            <h2>期間別推移</h2>
            <p class="card-label">この月全体の期間別実績です</p>
          </div>
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

    <p v-else class="message">
      表示できる施設がありません。「目標・単価設定」で施設を登録してください。
    </p>
  </section>
</template>
