import type { SaveMonthlyTargetsInput, SaveRateSettingsInput } from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { MonthClosingRepository } from '../db/repositories/month-closing-repository.js';
import { MonthlyTargetRepository } from '../db/repositories/monthly-target-repository.js';
import { NursingCategoryRepository } from '../db/repositories/nursing-category-repository.js';
import { RateSettingRepository } from '../db/repositories/rate-setting-repository.js';
import { UserRepository } from '../db/repositories/user-repository.js';
import {
  assertIsoDate,
  assertMonth,
  assertNonNegativeInteger,
  assertPositiveId,
  parseThousandYenToYen
} from './validation.js';

export class RateService {
  private readonly rates: RateSettingRepository;
  private readonly nursingCategories: NursingCategoryRepository;

  constructor(private readonly db: AppDatabase) {
    this.rates = new RateSettingRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
  }

  list(input?: { validOn?: string }) {
    const validOn = input?.validOn ? assertIsoDate(input.validOn) : undefined;
    return this.rates.listEffectiveCommon(validOn);
  }

  save(input: SaveRateSettingsInput) {
    const validFrom = assertIsoDate(input.validFrom);
    const categories = this.nursingCategories.list();
    const categoryIds = new Set(categories.map((category) => category.id));
    const expectedRateCount = categories.length;

    if (input.rates.length !== expectedRateCount) {
      throw new Error('RATE_SETTINGS_INCOMPLETE');
    }

    const rateKeys = new Set<number>();
    const rates = input.rates.map((rate) => {
      const nursingCategoryId = assertPositiveId(rate.nursingCategoryId);

      if (!categoryIds.has(nursingCategoryId) || rateKeys.has(nursingCategoryId)) {
        throw new Error('RATE_SETTINGS_INCOMPLETE');
      }

      rateKeys.add(nursingCategoryId);

      return {
        nursingCategoryId,
        amountYen: parseThousandYenToYen(rate.amountThousandYen)
      };
    });

    return this.rates.saveCommonRates(validFrom, rates);
  }
}

export class TargetService {
  private readonly targets: MonthlyTargetRepository;
  private readonly facilities: FacilityRepository;
  private readonly nursingCategories: NursingCategoryRepository;
  private readonly users: UserRepository;
  private readonly closings: MonthClosingRepository;

  constructor(private readonly db: AppDatabase) {
    this.targets = new MonthlyTargetRepository(db);
    this.facilities = new FacilityRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
    this.users = new UserRepository(db);
    this.closings = new MonthClosingRepository(db);
  }

  getByMonth(input: { targetMonth: string }) {
    return this.targets.getByMonth(assertMonth(input.targetMonth));
  }

  saveMonthly(input: SaveMonthlyTargetsInput) {
    const targetMonth = assertMonth(input.targetMonth);
    this.assertMonthOpen(targetMonth);
    const activeFacilityIds = new Set(this.facilities.list().map((facility) => facility.id));
    const categoryIds = new Set(this.nursingCategories.list().map((category) => category.id));
    const targetKeys = new Set<string>();

    const targets = input.targets.map((target) => {
      const facilityId = assertPositiveId(target.facilityId);
      const nursingCategoryId = assertPositiveId(target.nursingCategoryId);
      const key = `${facilityId}:${nursingCategoryId}`;

      if (
        !activeFacilityIds.has(facilityId) ||
        !categoryIds.has(nursingCategoryId) ||
        targetKeys.has(key)
      ) {
        throw new Error('MONTHLY_TARGET_INVALID');
      }

      targetKeys.add(key);

      return {
        facilityId,
        nursingCategoryId,
        targetPeopleCount: assertNonNegativeInteger(target.targetPeopleCount),
        targetVisitCount: assertNonNegativeInteger(target.targetVisitCount ?? 0),
        targetSalesYen: parseThousandYenToYen(target.targetSalesThousandYen)
      };
    });

    return this.targets.saveMonthly(targetMonth, targets, this.users.getInitialAdminId());
  }

  copyPreviousMonth(input: { targetMonth: string }) {
    const targetMonth = assertMonth(input.targetMonth);
    this.assertMonthOpen(targetMonth);
    const previousMonth = getPreviousMonth(targetMonth);
    return this.targets.copyMonth(previousMonth, targetMonth, this.users.getInitialAdminId());
  }

  private assertMonthOpen(targetMonth: string): void {
    if (this.closings.isClosed(targetMonth)) {
      throw new Error('MONTH_CLOSED');
    }
  }
}

function getPreviousMonth(targetMonth: string): string {
  const year = Number.parseInt(targetMonth.slice(0, 4), 10);
  const monthIndex = Number.parseInt(targetMonth.slice(5, 7), 10) - 1;
  const previous = new Date(Date.UTC(year, monthIndex - 1, 1));
  return previous.toISOString().slice(0, 10);
}
