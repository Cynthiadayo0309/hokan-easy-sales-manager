<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useSaveFeedback } from '@/composables/useSaveFeedback';
import type { Facility, MonthlyTarget, NursingCategory, RateSetting } from '@shared/types/app-api';

type SettingsTab = 'facilities' | 'rates' | 'targets';

interface TargetFormValue {
  targetPeopleCount: number;
  targetSalesThousandYen: string;
}

const activeTab = ref<SettingsTab>('facilities');
const facilities = ref<Facility[]>([]);
const nursingCategories = ref<NursingCategory[]>([]);
const newFacilityName = ref('');
const loading = ref(true);
const saving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const { clearSaveFeedback, saveFeedback, showSaveFeedback } = useSaveFeedback();
const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const rateValidFrom = computed(() => `${selectedMonth.value}-01`);
const effectiveRates = ref<RateSetting[]>([]);
const rateInputs = ref<Record<string, string>>({});
const targetInputs = ref<Record<string, TargetFormValue>>({});

const targetMonth = computed(() => `${selectedMonth.value}-01`);

function rateKey(categoryId: number): string {
  return String(categoryId);
}

function targetKey(facilityId: number, categoryId: number): string {
  return `${facilityId}:${categoryId}`;
}

function yenToThousandText(amountYen: number): string {
  const thousand = amountYen / 1000;
  return Number.isInteger(thousand)
    ? thousand.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
    : thousand.toLocaleString('ja-JP', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1
      });
}

function parseThousandTextToYen(value: string | number | undefined): number | null {
  const text = String(value ?? '')
    .replaceAll(',', '')
    .trim();

  if (!/^\d+(\.\d)?$/.test(text)) {
    return null;
  }

  const [wholeText, decimalText = ''] = text.split('.');
  const whole = Number.parseInt(wholeText, 10);
  const decimal = decimalText ? Number.parseInt(decimalText, 10) : 0;
  return whole * 1000 + decimal * 100;
}

function getRateYen(categoryId: number): number {
  return effectiveRates.value.find((rate) => rate.nursingCategoryId === categoryId)?.amountYen ?? 0;
}

function getTargetValue(facilityId: number, categoryId: number): TargetFormValue | undefined {
  return targetInputs.value[targetKey(facilityId, categoryId)];
}

function updateTargetSalesFromPeople(facilityId: number, categoryId: number): void {
  const value = getTargetValue(facilityId, categoryId);
  if (!value) {
    return;
  }

  const targetPeopleCount = Number(value.targetPeopleCount);
  if (!Number.isInteger(targetPeopleCount) || targetPeopleCount < 0) {
    return;
  }

  value.targetSalesThousandYen = yenToThousandText(targetPeopleCount * getRateYen(categoryId));
}

function formatTargetSalesInput(facilityId: number, categoryId: number): void {
  const value = getTargetValue(facilityId, categoryId);
  if (!value) {
    return;
  }

  const targetSalesYen = parseThousandTextToYen(value.targetSalesThousandYen);
  if (targetSalesYen === null) {
    return;
  }

  value.targetSalesThousandYen = yenToThousandText(targetSalesYen);
}

function targetSalesYenText(facilityId: number, categoryId: number): string {
  const targetSalesYen = parseThousandTextToYen(
    getTargetValue(facilityId, categoryId)?.targetSalesThousandYen
  );
  return targetSalesYen === null ? '' : targetSalesYen.toLocaleString('ja-JP');
}

function setMessage(text: string): void {
  message.value = text;
  errorMessage.value = null;
}

function setError(text: string): void {
  errorMessage.value = text;
  message.value = null;
}

function applyRateInputs(rates: RateSetting[]): void {
  const nextInputs: Record<string, string> = {};
  nursingCategories.value.forEach((category) => {
    const rate = rates.find((item) => item.nursingCategoryId === category.id);
    nextInputs[rateKey(category.id)] = rate ? yenToThousandText(rate.amountYen) : '0';
  });
  rateInputs.value = nextInputs;
}

