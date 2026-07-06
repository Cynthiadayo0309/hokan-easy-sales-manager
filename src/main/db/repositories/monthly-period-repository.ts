import type { GeneratedMonthlyPeriod, MonthlyPeriod } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapMonthlyPeriod, type MonthlyPeriodRow } from '../row-mappers.js';

export class MonthlyPeriodRepository {
  constructor(private readonly db: AppDatabase) {}

  listByMonth(targetMonth: string): MonthlyPeriod[] {
    return this.db
      .prepare(
        `
          SELECT id, target_month, period_index, start_date, end_date, day_count, created_at
          FROM monthly_periods
          WHERE target_month = ?
          ORDER BY period_index
        `
      )
      .all(targetMonth)
      .map((row) => mapMonthlyPeriod(row as MonthlyPeriodRow));
  }

  createForMonth(targetMonth: string, periods: GeneratedMonthlyPeriod[]): MonthlyPeriod[] {
    const now = new Date().toISOString();
    const insertPeriod = this.db.prepare(`
      INSERT INTO monthly_periods (
        target_month,
        period_index,
        start_date,
        end_date,
        day_count,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (target_month, period_index) DO NOTHING
    `);

    this.db.transaction(() => {
      periods.forEach((period) => {
        insertPeriod.run(
          targetMonth,
          period.periodIndex,
          period.startDate,
          period.endDate,
          period.dayCount,
          now
        );
      });
    })();

    return this.listByMonth(targetMonth);
  }
}
