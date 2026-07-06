import type { MonthClosingRecord } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapMonthClosing, type MonthClosingRow } from '../row-mappers.js';

export class MonthClosingRepository {
  constructor(private readonly db: AppDatabase) {}

  getByMonth(targetMonth: string): MonthClosingRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            status,
            closed_at,
            closed_by,
            reopened_at,
            reopened_by,
            created_at,
            updated_at
          FROM month_closings
          WHERE target_month = ?
        `
      )
      .get(targetMonth) as MonthClosingRow | undefined;

    return row ? mapMonthClosing(row) : null;
  }

  isClosed(targetMonth: string): boolean {
    return this.getByMonth(targetMonth)?.status === 'closed';
  }

  closeMonth(targetMonth: string, userId: number): MonthClosingRecord {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO month_closings (
            target_month,
            status,
            closed_at,
            closed_by,
            reopened_at,
            reopened_by,
            created_at,
            updated_at
          )
          VALUES (?, 'closed', ?, ?, NULL, NULL, ?, ?)
          ON CONFLICT (target_month) DO UPDATE SET
            status = 'closed',
            closed_at = excluded.closed_at,
            closed_by = excluded.closed_by,
            updated_at = excluded.updated_at
        `
      )
      .run(targetMonth, now, userId, now, now);

    return this.getByMonth(targetMonth)!;
  }

  reopenMonth(targetMonth: string, userId: number): MonthClosingRecord {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO month_closings (
            target_month,
            status,
            closed_at,
            closed_by,
            reopened_at,
            reopened_by,
            created_at,
            updated_at
          )
          VALUES (?, 'open', NULL, NULL, ?, ?, ?, ?)
          ON CONFLICT (target_month) DO UPDATE SET
            status = 'open',
            reopened_at = excluded.reopened_at,
            reopened_by = excluded.reopened_by,
            updated_at = excluded.updated_at
        `
      )
      .run(targetMonth, now, userId, now, now);

    return this.getByMonth(targetMonth)!;
  }
}