function applyTargetInputs(targets: MonthlyTarget[]): void {
  const nextInputs: Record<string, TargetFormValue> = {};

  facilities.value.forEach((facility) => {
    nursingCategories.value.forEach((category) => {
      const target = targets.find(
        (item) => item.facilityId === facility.id && item.nursingCategoryId === category.id
      );
      nextInputs[targetKey(facility.id, category.id)] = {
        targetPeopleCount: target?.targetPeopleCount ?? 0,
        targetSalesThousandYen: target ? yenToThousandText(target.targetSalesYen) : '0'
      };
    });
  });

  targetInputs.value = nextInputs;
}

async function loadFacilities(): Promise<void> {
  facilities.value = await window.hokanApp.facilities.list();
}

async function loadRates(): Promise<void> {
  const rates = await window.hokanApp.rates.list({ validOn: rateValidFrom.value });
  effectiveRates.value = rates;
  applyRateInputs(rates);
}

async function loadTargets(): Promise<void> {
  const targets = await window.hokanApp.targets.getByMonth({ targetMonth: targetMonth.value });
  applyTargetInputs(targets);
}

async function loadSettings(): Promise<void> {
  loading.value = true;
  clearSaveFeedback();
  try {
    const setupStatus = await window.hokanApp.setup.getStatus();
    nursingCategories.value = setupStatus.nursingCategories;
    await loadFacilities();
    await loadRates();
    await loadTargets();
  } catch {
    setError('設定を読み込めませんでした。アプリを再起動してください。');
  } finally {
    loading.value = false;
  }
}

async function updateFacility(facility: Facility): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    await window.hokanApp.facilities.update({
      id: facility.id,
      name: facility.name,
      displayOrder: facility.displayOrder
    });
    showSaveFeedback(`${facility.name}の施設名`);
    setMessage('施設名を保存しました。');
    await loadFacilities();
    await loadTargets();
  } catch {
    clearSaveFeedback();
    setError('施設名を保存できませんでした。1文字以上40文字以内で入力してください。');
  } finally {
    saving.value = false;
  }
}

async function addFacility(): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    await window.hokanApp.facilities.create({ name: newFacilityName.value });
    newFacilityName.value = '';
    showSaveFeedback('施設');
    setMessage('施設を追加しました。');
    facilities.value = await window.hokanApp.facilities.list();
    await loadTargets();
  } catch {
    clearSaveFeedback();
    setError(
      '施設を追加できませんでした。施設名を確認し、アプリを開き直してもう一度お試しください。'
    );
  } finally {
    saving.value = false;
  }
}

async function restoreDefaultFacilities(): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    facilities.value = await window.hokanApp.facilities.restoreDefaults();
    showSaveFeedback('初期施設');
    setMessage('初期施設を復旧しました。施設名を必要に応じて変更してください。');
    await loadTargets();
  } catch {
    clearSaveFeedback();
    setError('初期施設を復旧できませんでした。アプリを開き直してもう一度お試しください。');
  } finally {
    saving.value = false;
  }
}

async function deactivateFacility(facility: Facility): Promise<void> {
  if (saving.value) {
    return;
  }

  const confirmed = window.confirm(`${facility.name}を停止します。過去のデータは削除されません。`);
  if (!confirmed) {
    return;
  }

  saving.value = true;

  try {
    await window.hokanApp.facilities.deactivate({ id: facility.id });
    showSaveFeedback(`${facility.name}の施設設定`);
    setMessage('施設を停止しました。');
    await loadFacilities();
    await loadTargets();
  } catch {
    clearSaveFeedback();
    setError('施設を停止できませんでした。もう一度お試しください。');
  } finally {
    saving.value = false;
  }
}

async function saveRates(): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    await window.hokanApp.rates.save({
      validFrom: rateValidFrom.value,
      rates: nursingCategories.value.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen: rateInputs.value[rateKey(category.id)] ?? '0'
      }))
    });
    showSaveFeedback('売上単価');
    setMessage('売上単価を保存しました。');
    await loadRates();
  } catch {
    clearSaveFeedback();
    setError('売上単価を保存できませんでした。0以上の数字で、小数は1桁まで入力してください。');
  } finally {
    saving.value = false;
  }
}

