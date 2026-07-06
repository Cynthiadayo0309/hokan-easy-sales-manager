<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { calculateEntryDetail, calculateEntrySummary } from '@shared/calculations/entries';
import {
  buildCopyPreviousMessage,
  weeklyEntryStatusLabel
} from '@shared/calculations/entry-status';
import { formatPeriodDateRange, isPartialPeriod } from '@shared/calculations/periods';
import type {
  Facility,
  MonthlyPeriod,
  NursingCategory,
  SaveWeeklyEntryDetailInput,
  WeeklyEntryDetail,
  WeeklyEntryForm,
  WeeklyEntryStatus,
  WeeklyEntryStatusCell,
  WeeklyEntryStatusMatrix
} from '@shared/types/app-api';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const selectedPeriodId = ref<number | null>(null);
const selectedFacilityId = ref<number | null>(null);
const periods = ref<MonthlyPeriod[]>([]);
const facilities = ref<Facility[]>([]);
const nursingCategories = ref<NursingCategory[]>([]);
const statusMatrix = ref<WeeklyEntryStatusMatrix | null>(null);
const currentForm = ref<WeeklyEntryForm | null>(null);
const formDetails = ref<SaveWeeklyEntryDetailInput[]>([]);
const loading = ref(true);
const saving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const targetMonth = computed(() => `${selectedMonth.value}-01`);
const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-');
  return `${year}年${Number(month)}月`;
});
const selectedPeriod = computed(
  () => periods.value.find((period) => period.id === selectedPeriodId.value) ?? null
);
const selectedFacility = computed(
  () => facilities.value.find((facility) => facility.id === selectedFacilityId.value) ?? null
);
const previousPeriod = computed(() => {
  if (!selectedPeriod.value) {
    return null;
  }

  const currentIndex = periods.value.findIndex((period) => period.id === selectedPeriod.value?.id);
  return currentIndex > 0 ? periods.value[currentIndex - 1] : null;
});
const currentStatus = computed<WeeklyEntryStatus>(() => currentForm.value?.status ?? 'not_started');
const calculatedSummary = computed(() =>
  calculateEntrySummary(
    nursingCategories.value.map((category) => {
      const detail = getInputDetail(category.id);
      const savedDetail = getSavedDetail(category.id);
      return {
        peopleCount: detail.peopleCount,
        rateYen: savedDetail?.rateYen ?? 0
      };
    })
  )
);

function setMessage(text: string): void {
  message.value = text;
  errorMessage.value = null;
}

function setError(text: string): void {
  errorMessage.value = text;
  message.value = null;
}

function statusLabel(status: WeeklyEntryStatus): string {
  return weeklyEntryStatusLabel(status);
}

function formatYen(amountYen: number): string {
  return `${amountYen.toLocaleString('ja-JP')}円`;
}

function inputValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function getSavedDetail(categoryId: number): WeeklyEntryDetail | null {
  return (
    currentForm.value?.details.find((detail) => detail.nursingCategoryId === categoryId) ?? null
  );
}

function getInputDetail(categoryId: number): SaveWeeklyEntryDetailInput {
  const detail = formDetails.value.find((item) => item.nursingCategoryId === categoryId);
  if (detail) {
    return detail;
  }

  return {
    nursingCategoryId: categoryId,
    peopleCount: null
  };
}

function rowSummary(categoryId: number) {
  const detail = getInputDetail(categoryId);
  const savedDetail = getSavedDetail(categoryId);
  return calculateEntryDetail({
    peopleCount: detail.peopleCount,
    rateYen: savedDetail?.rateYen ?? 0
  });
}

function statusCell(periodId: number, facilityId: number): WeeklyEntryStatusCell | null {
  return (
    statusMatrix.value?.cells.find(
      (cell) => cell.monthlyPeriodId === periodId && cell.facilityId === facilityId
    ) ?? null
  );
}

function facilityStatusLabel(facilityId: number): string {
  if (!selectedPeriodId.value) {
    return '未入力';
  }

  return statusLabel(statusCell(selectedPeriodId.value, facilityId)?.status ?? 'not_started');
}

function applyForm(form: WeeklyEntryForm): void {
  currentForm.value = form;
  nursingCategories.value = form.nursingCategories;
  formDetails.value = form.details.map((detail) => ({
    nursingCategoryId: detail.nursingCategoryId,
    peopleCount: detail.peopleCount
  }));
}

async function loadEntry(): Promise<void> {
  if (!selectedPeriodId.value || !selectedFacilityId.value) {
    currentForm.value = null;
    formDetails.value = [];
    return;
  }

  try {
    const form = await window.hokanApp.entries.get({
      targetMonth: targetMonth.value,
      monthlyPeriodId: selectedPeriodId.value,
      facilityId: selectedFacilityId.value
    });
    applyForm(form);
  } catch {
    setError('入力内容を読み込めませんでした。施設と期間を確認してください。');
  }
}

async function refreshStatusMatrix(): Promise<void> {
  statusMatrix.value = await window.hokanApp.entries.getStatusByMonth({
    targetMonth: targetMonth.value
  });
  periods.value = statusMatrix.value.periods;
  facilities.value = statusMatrix.value.facilities;
}

