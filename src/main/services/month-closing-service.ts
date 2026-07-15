import { generateWholeMonthPeriod } from '../../shared/calculations/periods.js';
import type {
  Facility,
  MonthlyDashboard,
  MonthlyPeriod,
  MonthClosingStatus,
  MonthClosingWarning,
  NursingCategory,
  PreviousMonthComparison,
  WeeklyEntry
} from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { MonthClosingRepository } from '../db/repositories/month-closing-repository.js';
import { MonthlyFacilitySalesRepository } from '../db/repositories/monthly-facility-sales-repository.js';
import { MonthlyPeriodRepository } from '../db/repositories/monthly-period-repository.js';
import { MonthlyTargetRepository } from '../db/repositories/monthly-target-repository.js';
import { NursingCategoryRepository } from '../db/repositories/nursing-category-repository.js';
import { UserRepository } from '../db/repositories/user-repository.js';
import { WeeklyEntryRepository } from '../db/repositories/weekly-entry-repository.js';
import { assertMonth } from './validation.js';

export class MonthClosingService {
  private readonly closings: MonthClosingRepository;
  private readonly facilities: FacilityRepository;
  private readonly periods: MonthlyPeriodRepository;
  private readonly targets: MonthlyTargetRepository;
  private readonly nursingCategories: NursingCategoryRepository;
  private readonly entries: WeeklyEntryRepository;
  private readonly users: UserRepository;
  private readonly facilitySales: MonthlyFacilitySalesRepository;

  constructor(private readonly db: AppDatabase) {
    this.closings = new MonthClosingRepository(db);
    this.facilities = new FacilityRepository(db);
    this.periods = new MonthlyPeriodRepository(db);
    this.targets = new MonthlyTargetRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
    this.entries = new WeeklyEntryRepository(db);
    this.users = new UserRepository(db);
    this.facilitySales = new MonthlyFacilitySalesRepository(db);
  }

  getStatus(
    input: { targetMonth: string },
    dashboard?: MonthlyDashboard,
    previousDashboard?: MonthlyDashboard
  ): MonthClosingStatus {
    const targetMonth = assertMonth(input.targetMonth);
    const record = this.closings.getByMonth(targetMonth);
    const warnings = this.collectWarnings(targetMonth);
    const hasMissingEntry = warnings.some((warning) => warning.type === 'missing_entry');

    return {
      targetMonth,
      status: record?.status ?? 'open',
      record,
      warnings,
      canClose: !hasMissingEntry,
      comparison: buildComparison(targetMonth, dashboard, previousDashboard)
    };
  }

  closeMonth(input: { targetMonth: string; acknowledgeWarnings: boolean }): MonthClosingStatus {
    const targetMonth = assertMonth(input.targetMonth);
    const currentStatus = this.getStatus({ targetMonth });
    const hasMissingEntry = currentStatus.warnings.some(
      (warning) => warning.type === 'missing_entry'
    );
    const hasWarnings = currentStatus.warnings.length > 0;

    if (hasMissingEntry) {
      throw new Error('MONTH_CLOSING_INCOMPLETE');
    }

    if (hasWarnings && !input.acknowledgeWarnings) {
      throw new Error('MONTH_CLOSING_WARNINGS_UNACKNOWLEDGED');
    }

    this.closings.closeMonth(targetMonth, this.users.getInitialAdminId());
    return this.getStatus({ targetMonth });
  }

  reopenMonth(input: { targetMonth: string }): MonthClosingStatus {
    const targetMonth = assertMonth(input.targetMonth);
    this.closings.reopenMonth(targetMonth, this.users.getInitialAdminId());
    return this.getStatus({ targetMonth });
  }

  assertMonthOpen(targetMonth: string): void {
    if (this.closings.isClosed(assertMonth(targetMonth))) {
      throw new Error('MONTH_CLOSED');
    }
  }