async function saveTargets(): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;

  try {
    await window.hokanApp.targets.saveMonthly({
      targetMonth: targetMonth.value,
      targets: facilities.value.flatMap((facility) =>
        nursingCategories.value.map((category) => {
          const value = targetInputs.value[targetKey(facility.id, category.id)];
          return {
            facilityId: facility.id,
            nursingCategoryId: category.id,
            targetPeopleCount: Number(value?.targetPeopleCount ?? 0),
            targetSalesThousandYen: value?.targetSalesThousandYen ?? '0'
          };
        })
      )
    });
    showSaveFeedback('月間目標');
    setMessage('月間目標を保存しました。');
    await loadTargets();
  } catch {
    clearSaveFeedback();
    setError(
      '月間目標を保存できませんでした。人数は0以上の整数、売上は千円単位で入力してください。'
    );
  } finally {
    saving.value = false;
  }
}

async function copyPreviousMonthTargets(): Promise<void> {
  if (saving.value) {
    return;
  }

  const confirmed = window.confirm(
    '前月の目標をこの月へコピーします。現在のこの月の目標は上書きされます。'
  );
  if (!confirmed) {
    return;
  }

  saving.value = true;

  try {
    const targets = await window.hokanApp.targets.copyPreviousMonth({
      targetMonth: targetMonth.value
    });
    applyTargetInputs(targets);
    setMessage('前月の目標をコピーしました。内容を確認してください。');
  } catch {
    setError('前月の目標をコピーできませんでした。前月の目標が登録されているか確認してください。');
  } finally {
    saving.value = false;
  }
}