async function loadMonth(): Promise<void> {
  loading.value = true;
  message.value = null;
  errorMessage.value = null;

  try {
    const setupStatus = await window.hokanApp.setup.getStatus();
    nursingCategories.value = setupStatus.nursingCategories;
    await refreshStatusMatrix();

    if (!periods.value.some((period) => period.id === selectedPeriodId.value)) {
      selectedPeriodId.value = periods.value[0]?.id ?? null;
    }

    if (!facilities.value.some((facility) => facility.id === selectedFacilityId.value)) {
      selectedFacilityId.value = facilities.value[0]?.id ?? null;
    }

    await loadEntry();
  } catch {
    setError('週次入力の準備ができませんでした。初期設定と単価設定を確認してください。');
  } finally {
    loading.value = false;
  }
}

async function changePeriod(): Promise<void> {
  message.value = null;
  errorMessage.value = null;
  await loadEntry();
}

async function selectFacility(facilityId: number): Promise<void> {
  selectedFacilityId.value = facilityId;
  message.value = null;
  errorMessage.value = null;
  await loadEntry();
}

async function selectMatrixCell(periodId: number, facilityId: number): Promise<void> {
  selectedPeriodId.value = periodId;
  selectedFacilityId.value = facilityId;
  message.value = null;
  errorMessage.value = null;
  await loadEntry();
}

function updatePeople(categoryId: number, rawValue: string): void {
  const detail = getInputDetail(categoryId);
  const nextValue = rawValue === '' ? null : Number(rawValue);

  if (nextValue !== null && (!Number.isInteger(nextValue) || nextValue < 0 || nextValue > 99999)) {
    return;
  }

  formDetails.value = formDetails.value.map((item) =>
    item.nursingCategoryId === categoryId ? { ...detail, peopleCount: nextValue } : item
  );
}

function eventInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

function setAllZero(): void {
  if (saving.value) {
    return;
  }

  formDetails.value = formDetails.value.map((detail) => ({
    ...detail,
    peopleCount: 0
  }));
  setMessage('すべて0人にしました。保存すると反映されます。');
}

function saveInput() {
  return {
    targetMonth: targetMonth.value,
    monthlyPeriodId: selectedPeriodId.value ?? 0,
    facilityId: selectedFacilityId.value ?? 0,
    details: formDetails.value.map((detail) => ({
      nursingCategoryId: detail.nursingCategoryId,
      peopleCount: detail.peopleCount
    }))
  };
}

async function saveDraft(moveNext = false): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    const form = await window.hokanApp.entries.saveDraft(saveInput());
    applyForm(form);
    await refreshStatusMatrix();
    setMessage('一時保存しました。');

    if (moveNext) {
      await moveToNextFacility();
    }
  } catch {
    setError('保存できませんでした。目標・単価設定で単価を登録し、入力内容を確認してください。');
  } finally {
    saving.value = false;
  }
}

async function completeEntry(): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    const form = await window.hokanApp.entries.complete(saveInput());
    applyForm(form);
    await refreshStatusMatrix();
    setMessage('入力完了にしました。');
  } catch {
    setError('入力完了にできませんでした。空欄をなくし、0以上の整数で入力してください。');
  } finally {
    saving.value = false;
  }
}

async function copyPreviousEntry(): Promise<void> {
  if (saving.value) {
    return;
  }

  if (!selectedPeriod.value || !selectedFacility.value || !previousPeriod.value) {
    setError('前の期間がないためコピーできません。');
    return;
  }

  const confirmed = window.confirm(
    buildCopyPreviousMessage(previousPeriod.value, selectedPeriod.value)
  );

  if (!confirmed) {
    return;
  }

  saving.value = true;

  try {
    const form = await window.hokanApp.entries.copyPrevious({
      targetMonth: targetMonth.value,
      monthlyPeriodId: selectedPeriod.value.id,
      facilityId: selectedFacility.value.id
    });
    applyForm(form);
    await refreshStatusMatrix();
    setMessage('前期間の人数をコピーしました。内容を確認して保存または入力完了してください。');
  } catch {
    setError(
      '前期間をコピーできませんでした。同じ施設の前期間が保存されているか確認してください。'
    );
  } finally {
    saving.value = false;
  }
}

async function moveToNextFacility(): Promise<void> {
  const currentIndex = facilities.value.findIndex(
    (facility) => facility.id === selectedFacilityId.value
  );
  const nextFacility = facilities.value[currentIndex + 1];

  if (!nextFacility) {
    setMessage('一時保存しました。最後の施設まで入力しました。');
    return;
  }

  selectedFacilityId.value = nextFacility.id;
  await loadEntry();
  setMessage(`${nextFacility.name}へ移動しました。`);
}

