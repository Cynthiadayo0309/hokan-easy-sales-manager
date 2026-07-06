import {
  assertPeopleInput,
  calculateEntrySummary,
  isCompletedPeopleInput
} from '../../shared/calculations/entries.js';
import { generateMonthlyPeriods } from '../../shared/calculations/periods.js';
import type {
  CopyPreviousWeeklyEntryInput,
  Facility,
  GetWeeklyEntryInput,
  MonthlyPeriod,
  NursingCategory,
  SaveWeeklyEntryInput,
  WeeklyEntryDetail,
  WeeklyEntryForm,
  WeeklyEntryStatusCell,
  WeeklyEntryStatusMatrix
} from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { MonthClosingRepository } from '../db/repositories/month-closing-repository.js';
import { MonthlyPeriodRepository } from '../db/repositories/monthly-period-repository.js';
import { NursingCategoryRepository } from '../db/repositories/nursing-category-repository.js';
import { RateSettingRepository } from '../db/repositories/rate-setting-repository.js';
import { UserRepository } from '../db/repositories/user-repository.js';
import {
  WeeklyEntryRepository,
  type WeeklyEntryDetailSnapshot
} from '../db/repositories/weekly-entry-repository.js';
import { assertMonth, assertPositiveId } from './validation.js';

export class EntryService {
  private readonly entries: WeeklyEntryRepository;
  private readonly periods: MonthlyPeriodRepository;
  private readonly facilities: FacilityRepository;
  private readonly nursingCategories: NursingCategoryRepository;
  private readonly rates: RateSettingRepository;
  private readonly users: UserRepository;
  private readonly closings: MonthClosingRepository;

  constructor(private readonly db: AppDatabase) {
    this.entries = new WeeklyEntryRepository(db);
    this.periods = new MonthlyPeriodRepository(db);
    this.facilities = new FacilityRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
    this.rates = new RateSettingRepository(db);
    this.users = new UserRepository(db);
    this.closings = new MonthClosingRepository(db);
  }

  get(input: GetWeeklyEntryInput): WeeklyEntryForm {
    const context = this.getContext(input);
    const entry = this.entries.getEntry(
      context.targetMonth,
      context.monthlyPeriod.id,
      context.facility.id
    );
    const details = entry
      ? this.completeDetailSet(this.entries.listDetails(entry.id), context)
      : this.createBlankDetails(context);

    return this.toForm(context, details, entry);
  }

  saveDraft(input: SaveWeeklyEntryInput): WeeklyEntryForm {
    return this.save(input, 'draft');
  }

  complete(input: SaveWeeklyEntryInput): WeeklyEntryForm {
    return this.save(input, 'completed');
  }

  getStatusByMonth(input: { targetMonth: string }): WeeklyEntryStatusMatrix {
    const targetMonth = assertMonth(input.targetMonth);
    const periods = this.ensurePeriods(targetMonth);
    const facilities = this.facilities.list();
    const entryMap = new Map(
      this.entries
        .listByMonth(targetMonth)
        .map((entry) => [`${entry.monthlyPeriodId}:${entry.facilityId}`, entry])
    );
    const cells: WeeklyEntryStatusCell[] = facilities.flatMap((facility) =>
      periods.map((period) => {
        const entry = entryMap.get(`${period.id}:${facility.id}`);
        return {
          monthlyPeriodId: period.id,
          periodIndex: period.periodIndex,
          facilityId: facility.id,
          status: entry?.status ?? 'not_started',
          entryId: entry?.id ?? null,
          periodDayCount: period.dayCount
        };
      })
    );

    return { targetMonth, periods, facilities, cells };
  }

  copyPrevious(input: CopyPreviousWeeklyEntryInput): WeeklyEntryForm {
    const context = this.getContext(input);
    this.assertMonthOpen(context.targetMonth);
    const periods = this.ensurePeriods(context.targetMonth);
    const currentIndex = periods.findIndex((period) => period.id === context.monthlyPeriod.id);
    const previousPeriod = currentIndex > 0 ? periods[currentIndex - 1] : null;

    if (!previousPeriod) {
      throw new Error('PREVIOUS_PERIOD_NOT_FOUND');
    }

    const previousEntry = this.entries.getEntry(
      context.targetMonth,
      previousPeriod.id,
      context.facility.id
    );

    if (!previousEntry) {
      throw new Error('PREVIOUS_ENTRY_NOT_FOUND');
    }

    const previousDetails = this.entries.listDetails(previousEntry.id);
    if (previousDetails.length !== context.nursingCategories.length) {
      throw new Error('PREVIOUS_ENTRY_DETAILS_INCOMPLETE');
    }

    const snapshots = this.createSnapshots(
      {
        ...input,
        details: previousDetails.map((detail) => ({
          nursingCategoryId: detail.nursingCategoryId,
          peopleCount: detail.peopleCount,
          oneVisitPeople: detail.peopleCount,
          twoVisitPeople: 0,
          threeVisitPeople: 0
        }))
      },
      context,
      'draft'
    );
    const entry = this.entries.save(
      context.targetMonth,
      context.monthlyPeriod.id,
      context.facility.id,
      'draft',
      snapshots,
      this.users.getInitialAdminId()
    );

    return this.toForm(context, this.entries.listDetails(entry.id), entry);
  }

  private save(input: SaveWeeklyEntryInput, status: 'draft' | 'completed'): WeeklyEntryForm {
    const context = this.getContext(input);
    this.assertMonthOpen(context.targetMonth);
    const snapshots = this.createSnapshots(input, context, status);
    const entry = this.entries.save(
      context.targetMonth,
      context.monthlyPeriod.id,
      context.facility.id,
      status,
      snapshots,
      this.users.getInitialAdminId()
    );

    return this.toForm(context, this.entries.listDetails(entry.id), entry);
  }

