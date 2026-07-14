import type { MonthlyOverallSalesTarget } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapMonthlyOverallSalesTarget, type MonthlyOverallSalesTargetRow } from '../row-mappers.js';

export class MonthlyOverallSalesTargetRepository {
  constructor(private readonly db: AppDatabase) {}

  getByMonth(targetMonth: string): MonthlyOverallSalesTarget | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            target_sales_yen,
            created_by,
            updated_by,
            created_at,
            updated_at
          FROM monthly_overall_sales_targets
          WHERE target_month = ?
        `
      )
      .get(targetMonth) as MonthlyOverallSalesTargetRow | undefined;

    return row ? mapMonthlyOverallSalesTarget(row) : null;
  }

  save(targetMonth: string, targetSalesYen: number, userId: number): MonthlyOverallSalesTarget {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO monthly_overall_sales_targets (
            target_month,
            target_sales_yen,
            created_by,
            updated_by,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (target_month) DO UPDATE SET
            target_sales_yen = excluded.target_sales_yen,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
      .run(targetMonth, targetSalesYen, userId, userId, now, now);

    return this.getByMonth(targetMonth)!;
  }

  deleteByMonth(targetMonth: string): void {
    this.db
      .prepare('DELETE FROM monthly_overall_sales_targets WHERE target_month = ?')
      .run(targetMonth);
  }
}
