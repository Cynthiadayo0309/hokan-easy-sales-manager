import type { AppDatabase } from '../connection.js';

export class SettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  getBoolean(key: string, fallback: boolean): boolean {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
      { value: string } | undefined;

    if (!row) {
      return fallback;
    }

    return row.value === 'true';
  }

  setBoolean(key: string, value: boolean): void {
    this.db
      .prepare(
        `
          INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `
      )
      .run(key, value ? 'true' : 'false', new Date().toISOString());
  }
}