  private getContext(input: GetWeeklyEntryInput): EntryContext {
    const targetMonth = assertMonth(input.targetMonth);
    const monthlyPeriodId = assertPositiveId(input.monthlyPeriodId);
    const facilityId = assertPositiveId(input.facilityId);
    const facility = this.facilities.getById(facilityId);

    if (!facility || !facility.isActive) {
      throw new Error('FACILITY_NOT_ACTIVE');
    }

    const periods = this.ensurePeriods(targetMonth);
    const monthlyPeriod = periods.find((period) => period.id === monthlyPeriodId);

    if (!monthlyPeriod || monthlyPeriod.targetMonth !== targetMonth) {
      throw new Error('MONTHLY_PERIOD_INVALID');
    }

    const nursingCategories = this.nursingCategories.list();
    return { targetMonth, monthlyPeriod, facility, nursingCategories };
  }

  private assertMonthOpen(targetMonth: string): void {
    if (this.closings.isClosed(targetMonth)) {
      throw new Error('MONTH_CLOSED');
    }
  }

  private ensurePeriods(targetMonth: string): MonthlyPeriod[] {
    const existingPeriods = this.periods.listByMonth(targetMonth);
    if (existingPeriods.length > 0) {
      return existingPeriods;
    }

    return this.periods.createForMonth(targetMonth, generateMonthlyPeriods(targetMonth));
  }

  private createSnapshots(
    input: SaveWeeklyEntryInput,
    context: EntryContext,
    status: 'draft' | 'completed'
  ): WeeklyEntryDetailSnapshot[] {
    if (!Array.isArray(input.details)) {
      throw new Error('WEEKLY_ENTRY_DETAILS_INVALID');
    }

    const rateMap = this.getRateMap(context);
    const categoryIds = new Set(context.nursingCategories.map((category) => category.id));
    const detailKeys = new Set<number>();

    if (input.details.length !== context.nursingCategories.length) {
      throw new Error('WEEKLY_ENTRY_DETAILS_INCOMPLETE');
    }

    return input.details.map((detail) => {
      const nursingCategoryId = assertPositiveId(detail.nursingCategoryId);

      if (!categoryIds.has(nursingCategoryId) || detailKeys.has(nursingCategoryId)) {
        throw new Error('WEEKLY_ENTRY_DETAILS_INCOMPLETE');
      }

      detailKeys.add(nursingCategoryId);

      const peopleCount = assertPeopleInput(getDetailPeopleCount(detail));

      if (status === 'completed' && !isCompletedPeopleInput(peopleCount)) {
        throw new Error('WEEKLY_ENTRY_DETAILS_INCOMPLETE');
      }

      const rateYen = rateMap.get(nursingCategoryId);

      if (rateYen === undefined) {
        throw new Error('RATE_SETTINGS_REQUIRED');
      }

      return {
        nursingCategoryId,
        peopleCount,
        oneVisitPeople: peopleCount,
        twoVisitPeople: 0,
        threeVisitPeople: 0,
        rateYen,
        rateOneYen: rateYen,
        rateTwoYen: 0,
        rateThreeYen: 0
      };
    });
  }

  private getRateMap(context: EntryContext): Map<number, number> {
    return new Map(
      this.rates
        .listEffectiveCommon(context.monthlyPeriod.startDate)
        .map((rate) => [rate.nursingCategoryId, rate.amountYen])
    );
  }

  private createBlankDetails(context: EntryContext): WeeklyEntryDetail[] {
    const rateMap = this.getRateMap(context);

    return context.nursingCategories.map((category) => ({
      id: 0,
      weeklyEntryId: 0,
      nursingCategoryId: category.id,
      peopleCount: null,
      rateYen: rateMap.get(category.id) ?? 0,
      salesYen: 0,
      oneVisitPeople: null,
      twoVisitPeople: 0,
      threeVisitPeople: 0,
      rateOneYen: rateMap.get(category.id) ?? 0,
      rateTwoYen: 0,
      rateThreeYen: 0,
      createdAt: '',
      updatedAt: ''
    }));
  }

  private completeDetailSet(
    details: WeeklyEntryDetail[],
    context: EntryContext
  ): WeeklyEntryDetail[] {
    if (details.length === context.nursingCategories.length) {
      return details;
    }

    const detailMap = new Map(details.map((detail) => [detail.nursingCategoryId, detail]));
    return this.createBlankDetails(context).map(
      (blankDetail) => detailMap.get(blankDetail.nursingCategoryId) ?? blankDetail
    );
  }

  private toForm(
    context: EntryContext,
    details: WeeklyEntryDetail[],
    entry: WeeklyEntryForm['entry']
  ): WeeklyEntryForm {
    return {
      entry,
      status: entry?.status ?? 'not_started',
      targetMonth: context.targetMonth,
      monthlyPeriod: context.monthlyPeriod,
      facility: context.facility,
      nursingCategories: context.nursingCategories,
      details,
      summary: calculateEntrySummary(details)
    };
  }
}

interface EntryContext {
  targetMonth: string;
  monthlyPeriod: MonthlyPeriod;
  facility: Facility;
  nursingCategories: NursingCategory[];
}

function getDetailPeopleCount(detail: SaveWeeklyEntryInput['details'][number]): number | null {
  if (detail.peopleCount !== undefined) {
    return detail.peopleCount;
  }

  const oneVisitPeople = detail.oneVisitPeople ?? 0;
  const twoVisitPeople = detail.twoVisitPeople ?? 0;
  const threeVisitPeople = detail.threeVisitPeople ?? 0;
  return oneVisitPeople + twoVisitPeople + threeVisitPeople;
}
