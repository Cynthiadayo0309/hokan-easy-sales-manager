<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import type { Facility, NursingCategory } from '@shared/types/app-api';

const router = useRouter();

const step = ref(1);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref<string | null>(null);
const facilities = ref<Facility[]>([]);
const nursingCategories = ref<NursingCategory[]>([]);
const rates = ref<Record<string, string>>({});

const requiredFacilityCount = 5;
const requiredNursingCategoryCount = 4;
const stepLabel = computed(() => `${step.value} / 4`);

function rateKey(categoryId: number): string {
  return String(categoryId);
}

function applyRateInputs(
  statusRates: Awaited<ReturnType<typeof window.hokanApp.setup.getStatus>>['rates']
): void {
  nursingCategories.value.forEach((category) => {
    const existingRate = statusRates.find((rate) => rate.nursingCategoryId === category.id);
    rates.value[rateKey(category.id)] = existingRate ? String(existingRate.amountYen / 1000) : '0';
  });
}

async function loadInitialSetupStatus(): Promise<void> {
  let status = await window.hokanApp.setup.getStatus();
  let nextFacilities = status.facilities;

  if (nextFacilities.length < requiredFacilityCount) {
    try {
      nextFacilities = await window.hokanApp.facilities.restoreDefaults();
      status = await window.hokanApp.setup.getStatus();
      nextFacilities =
        status.facilities.length >= nextFacilities.length ? status.facilities : nextFacilities;
    } catch {
      nextFacilities = status.facilities;
    }
  }

  if (nextFacilities.length < requiredFacilityCount) {
    try {
      nextFacilities = await window.hokanApp.facilities.list();
    } catch {
      // Keep the setup status result so the screen can show the Japanese recovery error below.
    }
  }

  facilities.value = nextFacilities.slice(0, requiredFacilityCount);
  nursingCategories.value = status.nursingCategories;
  applyRateInputs(status.rates);

  if (!validateRequiredMasters()) {
    return;
  }
}

function validateRequiredMasters(): boolean {
  if (facilities.value.length < requiredFacilityCount) {
    errorMessage.value =
      '初期施設を準備できませんでした。アプリを開き直して、もう一度お試しください。';
    return false;
  }

  if (nursingCategories.value.length < requiredNursingCategoryCount) {
    errorMessage.value =
      '看護区分を準備できませんでした。アプリを開き直して、もう一度お試しください。';
    return false;
  }

  errorMessage.value = null;
  return true;
}

function validateFacilityNames(): boolean {
  if (!validateRequiredMasters()) {
    return false;
  }

  const invalid = facilities.value.some((facility) => {
    const name = facility.name.trim();
    return name.length < 1 || name.length > 40;
  });

  if (invalid) {
    errorMessage.value = '施設名は1文字以上40文字以内で入力してください。';
    return false;
  }

  errorMessage.value = null;
  return true;
}

function validateRates(): boolean {
  if (!validateRequiredMasters()) {
    return false;
  }

  const invalid = nursingCategories.value.some(
    (category) => !/^\d+(\.\d)?$/.test((rates.value[rateKey(category.id)] ?? '').trim())
  );

  if (invalid) {
    errorMessage.value = '単価は0以上の数字で入力してください。小数は1桁まで使えます。';
    return false;
  }

  errorMessage.value = null;
  return true;
}

function nextStep(): void {
  if (step.value === 1 && !validateRequiredMasters()) {
    return;
  }

  if (step.value === 2 && !validateFacilityNames()) {
    return;
  }

  if (step.value === 3 && !validateRates()) {
    return;
  }

  step.value += 1;
}

function previousStep(): void {
  errorMessage.value = null;
  step.value -= 1;
}

async function completeSetup(): Promise<void> {
  if (saving.value) {
    return;
  }

  if (!validateRequiredMasters() || !validateFacilityNames() || !validateRates()) {
    return;
  }

  saving.value = true;
  errorMessage.value = null;

  try {
    await window.hokanApp.setup.complete({
      facilities: facilities.value.map((facility) => ({
        id: facility.id,
        name: facility.name
      })),
      rates: nursingCategories.value.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen: rates.value[rateKey(category.id)]
      }))
    });

    await router.push({ name: 'home' });
  } catch {
    errorMessage.value =
      '初期設定を保存できませんでした。入力内容を確認して、もう一度お試しください。';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    await loadInitialSetupStatus();
  } catch {
    errorMessage.value = '初期設定の準備ができませんでした。アプリを再起動してください。';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="setup-shell">
    <div class="setup-header">
      <p class="eyebrow">初期設定</p>
      <h2>最初に使う準備をします</h2>
      <span class="status-pill">ステップ {{ stepLabel }}</span>
    </div>

    <p v-if="errorMessage" class="message error" aria-live="assertive">{{ errorMessage }}</p>
    <p v-if="loading" class="message">初期設定の内容を準備しています。</p>

    <template v-else>
      <div v-if="step === 1" class="setup-panel" :aria-busy="loading || saving">
        <h3>訪看かんたん売上管理へようこそ</h3>
        <p>最初に施設名と売上単価を設定します。あとから設定画面で変更できます。</p>
        <button class="primary-button" type="button" @click="nextStep">はじめる</button>
      </div>

      <div v-else-if="step === 2" class="setup-panel" :aria-busy="loading || saving">
        <h3>施設名を入力してください</h3>
        <p>普段使っている分かりやすい名前にできます。</p>

        <div class="form-grid">
          <label v-for="(facility, index) in facilities" :key="facility.id" class="field-row">
            <span>施設{{ index + 1 }}</span>
            <input v-model="facility.name" maxlength="40" type="text" />
          </label>
        </div>

        <div class="button-row">
          <button class="secondary-button" type="button" @click="previousStep">戻る</button>
          <button class="primary-button" type="button" @click="nextStep">次へ</button>
        </div>
      </div>

      <div v-else-if="step === 3" class="setup-panel" :aria-busy="loading || saving">
        <h3>売上単価を入力してください</h3>
        <p>単位は千円です。例: 8.5千円は8,500円として保存します。</p>

        <div class="rate-table" role="table" aria-label="売上単価">
          <div class="rate-row rate-head" role="row">
            <span>区分</span>
            <span>単価</span>
          </div>
          <div v-for="category in nursingCategories" :key="category.id" class="rate-row" role="row">
            <strong>{{ category.name }}</strong>
            <label class="rate-input">
              <input v-model="rates[rateKey(category.id)]" inputmode="decimal" type="text" />
              <span>千円</span>
            </label>
          </div>
        </div>

        <div class="button-row">
          <button class="secondary-button" type="button" @click="previousStep">戻る</button>
          <button class="primary-button" type="button" @click="nextStep">次へ</button>
        </div>
      </div>

      <div v-else class="setup-panel" :aria-busy="loading || saving">
        <h3>設定内容を保存します</h3>
        <p>保存後はホーム画面を表示します。施設名は設定画面から後で変更できます。</p>

        <div class="button-row">
          <button class="secondary-button" :disabled="saving" type="button" @click="previousStep">
            戻る
          </button>
          <button class="primary-button" :disabled="saving" type="button" @click="completeSetup">
            {{ saving ? '保存しています' : '初期設定を完了する' }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