onMounted(() => {
  void loadMonth();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">週次実績入力</p>
      <h2>施設ごとの人数を入力する</h2>
      <p>
        期間と施設を選び、介護・別表7・精神・特指示の人数を入力します。人数と売上見込みは入力中に確認できます。
      </p>
    </div>

    <p v-if="message" class="message success" aria-live="polite">{{ message }}</p>
    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>

    <section class="panel" :aria-busy="loading || saving">
      <div class="panel-heading">
        <div>
          <h2>{{ monthLabel }}</h2>
          <p class="card-label">対象月、期間、施設を選んで入力します</p>
        </div>
        <label class="month-field">
          <span>対象年月</span>
          <input v-model="selectedMonth" type="month" @change="loadMonth" />
        </label>
      </div>

      <p v-if="loading" class="message">週次入力を読み込んでいます。</p>

      <template v-else>
        <section class="status-matrix" aria-label="入力状況">
          <div class="status-matrix-heading">
            <div>
              <h3>入力状況</h3>
              <p class="card-label">セルを押すと、その期間と施設の入力へ移動します</p>
            </div>
            <span class="status-text">未入力・一時保存・入力完了</span>
          </div>
          <div class="status-matrix-table" role="table" aria-label="施設と期間の入力状況">
            <div class="status-matrix-row status-matrix-head" role="row">
              <span>施設</span>
              <span v-for="period in periods" :key="period.id">
                第{{ period.periodIndex }}期間<br />
                {{ formatPeriodDateRange(period) }}
              </span>
            </div>
            <div
              v-for="facility in facilities"
              :key="facility.id"
              class="status-matrix-row"
              role="row"
            >
              <strong>{{ facility.name }}</strong>
              <button
                v-for="period in periods"
                :key="period.id"
                :class="[
                  'status-cell',
                  `status-cell-${statusCell(period.id, facility.id)?.status ?? 'not_started'}`,
                  {
                    active: period.id === selectedPeriodId && facility.id === selectedFacilityId
                  }
                ]"
                type="button"
                @click="selectMatrixCell(period.id, facility.id)"
              >
                {{ statusLabel(statusCell(period.id, facility.id)?.status ?? 'not_started') }}
              </button>
            </div>
          </div>
        </section>

        <div class="weekly-context-grid">
          <label>
            <span>対象期間</span>
            <select v-model.number="selectedPeriodId" @change="changePeriod">
              <option v-for="period in periods" :key="period.id" :value="period.id">
                第{{ period.periodIndex }}期間 {{ formatPeriodDateRange(period) }}
              </option>
            </select>
          </label>
          <div>
            <span>現在の施設</span>
            <strong>{{ selectedFacility?.name ?? '施設なし' }}</strong>
          </div>
          <div>
            <span>保存状態</span>
            <strong>{{ statusLabel(currentStatus) }}</strong>
          </div>
        </div>

        <p v-if="selectedPeriod && isPartialPeriod(selectedPeriod)" class="message">
          この期間は月初または月末の短い期間です。月外の日付は含めていません。
        </p>

        <div class="facility-tabs" aria-label="施設選択">
          <button
            v-for="facility in facilities"
            :key="facility.id"
            :class="{ active: facility.id === selectedFacilityId }"
            type="button"
            @click="selectFacility(facility.id)"
          >
            <span>{{ facility.name }}</span>
            <small>{{ facilityStatusLabel(facility.id) }}</small>
          </button>
        </div>

        <div class="weekly-summary-grid">
          <div class="summary-card">
            <p class="card-label">人数合計</p>
            <strong>{{ calculatedSummary.peopleCount.toLocaleString('ja-JP') }}人</strong>
          </div>
          <div class="summary-card">
            <p class="card-label">売上見込み</p>
            <strong>{{ formatYen(calculatedSummary.salesYen) }}</strong>
          </div>
        </div>

        <div class="entry-table" role="table" aria-label="週次実績入力">
          <div class="entry-row entry-head" role="row">
            <span>看護区分</span>
            <span>人数</span>
            <span>売上見込み</span>
          </div>
          <div
            v-for="category in nursingCategories"
            :key="category.id"
            class="entry-row"
            role="row"
          >
            <strong>{{ category.name }}</strong>
            <input
              :value="inputValue(getInputDetail(category.id).peopleCount ?? null)"
              inputmode="numeric"
              max="99999"
              min="0"
              type="number"
              @input="updatePeople(category.id, eventInputValue($event))"
            />
            <span>{{ formatYen(rowSummary(category.id).salesYen) }}</span>
          </div>
        </div>

        <div class="entry-actions">
          <button class="secondary-button" :disabled="saving" type="button" @click="setAllZero">
            すべて0人
          </button>
          <button
            class="secondary-button"
            :disabled="saving || !previousPeriod"
            type="button"
            @click="copyPreviousEntry"
          >
            {{ saving ? 'コピー中' : '前期間をコピー' }}
          </button>
          <button
            class="secondary-button"
            :disabled="saving"
            type="button"
            @click="saveDraft(false)"
          >
            {{ saving ? '保存中' : '一時保存' }}
          </button>
          <button class="primary-button" :disabled="saving" type="button" @click="saveDraft(true)">
            {{ saving ? '保存中' : '保存して次の施設へ' }}
          </button>
          <button class="primary-button" :disabled="saving" type="button" @click="completeEntry">
            {{ saving ? '完了処理中' : '入力完了' }}
          </button>
        </div>
      </template>
    </section>
  </section>
</template>
