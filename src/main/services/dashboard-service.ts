import { calculateEntryDetail } from '../../shared/calculations/entries.js';
import { applyEntryBilling, billingModeForCategory } from '../../shared/calculations/billing.js';
import { calculateAchievement, calculateForecast } from '../../shared/calculations/dashboard.js';
import { generateWholeMonthPeriod } from '../../shared/calculations/periods.js';
import type {
  CalculatedEntrySummary,
  DashboardFacilityRow,
  DashboardInputStatus,
  DashboardNursingCategoryRow,
  DashboardPeriodRow,
  DashboardSummary,
  Facility,
  MonthlyDashboard,
  MonthlyPeriod,
  NursingCategory,
  WeeklyEntry
} from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { MonthlyConfirmedSalesRepository } from '../db/repositories/monthly-confirmed-sales-repository.js';
import { MonthlyOverallSalesTargetRepository } from '../db/repositories/monthly-overall-sales-target-repository.js';
import { MonthlyPeriodRepository } from '../db/repositories/monthly-period-repository.js';
import { MonthlyTargetRepository } from '../db/repositories/monthly-target-repository.js';
import { NursingCategoryRepository } from '../db/repositories/nursing-category-repository.js';
import { WeeklyEntryRepository } from '../db/repositories/weekly-entry-repository.js';
import { assertMonth } from './validation.js';

interface DashboardAccumulator {
  targetPeopleCount: number;
  targetVisitCount: number;
  targetSalesYen: number;
  actualPeopleCount: number;
  actualVisitCount: number;
  actualSalesYen: number;
}

export class DashboardService {
  private readonly facilities: FacilityRepository;
  private readonly nursingCategories: NursingCategoryRepository;
  private readonly periods: MonthlyPeriodRepository;
  private readonly targets: MonthlyTargetRepository;
  private readonly entries: WeeklyEntryRepository;
  private readonly confirmedSales: MonthlyConfirmedSalesRepository;
  private readonly overallSalesTargets: MonthlyOverallSalesTargetRepository;

  constructor(db: AppDatabase) {
    this.facilities = new FacilityRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
    this.periods = new MonthlyPeriodRepository(db);
    this.targets = new MonthlyTargetRepository(db);
    this.entries = new WeeklyEntryRepository(db);
    this.confirmedSales = new MonthlyConfirmedSalesRepository(db);
    this.overallSalesTargets = new MonthlyOverallSalesTargetRepository(db);
  }

