import type {
  MonthlyFacilityConfirmedSales,
  MonthlyFacilitySalesTarget
} from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import {
  mapMonthlyFacilityConfirmedSales,
  mapMonthlyFacilitySalesTarget,
  type MonthlyFacilityConfirmedSalesRow,
  type MonthlyFacilitySalesTargetRow
} from '../row-mappers.js';

const targetColumns = `
  id, target_month, facility_id, target_sales_yen,
  created_by, updated_by, created_at, updated_at
`;
const confirmedColumns = `
  id, target_month, facility_id, confirmed_sales_yen,
  created_by, updated_by, created_at, updated_at
`;

export class MonthlyFacilitySalesRepository {
  constructor(private readonly db: AppDatabase) {}

  getTargetsByMonth(targetMonth: string): MonthlyFacilitySalesTarget[] {
    const rows = this.db
      .prepare(
        `SELECT ${targetColumns} FROM monthly_facility_sales_targets
         WHERE target_month = ? ORDER BY facility_id`
      )
      .all(targetMonth) as MonthlyFacilitySalesTargetRow[];
    return rows.map(mapMonthlyFacilitySalesTarget);
  }

  getConfirmedByMonth(targetMonth: string): MonthlyFacilityConfirmedSales[] {
    const rows = this.db
      .prepare(
        `SELECT ${confirmedColumns} FROM monthly_facility_confirmed_sales
         WHERE target_month = ? ORDER BY facility_id`
      )
      .all(targetMonth) as MonthlyFacilityConfirmedSalesRow[];
    return rows.map(mapMonthlyFacilityConfirmedSales);
  }

  saveTarget(targetMonth: string, facilityId: number, amountYen: number, userId: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO monthly_facility_sales_targets (
           target_month, facility_id, target_sales_yen, created_by, updated_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (target_month, facility_id) DO UPDATE SET
           target_sales_yen = excluded.target_sales_yen,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`
      )
      .run(targetMonth, facilityId, amountYen, userId, userId, now, now);
  }

  saveConfirmed(targetMonth: string, facilityId: number, amountYen: number, userId: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO monthly_facility_confirmed_sales (
           target_month, facility_id, confirmed_sales_yen,
           created_by, updated_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (target_month, facility_id) DO UPDATE SET
           confirmed_sales_yen = excluded.confirmed_sales_yen,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`
      )
      .run(targetMonth, facilityId, amountYen, userId, userId, now, now);
  }

  deleteTarget(targetMonth: string, facilityId: number): void {
    this.db
      .prepare(
        'DELETE FROM monthly_facility_sales_targets WHERE target_month = ? AND facility_id = ?'
      )
      .run(targetMonth, facilityId);
  }

  deleteConfirmed(targetMonth: string, facilityId: number): void {
    this.db
      .prepare(
        'DELETE FROM monthly_facility_confirmed_sales WHERE target_month = ? AND facility_id = ?'
      )
      .run(targetMonth, facilityId);
  }
}
