<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { calculateEntryDetail, calculateEntrySummary } from '@shared/calculations/entries';
import { weeklyEntryStatusLabel } from '@shared/calculations/entry-status';
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
const selectedFacility = computed(
  () => facilities.value.find((facility) => facility.id === selectedFacilityId.value) ?? null
);
const currentStatus = computed<WeeklyEntryStatus>(() => currentForm.value?.status ?? 'not_started');
const completedFacilityCount = computed(
  () => statusMatrix.value?.cells.filter((cell) => cell.status === 'completed').length ?? 0
);
const calculatedSummary = computed(() =>
  calculateEntrySummary(
    nursingCategories.value.map((category) => {
      const detail = getInputDetail(category.id);
      const savedDetail = getSavedDetail(category.id);
      return {
        peopleCount: detail.peopleCount,
        rateYen: savedDetail?.rateYen ?? 0,
        billingMode: savedDetail?.billingMode ?? 'monthly'
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
    rateYen: savedDetail?.rateYen ?? 0,
    billingMode: savedDetail?.billingMode ?? 'monthly'
  });
}

function statusCell(facilityId: number): WeeklyEntryStatusCell | null {
  if (!selectedPeriodId.value) {
    return null;
  }

  return (
    statusMatrix.value?.cells.find(
      (cell) => cell.monthlyPeriodId === selectedPeriodId.value && cell.facilityId === facilityId
    ) ?? null
  );
}

function facilityStatusLabel(facilityId: number): string {
  return statusLabel(statusCell(facilityId)?.status ?? 'not_started');
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
    setError('入力内容を読み込めませんでした。施設と対象月を確認してください。');
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

    selectedPeriodId.value = periods.value[0]?.id ?? null;

    if (!facilities.value.some((facility) => facility.id === selectedFacilityId.value)) {
      selectedFacilityId.value = facilities.value[0]?.id ?? null;
    }

    await loadEntry();
  } catch {
    setError('月次入力の準備ができませんでした。初期設定と単価設定を確認してください。');
  } finally {
    loading.value = false;
  }
}

async function selectFacility(facilityId: number): Promise<void> {
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
    setError('保存できませんでした。単価設定と入力内容を確認してください。');
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
      <p class="eyebrow">月次実績入力</p>
      <h2>施設ごとの月次人数を入力する</h2>
      <p>
        介護・別表7・精神・特指示の月次人数を入力します。追加訪問開始時は人数に足して保存します。
      </p>
    </div>

    <p v-if="message" class="message success" aria-live="polite">{{ message }}</p>
    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>

    <section class="panel" :aria-busy="loading || saving">
      <div class="panel-heading">
        <div>
          <h2>{{ monthLabel }}</h2>
          <p class="card-label">
            入力完了 {{ completedFacilityCount }}施設 / {{ facilities.length }}施設
          </p>
        </div>
        <label class="month-field">
          <span>対象年月</span>
          <input v-model="selectedMonth" type="month" @change="loadMonth" />
        </label>
      </div>

      <p v-if="loading" class="message">月次入力を読み込んでいます。</p>

      <template v-else>
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

        <div class="weekly-context-grid">
          <div>
            <span>対象月</span>
            <strong>{{ monthLabel }}</strong>
          </div>
          <div>
            <span>現在の施設</span>
            <strong>{{ selectedFacility?.name ?? '施設なし' }}</strong>
          </div>
          <div>
            <span>保存状態</span>
            <strong>{{ statusLabel(currentStatus) }}</strong>
          </div>
        </div>

        <div class="weekly-summary-grid">
          <div class="summary-card">
            <p class="card-label">月次人数合計</p>
            <strong>{{ calculatedSummary.peopleCount.toLocaleString('ja-JP') }}人</strong>
          </div>
          <div class="summary-card">
            <p class="card-label">売上見込み</p>
            <strong>{{ formatYen(calculatedSummary.salesYen) }}</strong>
          </div>
        </div>

        <div class="entry-table" role="table" aria-label="月次実績入力">
          <div class="entry-row entry-head" role="row">
            <span>看護区分</span>
            <span>月次人数</span>
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
