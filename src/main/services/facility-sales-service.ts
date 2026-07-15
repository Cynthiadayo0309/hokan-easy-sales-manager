import type {
  MonthlyFacilitySalesInputData,
  SaveMonthlyFacilitySalesInput
} from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { MonthClosingRepository } from '../db/repositories/month-closing-repository.js';
import { MonthlyFacilitySalesRepository } from '../db/repositories/monthly-facility-sales-repository.js';
import { UserRepository } from '../db/repositories/user-repository.js';
import { assertMonth, assertPositiveId, parseThousandYenToYen } from './validation.js';

export class FacilitySalesService {
  private readonly facilities: FacilityRepository;
  private readonly closings: MonthClosingRepository;
  private readonly sales: MonthlyFacilitySalesRepository;
  private readonly users: UserRepository;

  constructor(private readonly db: AppDatabase) {
    this.facilities = new FacilityRepository(db);
    this.closings = new MonthClosingRepository(db);
    this.sales = new MonthlyFacilitySalesRepository(db);
    this.users = new UserRepository(db);
  }

  getByMonth(input: { targetMonth: string }): MonthlyFacilitySalesInputData {
    const targetMonth = assertMonth(input.targetMonth);
    return {
      targets: this.sales.getTargetsByMonth(targetMonth),
      confirmedSales: this.sales.getConfirmedByMonth(targetMonth)
    };
  }

  saveMonthly(input: SaveMonthlyFacilitySalesInput): MonthlyFacilitySalesInputData {
    const targetMonth = assertMonth(input.targetMonth);
    if (this.closings.isClosed(targetMonth)) {
      throw new Error('MONTH_CLOSED');
    }
    if (!Array.isArray(input.facilities)) {
      throw new Error('FACILITY_SALES_INVALID');
    }

    const activeFacilities = this.facilities.list();
    const activeIds = new Set(activeFacilities.map((facility) => facility.id));
    const seenIds = new Set<number>();
    const normalized = input.facilities.map((row) => {
      const facilityId = assertPositiveId(row.facilityId);
      if (!activeIds.has(facilityId) || seenIds.has(facilityId)) {
        throw new Error('FACILITY_SALES_INVALID');
      }
      seenIds.add(facilityId);
      return {
        facilityId,
        targetSalesYen: parseOptionalAmount(row.targetSalesThousandYen),
        confirmedSalesYen: parseOptionalAmount(row.confirmedSalesThousandYen)
      };
    });

    if (seenIds.size !== activeIds.size) {
      throw new Error('FACILITY_SALES_INVALID');
    }

    const userId = this.users.getInitialAdminId();
    this.db.transaction(() => {
      normalized.forEach((row) => {
        if (row.targetSalesYen === null) {
          this.sales.deleteTarget(targetMonth, row.facilityId);
        } else {
          this.sales.saveTarget(targetMonth, row.facilityId, row.targetSalesYen, userId);
        }

        if (row.confirmedSalesYen === null) {
          this.sales.deleteConfirmed(targetMonth, row.facilityId);
        } else {
          this.sales.saveConfirmed(targetMonth, row.facilityId, row.confirmedSalesYen, userId);
        }
      });
    })();

    return this.getByMonth({ targetMonth });
  }
}

function parseOptionalAmount(value: string | number | null): number | null {
  if (value === null || String(value).trim() === '') {
    return null;
  }
  return parseThousandYenToYen(value);
}
