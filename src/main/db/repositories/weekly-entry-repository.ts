import type {
  SaveWeeklyEntryDetailInput,
  WeeklyEntry,
  WeeklyEntryDetail
} from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import {
  mapWeeklyEntry,
  mapWeeklyEntryDetail,
  type WeeklyEntryDetailRow,
  type WeeklyEntryRow
} from '../row-mappers.js';

export interface WeeklyEntryDetailSnapshot extends SaveWeeklyEntryDetailInput {
  peopleCount: number | null;
  rateYen: number;
  rateOneYen: number;
  rateTwoYen: number;
  rateThreeYen: number;
}

export class WeeklyEntryRepository {
  constructor(private readonly db: AppDatabase) {}

  listByMonth(targetMonth: string): WeeklyEntry[] {
    return this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            monthly_period_id,
            facility_id,
            status,
            completed_at,
            created_by,
            updated_by,
            created_at,
            updated_at
          FROM weekly_entries
          WHERE target_month = ?
          ORDER BY monthly_period_id, facility_id
        `
      )
      .all(targetMonth)
      .map((row) => mapWeeklyEntry(row as WeeklyEntryRow));
  }

  getEntry(targetMonth: string, monthlyPeriodId: number, facilityId: number): WeeklyEntry | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            monthly_period_id,
            facility_id,
            status,
            completed_at,
            created_by,
            updated_by,
            created_at,
            updated_at
          FROM weekly_entries
          WHERE target_month = ?
            AND monthly_period_id = ?
            AND facility_id = ?
        `
      )
      .get(targetMonth, monthlyPeriodId, facilityId) as WeeklyEntryRow | undefined;

    return row ? mapWeeklyEntry(row) : null;
  }

  listDetails(weeklyEntryId: number): WeeklyEntryDetail[] {
    return this.db
      .prepare(
        `
          SELECT
            id,
            weekly_entry_id,
            nursing_category_id,
            one_visit_people,
            two_visit_people,
            three_visit_people,
            rate_one_yen,
            rate_two_yen,
            rate_three_yen,
            created_at,
            updated_at
          FROM weekly_entry_details
          WHERE weekly_entry_id = ?
          ORDER BY nursing_category_id
        `
      )
      .all(weeklyEntryId)
      .map((row) => mapWeeklyEntryDetail(row as WeeklyEntryDetailRow));
  }

  save(
    targetMonth: string,
    monthlyPeriodId: number,
    facilityId: number,
    status: WeeklyEntry['status'],
    details: WeeklyEntryDetailSnapshot[],
    userId: number
  ): WeeklyEntry {
    const now = new Date().toISOString();
    const completedAt = status === 'completed' ? now : null;
    const current = this.getEntry(targetMonth, monthlyPeriodId, facilityId);

    const insertEntry = this.db.prepare(`
      INSERT INTO weekly_entries (
        target_month,
        monthly_period_id,
        facility_id,
        status,
        completed_at,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateEntry = this.db.prepare(`
      UPDATE weekly_entries
      SET status = ?,
          completed_at = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `);
    const upsertDetail = this.db.prepare(`
      INSERT INTO weekly_entry_details (
        weekly_entry_id,
        nursing_category_id,
        one_visit_people,
        two_visit_people,
        three_visit_people,
        rate_one_yen,
        rate_two_yen,
        rate_three_yen,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (weekly_entry_id, nursing_category_id) DO UPDATE SET
        one_visit_people = excluded.one_visit_people,
        two_visit_people = excluded.two_visit_people,
        three_visit_people = excluded.three_visit_people,
        rate_one_yen = excluded.rate_one_yen,
        rate_two_yen = excluded.rate_two_yen,
        rate_three_yen = excluded.rate_three_yen,
        updated_at = excluded.updated_at
    `);

    let entryId = current?.id ?? 0;

    this.db.transaction(() => {
      if (current) {
        updateEntry.run(status, completedAt, userId, now, current.id);
        entryId = current.id;
      } else {
        const result = insertEntry.run(
          targetMonth,
          monthlyPeriodId,
          facilityId,
          status,
          completedAt,
          userId,
          userId,
          now,
          now
        );
        entryId = Number(result.lastInsertRowid);
      }

      details.forEach((detail) => {
        upsertDetail.run(
          entryId,
          detail.nursingCategoryId,
          detail.peopleCount,
          0,
          0,
          detail.rateYen,
          0,
          0,
          now,
          now
        );
      });
    })();

    return this.getById(entryId);
  }

  getById(id: number): WeeklyEntry {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            target_month,
            monthly_period_id,
            facility_id,
            status,
            completed_at,
            created_by,
            updated_by,
            created_at,
            updated_at
          FROM weekly_entries
          WHERE id = ?
        `
      )
      .get(id) as WeeklyEntryRow | undefined;

    if (!row) {
      throw new Error('WEEKLY_ENTRY_NOT_FOUND');
    }

    return mapWeeklyEntry(row);
  }
}
