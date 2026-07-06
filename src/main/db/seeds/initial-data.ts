import type { Database } from 'better-sqlite3';

const defaultAdminName = '初期管理者';
const defaultFacilities = ['施設A', '施設B', '施設C', '施設D', '施設E'] as const;

const nursingCategories = [
  { code: 'long_term_care', name: '介護', displayOrder: 1 },
  { code: 'appendix_7', name: '別表7', displayOrder: 2 },
  { code: 'psychiatric', name: '精神', displayOrder: 3 },
  { code: 'special_instruction', name: '特指示', displayOrder: 4 }
] as const;

export function seedInitialData(db: Database): void {
  const now = new Date().toISOString();

  db.transaction(() => {
    const activeAdminCount = (
      db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1")
        .get() as {
        count: number;
      }
    ).count;

    if (activeAdminCount === 0) {
      const existingAdmin = db
        .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
        .get() as { id: number } | undefined;

      if (existingAdmin) {
        db.prepare('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?').run(
          now,
          existingAdmin.id
        );
      } else {
        db.prepare(
          `
            INSERT INTO users (name, role, is_active, created_at, updated_at)
            VALUES (?, 'admin', 1, ?, ?)
          `
        ).run(defaultAdminName, now, now);
      }
    }

    db.prepare(
      `
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('initial_setup_completed', 'false', ?)
        ON CONFLICT(key) DO NOTHING
      `
    ).run(now);

    const setupCompleted =
      (
        db.prepare("SELECT value FROM app_settings WHERE key = 'initial_setup_completed'").get() as
          { value: string } | undefined
      )?.value === 'true';

    if (!setupCompleted) {
      const insertFacility = db.prepare(`
        INSERT INTO facilities (name, display_order, is_active, created_at, updated_at)
        SELECT ?, ?, 1, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM facilities WHERE display_order = ?)
      `);

      defaultFacilities.forEach((name, index) => {
        const displayOrder = index + 1;
        insertFacility.run(name, displayOrder, now, now, displayOrder);
      });

      const activeFacilityCount = (
        db.prepare('SELECT COUNT(*) AS count FROM facilities WHERE is_active = 1').get() as {
          count: number;
        }
      ).count;

      if (activeFacilityCount < defaultFacilities.length) {
        const findFacilityByOrder = db.prepare(
          'SELECT id FROM facilities WHERE display_order = ? ORDER BY id LIMIT 1'
        );
        const reactivateFacility = db.prepare(`
          UPDATE facilities
          SET name = ?, is_active = 1, updated_at = ?
          WHERE id = ?
        `);
        const createFacility = db.prepare(`
          INSERT INTO facilities (name, display_order, is_active, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?)
        `);

        defaultFacilities.forEach((name, index) => {
          const displayOrder = index + 1;
          const existing = findFacilityByOrder.get(displayOrder) as { id: number } | undefined;

          if (existing) {
            reactivateFacility.run(name, now, existing.id);
            return;
          }

          createFacility.run(name, displayOrder, now, now);
        });
      }
    }

    const insertCategory = db.prepare(`
      INSERT INTO nursing_categories (code, name, display_order, is_active)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(code) DO UPDATE SET
        name = excluded.name,
        display_order = excluded.display_order,
        is_active = 1
    `);

    nursingCategories.forEach((category) => {
      insertCategory.run(category.code, category.name, category.displayOrder);
    });

    const activeCategories = db
      .prepare('SELECT id FROM nursing_categories WHERE is_active = 1')
      .all() as Array<{ id: number }>;
    const findCommonRate = db.prepare(`
      SELECT id
      FROM rate_settings
      WHERE facility_id IS NULL
        AND nursing_category_id = ?
        AND visit_frequency = 1
      LIMIT 1
    `);
    const insertDefaultRate = db.prepare(`
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
      VALUES (NULL, ?, 1, 0, '1970-01-01', NULL, ?, ?)
    `);

    activeCategories.forEach((category) => {
      if (findCommonRate.get(category.id)) {
        return;
      }

      insertDefaultRate.run(category.id, now, now);
    });
  })();
}