  getMonthly(input: { targetMonth: string }): MonthlyDashboard {
    const targetMonth = assertMonth(input.targetMonth);
    const periods = this.ensurePeriods(targetMonth);
    const facilities = this.facilities.list();
    const nursingCategories = this.nursingCategories.list();
    const facilityIds = new Set(facilities.map((facility) => facility.id));
    const categoryIds = new Set(nursingCategories.map((category) => category.id));
    const entries = this.entries
      .listByMonth(targetMonth)
      .filter((entry) => facilityIds.has(entry.facilityId));
    const entryDetails = new Map(
      entries.map((entry) => [entry.id, this.entries.listDetails(entry.id)])
    );
    const categoryMap = new Map(nursingCategories.map((category) => [category.id, category]));
    const targetRows = this.targets
      .getByMonth(targetMonth)
      .filter(
        (target) => facilityIds.has(target.facilityId) && categoryIds.has(target.nursingCategoryId)
      );
    const confirmedSales = this.confirmedSales.getByMonth(targetMonth);
    const overallSalesTarget = this.overallSalesTargets.getByMonth(targetMonth);
    const daysInMonth = getDaysInMonth(targetMonth);
    const completedDayCount = this.calculateCompletedDayCount(periods, facilities, entries);
    const summaryAccumulator = createAccumulator();
    const facilityAccumulators = new Map(
      facilities.map((facility) => [facility.id, createAccumulator()])
    );
    const categoryAccumulators = new Map(
      nursingCategories.map((category) => [category.id, createAccumulator()])
    );
    const periodAccumulators = new Map(periods.map((period) => [period.id, createAccumulator()]));

    targetRows.forEach((target) => {
      const facilityAccumulator = facilityAccumulators.get(target.facilityId);
      const categoryAccumulator = categoryAccumulators.get(target.nursingCategoryId);

      summaryAccumulator.targetPeopleCount += target.targetPeopleCount;
      summaryAccumulator.targetVisitCount += target.targetVisitCount;
      summaryAccumulator.targetSalesYen += target.targetSalesYen;

      if (facilityAccumulator) {
        facilityAccumulator.targetPeopleCount += target.targetPeopleCount;
        facilityAccumulator.targetVisitCount += target.targetVisitCount;
        facilityAccumulator.targetSalesYen += target.targetSalesYen;
      }

      if (categoryAccumulator) {
        categoryAccumulator.targetPeopleCount += target.targetPeopleCount;
        categoryAccumulator.targetVisitCount += target.targetVisitCount;
        categoryAccumulator.targetSalesYen += target.targetSalesYen;
      }
    });

    const targetSalesSource = overallSalesTarget ? 'overall' : 'detailed_sum';
    summaryAccumulator.targetSalesYen =
      overallSalesTarget?.targetSalesYen ?? summaryAccumulator.targetSalesYen;

    entries.forEach((entry) => {
      const facilityAccumulator = facilityAccumulators.get(entry.facilityId);
      const periodAccumulator = periodAccumulators.get(entry.monthlyPeriodId);

      entryDetails.get(entry.id)?.forEach((detail) => {
        const category = categoryMap.get(detail.nursingCategoryId);
        const billingMode = category ? billingModeForCategory(category) : 'weekly';
        const billedDetail = applyEntryBilling(detail, billingMode, 0);
        const actual = calculateEntryDetail(billedDetail);
        const categoryAccumulator = categoryAccumulators.get(detail.nursingCategoryId);

        addActual(summaryAccumulator, actual);

        if (facilityAccumulator) {
          addActual(facilityAccumulator, actual);
        }

        if (categoryAccumulator) {
          addActual(categoryAccumulator, actual);
        }

        if (periodAccumulator) {
          addActual(periodAccumulator, actual);
        }
      });
    });

    return {
      targetMonth,
      summary: toSummary(summaryAccumulator, completedDayCount, daysInMonth),
      overallSalesTarget,
      targetSalesSource,
      confirmedSales,
      confirmedAchievement: confirmedSales
        ? calculateAchievement(summaryAccumulator.targetSalesYen, confirmedSales.confirmedSalesYen)
        : null,
      facilityRows: facilities.map((facility) =>
        toFacilityRow(
          facility,
          facilityAccumulators.get(facility.id) ?? createAccumulator(),
          this.calculateFacilityCompletedDayCount(
            periods,
            entryMapByPeriodAndFacility(entries),
            facility.id
          ),
          daysInMonth
        )
      ),
      nursingCategoryRows: nursingCategories.map((category) =>
        toCategoryRow(
          category,
          categoryAccumulators.get(category.id) ?? createAccumulator(),
          daysInMonth
        )
      ),
      periodRows: periods.map((period) =>
        toPeriodRow(
          period,
          periodAccumulators.get(period.id) ?? createAccumulator(),
          entries,
          facilities.length
        )
      ),
      inputStatus: buildInputStatus(periods, facilities.length, entries)
    };
  }

  private ensurePeriods(targetMonth: string): MonthlyPeriod[] {
    const existingPeriods = this.periods.listByMonth(targetMonth);
    if (existingPeriods.length > 0) {
      return existingPeriods;
    }

    return this.periods.createForMonth(targetMonth, [generateWholeMonthPeriod(targetMonth)]);
  }

  private calculateCompletedDayCount(
    periods: MonthlyPeriod[],
    facilities: Facility[],
    entries: WeeklyEntry[]
  ): number {
    const entryMap = entryMapByPeriodAndFacility(entries);
    return periods.reduce((dayCount, period) => {
      const allFacilitiesCompleted =
        facilities.length > 0 &&
        facilities.every(
          (facility) => entryMap.get(`${period.id}:${facility.id}`)?.status === 'completed'
        );

      return dayCount + (allFacilitiesCompleted ? period.dayCount : 0);
    }, 0);
  }

