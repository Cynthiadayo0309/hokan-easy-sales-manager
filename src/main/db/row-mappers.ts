import type {
  Facility,
  MonthlyConfirmedSales,
  MonthlyOverallSalesTarget,
  MonthlyFacilitySalesTarget,
  MonthlyFacilityConfirmedSales,
  MonthlyPeriod,
  MonthClosingRecord,
  NursingCategory,
  RateSetting,
  MonthlyTarget,
  VisitFrequency,
  WeeklyEntry,
  WeeklyEntryDetail
} from '../../shared/types/app-api.js';

export interface FacilityRow {
  id: number;
  name: string;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NursingCategoryRow {
  id: number;
  code: NursingCategory['code'];
  name: string;
  display_order: number;
  is_active: number;
}

export interface RateSettingRow {
  id: number;
  facility_id: number | null;
  nursing_category_id: number;
  visit_frequency: VisitFrequency;
  amount_yen: number;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyTargetRow {
  id: number;
  target_month: string;
  facility_id: number;
  nursing_category_id: number;
  target_people_count: number;
  target_visit_count: number;
  target_sales_yen: number;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyConfirmedSalesRow {
  id: number;
  target_month: string;
  confirmed_sales_yen: number;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyOverallSalesTargetRow {
  id: number;
  target_month: string;
  target_sales_yen: number;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyFacilitySalesTargetRow {
  id: number;
  target_month: string;
  facility_id: number;
  target_sales_yen: number;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyFacilityConfirmedSalesRow {
  id: number;
  target_month: string;
  facility_id: number;
  confirmed_sales_yen: number;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyPeriodRow {
  id: number;
  target_month: string;
  period_index: number;
  start_date: string;
  end_date: string;
  day_count: number;
  created_at: string;
}

export interface WeeklyEntryRow {
  id: number;
  target_month: string;
  monthly_period_id: number;
  facility_id: number;
  status: WeeklyEntry['status'];
  completed_at: string | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyEntryDetailRow {
  id: number;
  weekly_entry_id: number;
  nursing_category_id: number;
  one_visit_people: number | null;
  two_visit_people: number | null;
  three_visit_people: number | null;
  rate_one_yen: number;
  rate_two_yen: number;
  rate_three_yen: number;
  created_at: string;
  updated_at: string;
}

export interface MonthClosingRow {
  id: number;
  target_month: string;
  status: MonthClosingRecord['status'];
  closed_at: string | null;
  closed_by: number | null;
  reopened_at: string | null;
  reopened_by: number | null;
  created_at: string;
  updated_at: string;
}

export function mapFacility(row: FacilityRow): Facility {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapNursingCategory(row: NursingCategoryRow): NursingCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active === 1
  };
}

export function mapRateSetting(row: RateSettingRow): RateSetting {
  return {
    id: row.id,
    facilityId: row.facility_id,
    nursingCategoryId: row.nursing_category_id,
    visitFrequency: row.visit_frequency,
    amountYen: row.amount_yen,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthlyTarget(row: MonthlyTargetRow): MonthlyTarget {
  return {
    id: row.id,
    targetMonth: row.target_month,
    facilityId: row.facility_id,
    nursingCategoryId: row.nursing_category_id,
    targetPeopleCount: row.target_people_count,
    targetVisitCount: row.target_visit_count,
    targetSalesYen: row.target_sales_yen,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthlyConfirmedSales(row: MonthlyConfirmedSalesRow): MonthlyConfirmedSales {
  return {
    id: row.id,
    targetMonth: row.target_month,
    confirmedSalesYen: row.confirmed_sales_yen,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthlyOverallSalesTarget(
  row: MonthlyOverallSalesTargetRow
): MonthlyOverallSalesTarget {
  return {
    id: row.id,
    targetMonth: row.target_month,
    targetSalesYen: row.target_sales_yen,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthlyFacilitySalesTarget(
  row: MonthlyFacilitySalesTargetRow
): MonthlyFacilitySalesTarget {
  return {
    id: row.id,
    targetMonth: row.target_month,
    facilityId: row.facility_id,
    targetSalesYen: row.target_sales_yen,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthlyFacilityConfirmedSales(
  row: MonthlyFacilityConfirmedSalesRow
): MonthlyFacilityConfirmedSales {
  return {
    id: row.id,
    targetMonth: row.target_month,
    facilityId: row.facility_id,
    confirmedSalesYen: row.confirmed_sales_yen,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthlyPeriod(row: MonthlyPeriodRow): MonthlyPeriod {
  return {
    id: row.id,
    targetMonth: row.target_month,
    periodIndex: row.period_index,
    startDate: row.start_date,
    endDate: row.end_date,
    dayCount: row.day_count,
    createdAt: row.created_at
  };
}

export function mapWeeklyEntry(row: WeeklyEntryRow): WeeklyEntry {
  return {
    id: row.id,
    targetMonth: row.target_month,
    monthlyPeriodId: row.monthly_period_id,
    facilityId: row.facility_id,
    status: row.status,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapWeeklyEntryDetail(row: WeeklyEntryDetailRow): WeeklyEntryDetail {
  const oneVisitPeople = row.one_visit_people ?? 0;
  const twoVisitPeople = row.two_visit_people ?? 0;
  const threeVisitPeople = row.three_visit_people ?? 0;
  const peopleCount = oneVisitPeople + twoVisitPeople + threeVisitPeople;

  return {
    id: row.id,
    weeklyEntryId: row.weekly_entry_id,
    nursingCategoryId: row.nursing_category_id,
    peopleCount,
    rateYen: row.rate_one_yen,
    salesYen:
      oneVisitPeople * row.rate_one_yen +
      twoVisitPeople * row.rate_two_yen +
      threeVisitPeople * row.rate_three_yen,
    billingMode: 'monthly',
    previousPeopleCount: 0,
    billablePeopleCount: peopleCount,
    billableSalesYen:
      oneVisitPeople * row.rate_one_yen +
      twoVisitPeople * row.rate_two_yen +
      threeVisitPeople * row.rate_three_yen,
    oneVisitPeople: row.one_visit_people,
    twoVisitPeople: row.two_visit_people,
    threeVisitPeople: row.three_visit_people,
    rateOneYen: row.rate_one_yen,
    rateTwoYen: row.rate_two_yen,
    rateThreeYen: row.rate_three_yen,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMonthClosing(row: MonthClosingRow): MonthClosingRecord {
  return {
    id: row.id,
    targetMonth: row.target_month,
    status: row.status,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    reopenedAt: row.reopened_at,
    reopenedBy: row.reopened_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
