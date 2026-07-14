import type { MonthlyConfirmedSales } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapMonthlyConfirmedSales, type MonthlyConfirmedSalesRow } from '../row-mappers.js';

export class MonthlyConfirmedSalesRepository {
  constructor(private readonly db: AppDatabase) {}

  getByMonth(targetMonth: string): MonthlyConfirmedSales | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            confirmed_sales_yen,
            created_by,
            updated_by,
            created_at,
            updated_at
          FROM monthly_confirmed_sales
          WHERE target_month = ?
        `
      )
      .get(targetMonth) as MonthlyConfirmedSalesRow | undefined;

    return row ? mapMonthlyConfirmedSales(row) : null;
  }

  save(targetMonth: string, confirmedSalesYen: number, userId: number): MonthlyConfirmedSales {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO monthly_confirmed_sales (
            target_month,
            confirmed_sales_yen,
            created_by,
            updated_by,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (target_month) DO UPDATE SET
            confirmed_sales_yen = excluded.confirmed_sales_yen,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
      .run(targetMonth, confirmedSalesYen, userId, userId, now, now);

    return this.getByMonth(targetMonth)!;
  }

  deleteByMonth(targetMonth: string): void {
    this.db.prepare('DELETE FROM monthly_confirmed_sales WHERE target_month = ?').run(targetMonth);
  }
}