  private collectWarnings(targetMonth: string): MonthClosingWarning[] {
    const facilities = this.facilities.list();
    const periods = this.ensurePeriods(targetMonth);
    const categories = this.nursingCategories.list();
    const entries = this.entries.listByMonth(targetMonth);
    const entryMap = new Map(
      entries.map((entry) => [`${entry.monthlyPeriodId}:${entry.facilityId}`, entry])
    );
    const targets = this.targets.getByMonth(targetMonth);
    const targetKeys = new Set(
      targets
        .filter((target) => target.targetPeopleCount > 0 || target.targetSalesYen > 0)
        .map((target) => `${target.facilityId}:${target.nursingCategoryId}`)
    );
    const facilityTargetIds = new Set(
      this.facilitySales.getTargetsByMonth(targetMonth).map((row) => row.facilityId)
    );
    const facilityConfirmedIds = new Set(
      this.facilitySales.getConfirmedByMonth(targetMonth).map((row) => row.facilityId)
    );

    return [
      ...collectMissingEntryWarnings(facilities, periods, entryMap),
      ...collectMissingTargetWarnings(facilities, categories, targetKeys),
      ...facilities.flatMap((facility) => [
        ...(facilityTargetIds.has(facility.id)
          ? []
          : [
              {
                type: 'missing_facility_sales_target' as const,
                message: `${facility.name}の売上目標が未入力です。内訳目標の合計を使用します。`,
                facilityId: facility.id,
                facilityName: facility.name
              }
            ]),
        ...(facilityConfirmedIds.has(facility.id)
          ? []
          : [
              {
                type: 'missing_facility_confirmed_sales' as const,
                message: `${facility.name}の確定売上が未入力です。`,
                facilityId: facility.id,
                facilityName: facility.name
              }
            ])
      ])
    ];
  }

  private ensurePeriods(targetMonth: string): MonthlyPeriod[] {
    const existingPeriods = this.periods.listByMonth(targetMonth);
    if (existingPeriods.length > 0) {
      return existingPeriods;
    }

    return this.periods.createForMonth(targetMonth, [generateWholeMonthPeriod(targetMonth)]);
  }
}

function collectMissingEntryWarnings(
  facilities: Facility[],
  periods: MonthlyPeriod[],
  entryMap: Map<string, WeeklyEntry>
): MonthClosingWarning[] {
  return periods.flatMap((period) =>
    facilities.flatMap((facility) => {
      const entry = entryMap.get(`${period.id}:${facility.id}`);
      if (entry?.status === 'completed') {
        return [];
      }

      return [
        {
          type: 'missing_entry' as const,
          message: `${facility.name}の月次入力が入力完了ではありません。`,
          facilityId: facility.id,
          facilityName: facility.name,
          monthlyPeriodId: period.id,
          periodIndex: period.periodIndex
        }
      ];
    })
  );
}

function collectMissingTargetWarnings(
  facilities: Facility[],
  categories: NursingCategory[],
  targetKeys: Set<string>
): MonthClosingWarning[] {
  return facilities.flatMap((facility) =>
    categories.flatMap((category) => {
      if (targetKeys.has(`${facility.id}:${category.id}`)) {
        return [];
      }

      return [
        {
          type: 'missing_target' as const,
          message: `${facility.name}・${category.name}の月間目標が未設定です。`,
          facilityId: facility.id,
          facilityName: facility.name,
          nursingCategoryId: category.id,
          nursingCategoryName: category.name
        }
      ];
    })
  );
}

function buildComparison(
  targetMonth: string,
  dashboard?: MonthlyDashboard,
  previousDashboard?: MonthlyDashboard
): PreviousMonthComparison {
  const previousMonth = getPreviousMonth(targetMonth);
  const currentSalesYen = dashboard?.summary.actualSalesYen ?? 0;
  const previousSalesYen = previousDashboard?.summary.actualSalesYen ?? 0;

  return {
    previousMonth,
    currentSalesYen,
    previousSalesYen,
    differenceYen: currentSalesYen - previousSalesYen
  };
}

function getPreviousMonth(targetMonth: string): string {
  const year = Number.parseInt(targetMonth.slice(0, 4), 10);
  const monthIndex = Number.parseInt(targetMonth.slice(5, 7), 10) - 1;
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString().slice(0, 10);
}