  private calculateFacilityCompletedDayCount(
    periods: MonthlyPeriod[],
    entryMap: Map<string, WeeklyEntry>,
    facilityId: number
  ): number {
    return periods.reduce(
      (dayCount, period) =>
        dayCount +
        (entryMap.get(`${period.id}:${facilityId}`)?.status === 'completed' ? period.dayCount : 0),
      0
    );
  }
}

function createAccumulator(): DashboardAccumulator {
  return {
    targetPeopleCount: 0,
    targetVisitCount: 0,
    targetSalesYen: 0,
    actualPeopleCount: 0,
    actualVisitCount: 0,
    actualSalesYen: 0
  };
}

function addActual(accumulator: DashboardAccumulator, actual: CalculatedEntrySummary): void {
  accumulator.actualPeopleCount += actual.peopleCount;
  accumulator.actualVisitCount += actual.visitCount;
  accumulator.actualSalesYen += actual.salesYen;
}

function toSummary(
  accumulator: DashboardAccumulator,
  completedDayCount: number,
  daysInMonth: number
): DashboardSummary {
  return {
    ...accumulator,
    achievement: calculateAchievement(accumulator.targetSalesYen, accumulator.actualSalesYen),
    forecast: calculateForecast(accumulator.actualSalesYen, completedDayCount, daysInMonth)
  };
}

function toFacilityRow(
  facility: Facility,
  accumulator: DashboardAccumulator,
  completedDayCount: number,
  daysInMonth: number
): DashboardFacilityRow {
  return {
    facilityId: facility.id,
    facilityName: facility.name,
    ...toSummary(accumulator, completedDayCount, daysInMonth)
  };
}

function toCategoryRow(
  category: NursingCategory,
  accumulator: DashboardAccumulator,
  daysInMonth: number
): DashboardNursingCategoryRow {
  return {
    nursingCategoryId: category.id,
    nursingCategoryName: category.name,
    ...toSummary(accumulator, 0, daysInMonth)
  };
}

function toPeriodRow(
  period: MonthlyPeriod,
  accumulator: DashboardAccumulator,
  entries: WeeklyEntry[],
  facilityCount: number
): DashboardPeriodRow {
  return {
    monthlyPeriodId: period.id,
    periodIndex: period.periodIndex,
    startDate: period.startDate,
    endDate: period.endDate,
    dayCount: period.dayCount,
    completedFacilityCount: entries.filter(
      (entry) => entry.monthlyPeriodId === period.id && entry.status === 'completed'
    ).length,
    facilityCount,
    peopleCount: accumulator.actualPeopleCount,
    visitCount: accumulator.actualVisitCount,
    salesYen: accumulator.actualSalesYen
  };
}

function buildInputStatus(
  periods: MonthlyPeriod[],
  facilityCount: number,
  entries: WeeklyEntry[]
): DashboardInputStatus {
  const periodRows = periods.map((period) => ({
    period,
    completedFacilityCount: entries.filter(
      (entry) => entry.monthlyPeriodId === period.id && entry.status === 'completed'
    ).length
  }));
  const focusRow =
    periodRows.find((row) => row.completedFacilityCount < facilityCount) ??
    periodRows[periodRows.length - 1];

  return {
    monthlyPeriodId: focusRow?.period.id ?? null,
    periodIndex: focusRow?.period.periodIndex ?? null,
    completedFacilityCount: focusRow?.completedFacilityCount ?? 0,
    facilityCount
  };
}

function entryMapByPeriodAndFacility(entries: WeeklyEntry[]): Map<string, WeeklyEntry> {
  return new Map(entries.map((entry) => [`${entry.monthlyPeriodId}:${entry.facilityId}`, entry]));
}

function getDaysInMonth(targetMonth: string): number {
  const year = Number.parseInt(targetMonth.slice(0, 4), 10);
  const month = Number.parseInt(targetMonth.slice(5, 7), 10);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