async function reloadMonthSettings(): Promise<void> {
  await loadRates();
  await loadTargets();
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <section class="view-stack">
    <div class="notice">
      <p class="eyebrow">目標・単価設定</p>
      <h2>設定を変更する</h2>
      <p>施設名、区分ごとの売上単価、月間目標をここで設定します。金額の単位は千円です。</p>
    </div>

    <p v-if="message" class="message success" aria-live="polite">{{ message }}</p>
    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>
    <p v-if="saveFeedback" class="save-toast" role="status" aria-live="polite">
      {{ saveFeedback }}
    </p>

    <div class="settings-tabs" role="tablist" aria-label="設定メニュー">
      <button
        :class="{ active: activeTab === 'facilities' }"
        type="button"
        @click="activeTab = 'facilities'"
      >
        施設設定
      </button>
      <button :class="{ active: activeTab === 'rates' }" type="button" @click="activeTab = 'rates'">
        売上単価
      </button>
      <button
        :class="{ active: activeTab === 'targets' }"
        type="button"
        @click="activeTab = 'targets'"
      >
        月間目標
      </button>
    </div>

    <section v-if="activeTab === 'facilities'" class="panel" :aria-busy="loading || saving">
      <div class="panel-heading">
        <h2>施設一覧</h2>
        <span class="status-text">{{ loading ? '読み込み中' : `${facilities.length}件` }}</span>
      </div>

      <div v-if="!loading" class="facility-list">
        <p v-if="facilities.length === 0" class="message">
          施設が登録されていません。通常は初期施設が自動で作成されます。復旧ボタンを押すと、施設A〜施設Eを作成します。
        </p>
        <div v-for="facility in facilities" :key="facility.id" class="facility-edit-row">
          <label>
            <span>{{ facility.displayOrder }}番目</span>
            <input v-model="facility.name" maxlength="40" type="text" />
          </label>
          <button
            class="secondary-button"
            :disabled="saving"
            type="button"
            @click="updateFacility(facility)"
          >
            {{ saving ? '保存中' : '保存' }}
          </button>
          <button
            class="danger-button"
            :disabled="saving"
            type="button"
            @click="deactivateFacility(facility)"
          >
            停止
          </button>
        </div>
      </div>

      <button
        v-if="!loading && facilities.length === 0"
        class="primary-button section-action"
        :disabled="saving"
        type="button"
        @click="restoreDefaultFacilities"
      >
        {{ saving ? '復旧中' : '初期施設を復旧' }}
      </button>
    </section>

    <section v-if="activeTab === 'facilities'" class="panel" :aria-busy="saving">
      <h2>施設を追加</h2>
      <div class="facility-add-row">
        <label>
          <span>新しい施設名</span>
          <input v-model="newFacilityName" maxlength="40" type="text" />
        </label>
        <button class="primary-button" :disabled="saving" type="button" @click="addFacility">
          {{ saving ? '追加中' : '追加' }}
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'rates'" class="panel" :aria-busy="loading || saving">
      <div class="panel-heading">
        <div>
          <h2>売上単価</h2>
          <p class="card-label">単位: 千円</p>
        </div>
        <label class="month-field">
          <span>適用開始月</span>
          <input v-model="selectedMonth" type="month" @change="reloadMonthSettings" />
        </label>
      </div>

      <div class="rate-table" role="table" aria-label="売上単価">
        <div class="rate-row rate-head" role="row">
          <span>区分</span>
          <span>単価</span>
        </div>
        <div v-for="category in nursingCategories" :key="category.id" class="rate-row" role="row">
          <strong>{{ category.name }}</strong>
          <label class="rate-input">
            <input v-model="rateInputs[rateKey(category.id)]" inputmode="decimal" type="text" />
            <span>千円</span>
          </label>
        </div>
      </div>

      <button
        class="primary-button section-action"
        :disabled="saving"
        type="button"
        @click="saveRates"
      >
        {{ saving ? '保存中' : '売上単価を保存' }}
      </button>
    </section>

    <section v-if="activeTab === 'targets'" class="panel" :aria-busy="loading || saving">
      <div class="panel-heading">
        <div>
          <h2>月間目標</h2>
          <p class="card-label">売上の単位: 千円</p>
        </div>
        <label class="month-field">
          <span>対象年月</span>
          <input v-model="selectedMonth" type="month" @change="reloadMonthSettings" />
        </label>
      </div>

      <div class="target-actions">
        <button
          class="secondary-button"
          :disabled="saving"
          type="button"
          @click="copyPreviousMonthTargets"
        >
          {{ saving ? 'コピー中' : '前月の目標をコピー' }}
        </button>
      </div>

      <div class="target-table" role="table" aria-label="月間目標">
        <div class="target-row target-head" role="row">
          <span>施設</span>
          <span>区分</span>
          <span>目標人数</span>
          <span>目標売上（千円）</span>
        </div>
        <template v-for="facility in facilities" :key="facility.id">
          <div
            v-for="category in nursingCategories"
            :key="`${facility.id}-${category.id}`"
            class="target-row"
            role="row"
          >
            <strong>{{ facility.name }}</strong>
            <span>{{ category.name }}</span>
            <input
              v-model.number="targetInputs[targetKey(facility.id, category.id)].targetPeopleCount"
              min="0"
              type="number"
              @input="updateTargetSalesFromPeople(facility.id, category.id)"
            />
            <div class="target-sales-field">
              <label class="rate-input">
                <input
                  v-model="targetInputs[targetKey(facility.id, category.id)].targetSalesThousandYen"
                  inputmode="decimal"
                  type="text"
                  @blur="formatTargetSalesInput(facility.id, category.id)"
                />
                <span>千円</span>
              </label>
              <small v-if="targetSalesYenText(facility.id, category.id)">
                = {{ targetSalesYenText(facility.id, category.id) }}円
              </small>
            </div>
          </div>
        </template>
      </div>

      <button
        class="primary-button section-action"
        :disabled="saving"
        type="button"
        @click="saveTargets"
      >
        {{ saving ? '保存中' : '月間目標を保存' }}
      </button>
    </section>
  </section>
</template>
