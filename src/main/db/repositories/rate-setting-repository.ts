import type { RateSetting } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapRateSetting, type RateSettingRow } from '../row-mappers.js';

interface CommonRateInput {
  nursingCategoryId: number;
  amountYen: number;
}

const initialValidFrom = '1970-01-01';

export class RateSettingRepository {
  constructor(private readonly db: AppDatabase) {}

  listCommon(): RateSetting[] {
    return this.db
      .prepare(
        `
          SELECT
            id,
            facility_id,
            nursing_category_id,
            visit_frequency,
            amount_yen,
            valid_from,
            valid_to,
            created_at,
            updated_at
          FROM rate_settings
          WHERE facility_id IS NULL
            AND visit_frequency = 1
          ORDER BY nursing_category_id, visit_frequency
        `
      )
      .all()
      .map((row) => mapRateSetting(row as RateSettingRow));
  }

  listEffectiveCommon(validOn?: string): RateSetting[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            current.id,
            current.facility_id,
            current.nursing_category_id,
            current.visit_frequency,
            current.amount_yen,
            current.valid_from,
            current.valid_to,
            current.created_at,
            current.updated_at
          FROM rate_settings current
          INNER JOIN (
            SELECT nursing_category_id, visit_frequency, MAX(valid_from) AS valid_from
            FROM rate_settings
            WHERE facility_id IS NULL
              AND visit_frequency = 1
              AND (? IS NULL OR valid_from <= ?)
              AND (valid_to IS NULL OR ? IS NULL OR valid_to >= ?)
            GROUP BY nursing_category_id, visit_frequency
          ) latest
            ON latest.nursing_category_id = current.nursing_category_id
            AND latest.visit_frequency = current.visit_frequency
            AND latest.valid_from = current.valid_from
          WHERE current.facility_id IS NULL
          ORDER BY current.nursing_category_id, current.visit_frequency
        `
      )
      .all(validOn ?? null, validOn ?? null, validOn ?? null, validOn ?? null);

    return rows.map((row) => mapRateSetting(row as RateSettingRow));
  }

  replaceInitialCommonRates(rates: CommonRateInput[]): void {
    const now = new Date().toISOString();
    this.db
      .prepare('DELETE FROM rate_settings WHERE facility_id IS NULL AND valid_from = ?')
      .run(initialValidFrom);

    const insertRate = this.db.prepare(`
      INSERT INTO rate_settings (
        facility_id,
        nursing_category_id,
        visit_frequency,
        amount_yen,
        valid_from,
        valid_to,
        created_at,
        updated_at
      )
      VALUES (NULL, ?, 1, ?, ?, NULL, ?, ?)
    `);

    rates.forEach((rate) => {
      insertRate.run(
        rate.nursingCategoryId,
        rate.amountYen,
        initialValidFrom,
        now,
        now
      );
    });
  }

  saveCommonRates(validFrom: string, rates: CommonRateInput[]): RateSetting[] {
    const now = new Date().toISOString();
    const updateRate = this.db.prepare(`
      UPDATE rate_settings
      SET amount_yen = ?, updated_at = ?
      WHERE facility_id IS NULL
        AND nursing_category_id = ?
        AND visit_frequency = 1
        AND valid_from = ?
    `);
    const insertRate = this.db.prepare(`
      INSERT INTO rate_settings (
        facility_id,
        nursing_category_id,
        visit_frequency,
        amount_yen,
        valid_from,
        valid_to,
        created_at,
        updated_at
      )
      VALUES (NULL, ?, 1, ?, ?, NULL, ?, ?)
    `);

    this.db.transaction(() => {
      rates.forEach((rate) => {
        const result = updateRate.run(
          rate.amountYen,
          now,
          rate.nursingCategoryId,
          validFrom
        );

        if (result.changes === 0) {
          insertRate.run(
            rate.nursingCategoryId,
            rate.amountYen,
            validFrom,
            now,
            now
          );
        }
      });
    })();

    return this.listEffectiveCommon(validFrom);
  }
}
