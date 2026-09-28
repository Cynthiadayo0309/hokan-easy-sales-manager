<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import type { AchievementResult, AnnualDashboard } from '@shared/types/app-api';
import { formatMoneyCompact } from '../utils/display';

const selectedYear = ref(new Date().getFullYear());
const dashboard = ref<AnnualDashboard | null>(null);
const loading = ref(true);
const errorMessage = ref<string | null>(null);

const yearLabel = computed(() => `${selectedYear.value}年`);

async function loadAnnualDashboard(): Promise<void> {
  if (!Number.isInteger(selectedYear.value) || selectedYear.value < 1000 || selectedYear.value > 9999) {
    errorMessage.value = '西暦4桁の年を入力してください。';
    return;
  }

  loading.value = true;
  errorMessage.value = null;

  try {
    dashboard.value = await window.hokanApp.dashboard.getAnnual({ year: selectedYear.value });
  } catch {
    errorMessage.value = '年間一覧を読み込めませんでした。もう一度お試しください。';
  } finally {
    loading.value = false;
  }
}

function formatAchievement(achievement: AchievementResult | null): string {
  return achievement?.ratePercent === null || !achievement ? '未入力' : `${achievement.ratePercent.toFixed(1)}%`;
}

function formatOptionalMoney(amountYen: number | null): string {
  return amountYen === null ? '未入力' : formatMoneyCompact(amountYen);
}

onMounted(() => {
  void loadAnnualDashboard();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">年間一覧</p>
      <h2>{{ yearLabel }}の売上と目標</h2>
      <p>目標・入力実績・確定売上を、年間合計と月別・施設別の一覧で確認できます。</p>
    </div>

    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>

    <section class="panel dashboard-toolbar" :aria-busy="loading">
      <div>
        <p class="card-label">対象年</p>
        <h2>{{ yearLabel }}</h2>
      </div>
      <label class="month-field compact">
        <span>年を選ぶ</span>
        <input v-model.number="selectedYear" type="number" min="1000" max="9999" step="1" @change="loadAnnualDashboard" />
      </label>
    </section>

    <p v-if="loading" class="message" aria-live="polite">年間一覧を読み込んでいます。</p>

    <template v-else-if="dashboard">
      <div class="summary-grid dashboard-summary-grid">
        <section class="summary-card">
          <p class="card-label">年間目標</p>
          <strong>{{ dashboard.summary.targetMonthCount ? formatMoneyCompact(dashboard.summary.targetSalesYen) : '未入力' }}</strong>
          <small class="card-note">入力済み {{ dashboard.summary.targetMonthCount }} / 12か月</small>
        </section>
        <section class="summary-card">
          <p class="card-label">入力実績</p>
          <strong>{{ formatMoneyCompact(dashboard.summary.actualSalesYen) }}</strong>
        </section>
        <section class="summary-card">
          <p class="card-label">確定売上</p>
          <strong>{{ dashboard.summary.confirmedMonthCount ? formatMoneyCompact(dashboard.summary.confirmedSalesYen) : '未入力' }}</strong>
          <small class="card-note">入力済み {{ dashboard.summary.confirmedMonthCount }} / 12か月</small>
        </section>
        <section class="summary-card">
          <p class="card-label">確定売上の達成率</p>
          <strong>{{ formatAchievement(dashboard.summary.confirmedAchievement) }}</strong>
        </section>
      </div>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>月別一覧</h2>
            <p class="card-label">未入力の目標・確定売上は年間合計に含めません。</p>
          </div>
          <span class="status-text">12か月</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>月</span>
            <span>目標</span>
            <span>入力実績</span>
            <span>確定売上</span>
            <span>達成率</span>
          </div>
          <div v-for="row in dashboard.monthlyRows" :key="row.targetMonth" class="dashboard-row">
            <strong>{{ Number(row.targetMonth.slice(5, 7)) }}月</strong>
            <span>{{ formatOptionalMoney(row.targetSalesYen) }}</span>
            <span>{{ formatMoneyCompact(row.actualSalesYen) }}</span>
            <span>{{ formatOptionalMoney(row.confirmedSalesYen) }}</span>
            <span>{{ formatAchievement(row.confirmedAchievement) }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>施設別の年間合計</h2>
            <p class="card-label">施設別の確定売上は、施設ごとの確定売上入力のみを集計します。</p>
          </div>
          <span class="status-text">{{ dashboard.facilityRows.length }}施設</span>
        </div>
        <div class="dashboard-table">
          <div class="dashboard-row dashboard-head">
            <span>施設</span>
            <span>目標</span>
            <span>入力実績</span>
            <span>確定売上</span>
            <span>達成率</span>
          </div>
          <div v-for="row in dashboard.facilityRows" :key="row.facilityId" class="dashboard-row">
            <strong>{{ row.facilityName }}</strong>
            <span>{{ formatOptionalMoney(row.targetSalesYen) }}</span>
            <span>{{ formatMoneyCompact(row.actualSalesYen) }}</span>
            <span>{{ formatOptionalMoney(row.confirmedSalesYen) }}</span>
            <span>{{ formatAchievement(row.confirmedAchievement) }}</span>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
