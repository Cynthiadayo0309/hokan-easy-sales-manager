import type {
  EntryBillingMode,
  NursingCategory,
  NursingCategoryCode,
  WeeklyEntryDetail
} from '../types/app-api.js';

export function billingModeForCategoryCode(code: NursingCategoryCode): EntryBillingMode {
  void code;
  return 'monthly';
}

export function billingModeForCategory(category: NursingCategory): EntryBillingMode {
  return billingModeForCategoryCode(category.code);
}

export function calculateBillablePeopleCount(
  peopleCount: number | null | undefined,
  billingMode: EntryBillingMode,
  previousPeopleCount = 0
): number {
  void previousPeopleCount;
  const currentPeopleCount = peopleCount ?? 0;
  return billingMode === 'weekly' ? currentPeopleCount : currentPeopleCount;
}

export function applyEntryBilling(
  detail: WeeklyEntryDetail,
  billingMode: EntryBillingMode,
  previousPeopleCount = 0
): WeeklyEntryDetail {
  const billablePeopleCount = calculateBillablePeopleCount(
    detail.peopleCount,
    billingMode,
    previousPeopleCount
  );
  const billableSalesYen = billablePeopleCount * detail.rateYen;

  return {
    ...detail,
    billingMode,
    previousPeopleCount,
    billablePeopleCount,
    billableSalesYen
  };
}
