import type { MonthlyTarget } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapMonthlyTarget, type MonthlyTargetRow } from '../row-mappers.js';

export interface MonthlyTargetInput {
  facilityId: number;
  nursingCategoryId: number;
  targetPeopleCount: number;
  targetVisitCount: number;
  targetSalesYen: number;
}

export class MonthlyTargetRepository {
  constructor(private readonly db: AppDatabase) {}

  getByMonth(targetMonth: string): MonthlyTarget[] {
    return this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            facility_id,
            nursing_category_id,
            target_people_count,
            target_visit_count,
            target_sales_yen,
            created_by,
            updated_by,
            created_at,
            updated_at
          FROM monthly_targets
          WHERE target_month = ?
          ORDER BY facility_id, nursing_category_id
        `
      )
      .all(targetMonth)
      .map((row) => mapMonthlyTarget(row as MonthlyTargetRow));
  }

  saveMonthly(targetMonth: string, targets: MonthlyTargetInput[], userId: number): MonthlyTarget[] {
    const now = new Date().toISOString();
    const upsertTarget = this.db.prepare(`
      INSERT INTO monthly_targets (
        target_month,
        facility_id,
        nursing_category_id,
        target_people_count,
        target_visit_count,
        target_sales_yen,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (target_month, facility_id, nursing_category_id)
      DO UPDATE SET
        target_people_count = excluded.target_people_count,
        target_visit_count = excluded.target_visit_count,
        target_sales_yen = excluded.target_sales_yen,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `);

    this.db.transaction(() => {
      targets.forEach((target) => {
        upsertTarget.run(
          targetMonth,
          target.facilityId,
          target.nursingCategoryId,
          target.targetPeopleCount,
          target.targetVisitCount,
          target.targetSalesYen,
          userId,
          userId,
          now,
          now
        );
      });
    })();

    return this.getByMonth(targetMonth);
  }

  copyMonth(previousMonth: string, targetMonth: string, userId: number): MonthlyTarget[] {
    const previousTargets = this.getByMonth(previousMonth);
    return this.saveMonthly(
      targetMonth,
      previousTargets.map((target) => ({
        facilityId: target.facilityId,
        nursingCategoryId: target.nursingCategoryId,
        targetPeopleCount: target.targetPeopleCount,
        targetVisitCount: target.targetVisitCount,
        targetSalesYen: target.targetSalesYen
      })),
      userId
    );
  }
}
