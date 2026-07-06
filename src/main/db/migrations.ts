import type { Database } from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  sql: string;
  disableForeignKeys?: boolean;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'general')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nursing_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE CHECK (code IN ('medical', 'psychiatric', 'long_term_care')),
        name TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS rate_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id INTEGER NULL REFERENCES facilities(id),
        nursing_category_id INTEGER NOT NULL REFERENCES nursing_categories(id),
        visit_frequency INTEGER NOT NULL CHECK (visit_frequency IN (1, 2, 3)),
        amount_yen INTEGER NOT NULL CHECK (amount_yen >= 0),
        valid_from TEXT NOT NULL,
        valid_to TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_settings_scope
        ON rate_settings (
          COALESCE(facility_id, 0),
          nursing_category_id,
          visit_frequency,
          valid_from
        );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    name: 'monthly_targets',
    sql: `
      CREATE TABLE IF NOT EXISTS monthly_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_month TEXT NOT NULL,
        facility_id INTEGER NOT NULL REFERENCES facilities(id),
        nursing_category_id INTEGER NOT NULL REFERENCES nursing_categories(id),
        target_people_count INTEGER NOT NULL CHECK (target_people_count >= 0),
        target_visit_count INTEGER NOT NULL CHECK (target_visit_count >= 0),
        target_sales_yen INTEGER NOT NULL CHECK (target_sales_yen >= 0),
        created_by INTEGER NOT NULL REFERENCES users(id),
        updated_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (target_month, facility_id, nursing_category_id)
      );
    `
  },
  {
    version: 3,
    name: 'monthly_periods',
    sql: `
      CREATE TABLE IF NOT EXISTS monthly_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_month TEXT NOT NULL,
        period_index INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        day_count INTEGER NOT NULL CHECK (day_count >= 1),
        created_at TEXT NOT NULL,
        UNIQUE (target_month, period_index)
      );
    `
  },
  {
    version: 4,
    name: 'weekly_entries',
    sql: `
      CREATE TABLE IF NOT EXISTS weekly_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_month TEXT NOT NULL,
        monthly_period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
        facility_id INTEGER NOT NULL REFERENCES facilities(id),
        status TEXT NOT NULL CHECK (status IN ('draft', 'completed')),
        completed_at TEXT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        updated_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (monthly_period_id, facility_id)
      );

      CREATE TABLE IF NOT EXISTS weekly_entry_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekly_entry_id INTEGER NOT NULL REFERENCES weekly_entries(id) ON DELETE CASCADE,
        nursing_category_id INTEGER NOT NULL REFERENCES nursing_categories(id),
        one_visit_people INTEGER NULL CHECK (
          one_visit_people IS NULL OR (one_visit_people >= 0 AND one_visit_people <= 99999)
        ),
        two_visit_people INTEGER NULL CHECK (
          two_visit_people IS NULL OR (two_visit_people >= 0 AND two_visit_people <= 99999)
        ),
        three_visit_people INTEGER NULL CHECK (
          three_visit_people IS NULL OR (three_visit_people >= 0 AND three_visit_people <= 99999)
        ),
        rate_one_yen INTEGER NOT NULL CHECK (rate_one_yen >= 0),
        rate_two_yen INTEGER NOT NULL CHECK (rate_two_yen >= 0),
        rate_three_yen INTEGER NOT NULL CHECK (rate_three_yen >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (weekly_entry_id, nursing_category_id)
      );
    `
  },
  {
    version: 5,
    name: 'month_closings',
    sql: `
      CREATE TABLE IF NOT EXISTS month_closings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_month TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
        closed_at TEXT NULL,
        closed_by INTEGER NULL REFERENCES users(id),
        reopened_at TEXT NULL,
        reopened_by INTEGER NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 6,
    name: 'nursing_categories_without_visit_frequency',
    disableForeignKeys: true,
    sql: `
      ALTER TABLE nursing_categories RENAME TO nursing_categories_legacy;

      CREATE TABLE nursing_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE CHECK (
          code IN ('long_term_care', 'appendix_7', 'psychiatric', 'special_instruction')
        ),
        name TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO nursing_categories (id, code, name, display_order, is_active)
      SELECT
        id,
        CASE code
          WHEN 'medical' THEN 'appendix_7'
          WHEN 'long_term_care' THEN 'long_term_care'
          WHEN 'psychiatric' THEN 'psychiatric'
          ELSE code
        END,
        CASE code
          WHEN 'medical' THEN '別表7'
          WHEN 'long_term_care' THEN '介護'
          WHEN 'psychiatric' THEN '精神'
          ELSE name
        END,
        CASE code
          WHEN 'long_term_care' THEN 1
          WHEN 'medical' THEN 2
          WHEN 'psychiatric' THEN 3
          ELSE display_order
        END,
        is_active
      FROM nursing_categories_legacy;

      DROP TABLE nursing_categories_legacy;
    `
  }
];

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (row) => Number(row.version)
    )
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    if (migration.disableForeignKeys) {
      db.pragma('foreign_keys = OFF');
      db.pragma('legacy_alter_table = ON');
      try {
        db.transaction(() => {
          db.exec(migration.sql);
          db.prepare(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
          ).run(migration.version, migration.name, new Date().toISOString());
        })();
      } finally {
        db.pragma('legacy_alter_table = OFF');
        db.pragma('foreign_keys = ON');
      }
      continue;
    }

    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    })();
  }
}
