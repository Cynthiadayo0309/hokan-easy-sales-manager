import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { DatabaseManager, initializeDatabase, openDatabase } from '../../src/main/db/connection';
import { migrations, runMigrations } from '../../src/main/db/migrations';
import { seedInitialData } from '../../src/main/db/seeds/initial-data';
import { BackupService, validateBackupDatabase } from '../../src/main/services/backup-service';
import { ConfirmedSalesService } from '../../src/main/services/confirmed-sales-service';
import { DashboardService } from '../../src/main/services/dashboard-service';
import { EntryService } from '../../src/main/services/entry-service';
import { ExportService } from '../../src/main/services/export-service';
import { MonthClosingService } from '../../src/main/services/month-closing-service';
import { OverallSalesTargetService } from '../../src/main/services/overall-sales-target-service';
import { PeriodService } from '../../src/main/services/period-service';
import { RateService, TargetService } from '../../src/main/services/rate-target-service';
import { FacilityService, SetupService } from '../../src/main/services/setup-service';
import { parseThousandYenToYen } from '../../src/main/services/validation';

function createTestDatabase() {
  return initializeDatabase(':memory:');
}

function saveCommonRatesForEntry(
  db: ReturnType<typeof createTestDatabase>,
  validFrom = '2026-07-01'
) {
  const setupService = new SetupService(db);
  const rateService = new RateService(db);
  const status = setupService.getStatus();

  rateService.save({
    validFrom,
    rates: status.nursingCategories.map((category) => ({
      nursingCategoryId: category.id,
      amountThousandYen: '8.5'
    }))
  });

  return status;
}

function buildWeeklyDetails(
  nursingCategories: Array<{ id: number }>,
  firstCategoryId: number,
  people: { one: number | null; two: number | null; three: number | null }
) {
  return nursingCategories.map((category) => ({
    nursingCategoryId: category.id,
    peopleCount:
      category.id === firstCategoryId
        ? (people.one ?? 0) + (people.two ?? 0) + (people.three ?? 0)
        : 0,
    oneVisitPeople: category.id === firstCategoryId ? people.one : 0,
    twoVisitPeople: category.id === firstCategoryId ? people.two : 0,
    threeVisitPeople: category.id === firstCategoryId ? people.three : 0
  }));
}

function buildPeopleCountDetails(
  nursingCategories: Array<{ id: number }>,
  categoryId: number,
  people: number
) {
  return nursingCategories.map((category) => ({
    nursingCategoryId: category.id,
    peopleCount: category.id === categoryId ? people : 0
  }));
}

function completeAllEntriesForMonth(
  entryService: EntryService,
  targetMonth: string,
  periods: Array<{ id: number }>,
  facilities: Array<{ id: number }>,
  nursingCategories: Array<{ id: number }>
): void {
  const [firstCategory] = nursingCategories;

  periods.forEach((period) => {
    facilities.forEach((facility) => {
      entryService.complete({
        targetMonth,
        monthlyPeriodId: period.id,
        facilityId: facility.id,
        details: buildWeeklyDetails(nursingCategories, firstCategory.id, {
          one: 1,
          two: 0,
          three: 0
        })
      });
    });
  });
}

describe('database initialization', () => {
  it('runs the initial migration and seeds required masters', () => {
    const db = createTestDatabase();

    expect(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN (1, 2, 3, 4, 5, 6)'
        )
        .get()
    ).toMatchObject({ count: 6 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'monthly_targets'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'monthly_confirmed_sales'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'monthly_overall_sales_targets'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'monthly_periods'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'weekly_entries'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'weekly_entry_details'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'month_closings'"
        )
        .get()
    ).toMatchObject({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM facilities').get()).toMatchObject({
      count: 5
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM nursing_categories').get()).toMatchObject({
      count: 4
    });
    expect(
      db.prepare('SELECT value FROM app_settings WHERE key = ?').get('initial_setup_completed')
    ).toMatchObject({
      value: 'false'
    });

    db.close();
  });

  it('does not duplicate migrations or seed data when rerun', () => {
    const db = createTestDatabase();

    runMigrations(db);
    seedInitialData(db);

    expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toMatchObject({
      count: 9
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM facilities').get()).toMatchObject({
      count: 5
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM nursing_categories').get()).toMatchObject({
      count: 4
    });

    db.close();
  });

  it('migrates legacy nursing categories to the current four categories', () => {
    const db = openDatabase(':memory:');
    const now = new Date().toISOString();

    migrations
      .filter((migration) => migration.version <= 5)
      .forEach((migration) => {
        db.exec(migration.sql);
        db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(migration.version, migration.name, now);
      });

    db.prepare(
      "INSERT INTO nursing_categories (id, code, name, display_order, is_active) VALUES (1, 'medical', '医療訪問看護', 1, 1)"
    ).run();
    db.prepare(
      "INSERT INTO nursing_categories (id, code, name, display_order, is_active) VALUES (2, 'psychiatric', '精神科訪問看護', 2, 1)"
    ).run();
    db.prepare(
      "INSERT INTO nursing_categories (id, code, name, display_order, is_active) VALUES (3, 'long_term_care', '介護訪問看護', 3, 1)"
    ).run();
    db.prepare(
      `
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
        VALUES (NULL, 1, 1, 8500, '1970-01-01', NULL, ?, ?)
      `
    ).run(now, now);

    runMigrations(db);
    seedInitialData(db);

    const categories = db
      .prepare(
        'SELECT id, code, name, display_order FROM nursing_categories ORDER BY display_order'
      )
      .all();
    expect(categories).toMatchObject([
      { id: 3, code: 'long_term_care', name: '介護', display_order: 1 },
      { id: 1, code: 'appendix_7', name: '別表7', display_order: 2 },
      { id: 2, code: 'psychiatric', name: '精神', display_order: 3 },
      { code: 'special_instruction', name: '特指示', display_order: 4 }
    ]);
    expect(
      db
        .prepare(
          'SELECT amount_yen FROM rate_settings WHERE nursing_category_id = 1 AND visit_frequency = 1'
        )
        .get()
    ).toMatchObject({ amount_yen: 8500 });
    expect(
      db
        .prepare(
          "SELECT amount_yen FROM rate_settings WHERE nursing_category_id = (SELECT id FROM nursing_categories WHERE code = 'special_instruction') AND visit_frequency = 1"
        )
        .get()
    ).toMatchObject({ amount_yen: 0 });

    db.close();
  });

  it('migrates legacy weekly entries into one monthly entry using the maximum people count', () => {
    const db = openDatabase(':memory:');
    const now = new Date().toISOString();

    migrations
      .filter((migration) => migration.version <= 5)
      .forEach((migration) => {
        db.exec(migration.sql);
        db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(migration.version, migration.name, now);
      });
    db.prepare(
      "INSERT INTO nursing_categories (id, code, name, display_order, is_active) VALUES (1, 'medical', '医療訪問看護', 1, 1)"
    ).run();
    db.prepare(
      "INSERT INTO nursing_categories (id, code, name, display_order, is_active) VALUES (2, 'psychiatric', '精神科訪問看護', 2, 1)"
    ).run();
    db.prepare(
      "INSERT INTO nursing_categories (id, code, name, display_order, is_active) VALUES (3, 'long_term_care', '介護訪問看護', 3, 1)"
    ).run();
    const categoryMigration = migrations.find((migration) => migration.version === 6)!;
    db.pragma('foreign_keys = OFF');
    db.pragma('legacy_alter_table = ON');
    db.exec(categoryMigration.sql);
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      categoryMigration.version,
      categoryMigration.name,
      now
    );
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
    seedInitialData(db);

    const facility = db.prepare('SELECT id FROM facilities ORDER BY id LIMIT 1').get() as {
      id: number;
    };
    const category = db
      .prepare("SELECT id FROM nursing_categories WHERE code = 'long_term_care'")
      .get() as { id: number };
    const user = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get() as { id: number };

    db.prepare(
      `
        INSERT INTO monthly_periods (target_month, period_index, start_date, end_date, day_count, created_at)
        VALUES
          ('2026-07-01', 1, '2026-07-01', '2026-07-04', 4, ?),
          ('2026-07-01', 2, '2026-07-05', '2026-07-11', 7, ?)
      `
    ).run(now, now);
    db.prepare(
      `
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
        VALUES
          ('2026-07-01', 1, ?, 'completed', ?, ?, ?, ?, ?),
          ('2026-07-01', 2, ?, 'draft', NULL, ?, ?, ?, ?)
      `
    ).run(facility.id, now, user.id, user.id, now, now, facility.id, user.id, user.id, now, now);
    db.prepare(
      `
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
        VALUES
          (1, ?, 5, 0, 0, 8500, 0, 0, ?, ?),
          (2, ?, 7, 0, 0, 8500, 0, 0, ?, ?)
      `
    ).run(category.id, now, now, category.id, now, now);

    runMigrations(db);

    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM monthly_periods WHERE target_month = '2026-07-01'")
        .get()
    ).toMatchObject({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM weekly_entries').get()).toMatchObject({
      count: 1
    });
    expect(
      db
        .prepare('SELECT one_visit_people FROM weekly_entry_details WHERE nursing_category_id = ?')
        .get(category.id)
    ).toMatchObject({ one_visit_people: 7 });

    db.close();
  });

  it('restores default facilities when no active facility remains', () => {
    const db = createTestDatabase();

    db.prepare('UPDATE facilities SET is_active = 0').run();
    seedInitialData(db);

    expect(
      db.prepare('SELECT COUNT(*) AS count FROM facilities WHERE is_active = 1').get()
    ).toMatchObject({
      count: 5
    });

    db.close();
  });

  it('repairs insufficient default facilities while initial setup is incomplete', () => {
    const db = createTestDatabase();

    db.prepare('UPDATE facilities SET is_active = 0 WHERE display_order IN (4, 5)').run();
    seedInitialData(db);

    expect(
      db.prepare('SELECT COUNT(*) AS count FROM facilities WHERE is_active = 1').get()
    ).toMatchObject({
      count: 5
    });

    db.close();
  });

  it('does not reactivate intentionally stopped facilities after setup is completed', () => {
    const db = createTestDatabase();

    db.prepare(
      "UPDATE app_settings SET value = 'true' WHERE key = 'initial_setup_completed'"
    ).run();
    db.prepare('UPDATE facilities SET is_active = 0 WHERE display_order = 5').run();
    seedInitialData(db);

    expect(
      db.prepare('SELECT COUNT(*) AS count FROM facilities WHERE is_active = 1').get()
    ).toMatchObject({
      count: 4
    });

    db.close();
  });
});

describe('monthly period service', () => {
  it('creates a whole-month period for a month on first access', () => {
    const db = createTestDatabase();
    const periodService = new PeriodService(db);

    const periods = periodService.listByMonth({ targetMonth: '2026-07-01' });

    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      targetMonth: '2026-07-01',
      periodIndex: 1,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      dayCount: 31
    });
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM monthly_periods WHERE target_month = ?')
        .get('2026-07-01')
    ).toMatchObject({ count: 1 });

    db.close();
  });

  it('does not duplicate saved periods on repeated access', () => {
    const db = createTestDatabase();
    const periodService = new PeriodService(db);

    periodService.listByMonth({ targetMonth: '2026-08-01' });
    const secondRead = periodService.listByMonth({ targetMonth: '2026-08-01' });

    expect(secondRead).toHaveLength(1);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM monthly_periods WHERE target_month = ?')
        .get('2026-08-01')
    ).toMatchObject({ count: 1 });

    db.close();
  });
});

describe('facility and setup services', () => {
  it('updates and deactivates facilities without deleting rows', () => {
    const db = createTestDatabase();
    const facilityService = new FacilityService(db);
    const [firstFacility] = facilityService.list();

    const updated = facilityService.update({ id: firstFacility.id, name: '青葉ステーション' });
    expect(updated.name).toBe('青葉ステーション');

    const deactivated = facilityService.deactivate({ id: firstFacility.id });
    expect(deactivated.isActive).toBe(false);
    expect(facilityService.list()).toHaveLength(4);
    expect(facilityService.list({ includeInactive: true })).toHaveLength(5);

    db.close();
  });

  it('restores default facilities from the service without duplicating rows', () => {
    const db = createTestDatabase();
    const facilityService = new FacilityService(db);

    db.prepare('UPDATE facilities SET is_active = 0').run();

    const restored = facilityService.restoreDefaults();
    const restoredAgain = facilityService.restoreDefaults();

    expect(restored).toHaveLength(5);
    expect(restoredAgain).toHaveLength(5);
    expect(db.prepare('SELECT COUNT(*) AS count FROM facilities').get()).toMatchObject({
      count: 5
    });

    db.close();
  });

  it('completes initial setup in one transaction and stores rates as yen', () => {
    const db = createTestDatabase();
    const setupService = new SetupService(db);
    const status = setupService.getStatus();

    const completed = setupService.complete({
      facilities: status.facilities.map((facility, index) => ({
        id: facility.id,
        name: `施設${index + 1}`
      })),
      rates: status.nursingCategories.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen: '8.5'
      }))
    });

    expect(completed.completed).toBe(true);
    expect(completed.rates).toHaveLength(4);
    expect(completed.rates.find((rate) => rate.nursingCategoryId)?.amountYen).toBe(8500);

    db.close();
  });

  it('does not report setup completed when required masters are missing', () => {
    const db = createTestDatabase();
    db.prepare(
      "UPDATE app_settings SET value = 'true' WHERE key = 'initial_setup_completed'"
    ).run();
    db.prepare('UPDATE facilities SET is_active = 0').run();

    const setupService = new SetupService(db);

    expect(setupService.getStatus().completed).toBe(false);

    db.close();
  });

  it('converts thousand yen input without floating point drift', () => {
    expect(parseThousandYenToYen('8.5')).toBe(8500);
    expect(parseThousandYenToYen('500')).toBe(500000);
    expect(parseThousandYenToYen('1,250')).toBe(1250000);
  });
});

describe('rate and monthly target services', () => {
  it('saves and retrieves one common rate for each nursing category', () => {
    const db = createTestDatabase();
    const setupService = new SetupService(db);
    const rateService = new RateService(db);
    const status = setupService.getStatus();

    const saved = rateService.save({
      validFrom: '2026-07-01',
      rates: status.nursingCategories.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen: '8.5'
      }))
    });

    expect(saved).toHaveLength(4);
    expect(saved.find((rate) => rate.nursingCategoryId)?.amountYen).toBe(8500);

    const updated = rateService.save({
      validFrom: '2026-07-01',
      rates: status.nursingCategories.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen: '9.0'
      }))
    });

    expect(updated).toHaveLength(4);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM rate_settings WHERE valid_from = ?')
        .get('2026-07-01')
    ).toMatchObject({
      count: 4
    });

    db.close();
  });

  it('saves monthly targets without duplicating facility/category rows', () => {
    const db = createTestDatabase();
    const setupService = new SetupService(db);
    const targetService = new TargetService(db);
    const status = setupService.getStatus();

    const targets = status.facilities.flatMap((facility) =>
      status.nursingCategories.map((category) => ({
        facilityId: facility.id,
        nursingCategoryId: category.id,
        targetPeopleCount: 10,
        targetVisitCount: 20,
        targetSalesThousandYen: category.code === 'appendix_7' ? '8.5' : '500'
      }))
    );

    const saved = targetService.saveMonthly({
      targetMonth: '2026-07-01',
      targets
    });

    expect(saved).toHaveLength(20);
    expect(saved.find((target) => target.targetSalesYen === 8500)).toBeTruthy();

    const updated = targetService.saveMonthly({
      targetMonth: '2026-07-01',
      targets: targets.map((target) => ({ ...target, targetPeopleCount: 11 }))
    });

    expect(updated).toHaveLength(20);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM monthly_targets WHERE target_month = ?')
        .get('2026-07-01')
    ).toMatchObject({
      count: 20
    });
    expect(updated.every((target) => target.targetPeopleCount === 11)).toBe(true);

    db.close();
  });

  it('copies previous month targets without changing the source month', () => {
    const db = createTestDatabase();
    const setupService = new SetupService(db);
    const targetService = new TargetService(db);
    const status = setupService.getStatus();

    const previousTargets = status.facilities.flatMap((facility) =>
      status.nursingCategories.map((category) => ({
        facilityId: facility.id,
        nursingCategoryId: category.id,
        targetPeopleCount: 7,
        targetVisitCount: 14,
        targetSalesThousandYen: '1250'
      }))
    );

    targetService.saveMonthly({
      targetMonth: '2026-06-01',
      targets: previousTargets
    });

    const copied = targetService.copyPreviousMonth({ targetMonth: '2026-07-01' });

    expect(copied).toHaveLength(20);
    expect(copied.every((target) => target.targetSalesYen === 1250000)).toBe(true);
    expect(targetService.getByMonth({ targetMonth: '2026-06-01' })).toHaveLength(20);

    db.close();
  });
});

describe('monthly entry service', () => {
  it('returns a monthly status matrix with not started, draft, and completed cells', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const periods = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility, secondFacility] = status.facilities;
    const [firstCategory] = status.nursingCategories;

    const emptyMatrix = entryService.getStatusByMonth({ targetMonth: '2026-07-01' });
    expect(emptyMatrix.cells).toHaveLength(status.facilities.length * periods.length);
    expect(emptyMatrix.cells.every((cell) => cell.status === 'not_started')).toBe(true);

    entryService.saveDraft({
      targetMonth: '2026-07-01',
      monthlyPeriodId: periods[0].id,
      facilityId: facility.id,
      details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
        one: 1,
        two: 0,
        three: 0
      })
    });
    entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: periods[0].id,
      facilityId: secondFacility.id,
      details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
        one: 2,
        two: 0,
        three: 0
      })
    });

    const matrix = entryService.getStatusByMonth({ targetMonth: '2026-07-01' });

    expect(
      matrix.cells.find(
        (cell) => cell.monthlyPeriodId === periods[0].id && cell.facilityId === facility.id
      )
    ).toMatchObject({ status: 'draft' });
    expect(
      matrix.cells.find(
        (cell) => cell.monthlyPeriodId === periods[0].id && cell.facilityId === secondFacility.id
      )
    ).toMatchObject({ status: 'completed' });

    db.close();
  });

  it('saves, reloads, completes, and keeps one entry per period/facility', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;
    const [firstCategory] = status.nursingCategories;

    const details = status.nursingCategories.map((category) => ({
      nursingCategoryId: category.id,
      oneVisitPeople: category.id === firstCategory.id ? 10 : 0,
      twoVisitPeople: category.id === firstCategory.id ? 3 : 0,
      threeVisitPeople: category.id === firstCategory.id ? 2 : 0
    }));

    const draft = entryService.saveDraft({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details
    });

    expect(draft.status).toBe('draft');
    expect(draft.summary).toMatchObject({
      peopleCount: 15,
      visitCount: 15,
      salesYen: 127500
    });

    const reloaded = entryService.get({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id
    });
    expect(
      reloaded.details.find((detail) => detail.nursingCategoryId === firstCategory.id)
    ).toMatchObject({
      peopleCount: 15,
      oneVisitPeople: 15,
      rateOneYen: 8500,
      rateTwoYen: 0,
      rateThreeYen: 0
    });

    const completed = entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details
    });

    expect(completed.status).toBe('completed');
    expect(completed.entry?.completedAt).toBeTruthy();
    expect(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM weekly_entries WHERE monthly_period_id = ? AND facility_id = ?'
        )
        .get(period.id, facility.id)
    ).toMatchObject({ count: 1 });

    db.close();
  });

  it('keeps saved rate snapshots after common rates are changed', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const rateService = new RateService(db);
    const entryService = new EntryService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;
    const [firstCategory] = status.nursingCategories;
    const details = status.nursingCategories.map((category) => ({
      nursingCategoryId: category.id,
      oneVisitPeople: category.id === firstCategory.id ? 1 : 0,
      twoVisitPeople: category.id === firstCategory.id ? 1 : 0,
      threeVisitPeople: category.id === firstCategory.id ? 1 : 0
    }));

    entryService.saveDraft({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details
    });

    rateService.save({
      validFrom: '2026-07-01',
      rates: status.nursingCategories.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen: '9.0'
      }))
    });

    const reloaded = entryService.get({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id
    });
    const savedDetail = reloaded.details.find(
      (detail) => detail.nursingCategoryId === firstCategory.id
    );

    expect(savedDetail).toMatchObject({
      rateOneYen: 8500,
      rateTwoYen: 0,
      rateThreeYen: 0
    });
    expect(reloaded.summary.salesYen).toBe(25500);

    db.close();
  });

  it('does not allow completed entries with blank people inputs', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;

    expect(() =>
      entryService.complete({
        targetMonth: '2026-07-01',
        monthlyPeriodId: period.id,
        facilityId: facility.id,
        details: status.nursingCategories.map((category) => ({
          nursingCategoryId: category.id,
          peopleCount: null,
          oneVisitPeople: null,
          twoVisitPeople: 0,
          threeVisitPeople: 0
        }))
      })
    ).toThrow('WEEKLY_ENTRY_DETAILS_INCOMPLETE');

    db.close();
  });

  it('recalculates monthly sales when a monthly count is increased', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;
    const [firstCategory] = status.nursingCategories;

    const first = entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details: buildPeopleCountDetails(status.nursingCategories, firstCategory.id, 5)
    });

    const increased = entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details: buildPeopleCountDetails(status.nursingCategories, firstCategory.id, 7)
    });

    expect(first.summary.salesYen).toBe(42_500);
    expect(increased.summary.salesYen).toBe(59_500);
    expect(
      increased.details.find((detail) => detail.nursingCategoryId === firstCategory.id)
    ).toMatchObject({
      peopleCount: 7,
      billingMode: 'monthly',
      billablePeopleCount: 7,
      billableSalesYen: 59_500
    });

    db.close();
  });

  it('calculates every category as monthly people times the monthly rate', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const dashboardService = new DashboardService(db);
    const exportService = new ExportService(db);
    const entryService = new EntryService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;

    const completed = entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details: status.nursingCategories.map((category, index) => ({
        nursingCategoryId: category.id,
        peopleCount: index + 1
      }))
    });
    const dashboard = dashboardService.getMonthly({ targetMonth: '2026-07-01' });
    const csv = exportService.buildDetailCsv('2026-07-01');

    expect(completed.summary.salesYen).toBe(85_000);
    expect(dashboard.summary.actualSalesYen).toBe(85_000);
    expect(dashboard.periodRows[0].salesYen).toBe(85_000);
    expect(csv.content).toContain(`${status.nursingCategories[3].name},4,34000`);

    db.close();
  });

  it('does not copy when there is no previous monthly period', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const periods = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;

    expect(() =>
      entryService.copyPrevious({
        targetMonth: '2026-07-01',
        monthlyPeriodId: periods[0].id,
        facilityId: facility.id
      })
    ).toThrow('PREVIOUS_PERIOD_NOT_FOUND');

    db.close();
  });
});

describe('monthly dashboard service', () => {
  it('returns a safe dashboard when there are no monthly entries', () => {
    const db = createTestDatabase();
    const dashboardService = new DashboardService(db);

    const dashboard = dashboardService.getMonthly({ targetMonth: '2026-07-01' });

    expect(dashboard.summary.actualSalesYen).toBe(0);
    expect(dashboard.summary.targetSalesYen).toBe(0);
    expect(dashboard.summary.achievement.ratePercent).toBeNull();
    expect(dashboard.summary.forecast.forecastSalesYen).toBeNull();
    expect(dashboard.confirmedSales).toBeNull();
    expect(dashboard.confirmedAchievement).toBeNull();
    expect(dashboard.facilityRows).toHaveLength(5);
    expect(dashboard.nursingCategoryRows).toHaveLength(4);
    expect(dashboard.periodRows).toHaveLength(1);

    db.close();
  });

  it('aggregates targets, draft and completed monthly entries', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const targetService = new TargetService(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const dashboardService = new DashboardService(db);
    const periods = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [firstFacility, secondFacility] = status.facilities;
    const [firstCategory] = status.nursingCategories;

    targetService.saveMonthly({
      targetMonth: '2026-07-01',
      targets: status.facilities.flatMap((facility) =>
        status.nursingCategories.map((category) => ({
          facilityId: facility.id,
          nursingCategoryId: category.id,
          targetPeopleCount: 10,
          targetVisitCount: 20,
          targetSalesThousandYen: '100'
        }))
      )
    });

    status.facilities.forEach((facility) => {
      entryService.complete({
        targetMonth: '2026-07-01',
        monthlyPeriodId: periods[0].id,
        facilityId: facility.id,
        details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
          one: facility.id === firstFacility.id ? 10 : 0,
          two: 0,
          three: 0
        })
      });
    });

    entryService.saveDraft({
      targetMonth: '2026-07-01',
      monthlyPeriodId: periods[0].id,
      facilityId: secondFacility.id,
      details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
        one: 10,
        two: 0,
        three: 0
      })
    });

    const dashboard = dashboardService.getMonthly({ targetMonth: '2026-07-01' });
    const firstFacilityRow = dashboard.facilityRows.find(
      (row) => row.facilityId === firstFacility.id
    );
    const firstCategoryRow = dashboard.nursingCategoryRows.find(
      (row) => row.nursingCategoryId === firstCategory.id
    );

    expect(dashboard.summary.targetSalesYen).toBe(2_000_000);
    expect(dashboard.summary.actualSalesYen).toBe(170_000);
    expect(dashboard.summary.actualPeopleCount).toBe(20);
    expect(dashboard.summary.forecast.completedDayCount).toBe(0);
    expect(dashboard.summary.forecast.forecastSalesYen).toBeNull();
    expect(firstFacilityRow?.actualSalesYen).toBe(85_000);
    expect(firstCategoryRow?.actualSalesYen).toBe(170_000);
    expect(dashboard.periodRows[0]).toMatchObject({
      completedFacilityCount: 4,
      salesYen: 170_000
    });

    db.close();
  });

  it('returns safe values when monthly targets are zero and actual sales exceed the target', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const dashboardService = new DashboardService(db);
    const confirmedSalesService = new ConfirmedSalesService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;
    const [firstCategory] = status.nursingCategories;

    entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
        one: 1,
        two: 0,
        three: 0
      })
    });
    confirmedSalesService.save({
      targetMonth: '2026-07-01',
      amountThousandYen: '8.5'
    });

    const dashboard = dashboardService.getMonthly({ targetMonth: '2026-07-01' });

    expect(dashboard.summary.targetSalesYen).toBe(0);
    expect(dashboard.summary.actualSalesYen).toBe(8_500);
    expect(dashboard.summary.achievement).toMatchObject({
      ratePercent: null,
      status: 'not_set',
      remainingYen: -8_500
    });
    expect(dashboard.confirmedAchievement).toMatchObject({
      ratePercent: null,
      status: 'not_set',
      remainingYen: -8_500
    });

    db.close();
  });

  it('calculates confirmed achievement without changing estimated breakdowns', () => {
    const db = createTestDatabase();
    const setupStatus = new SetupService(db).getStatus();
    const rateService = new RateService(db);
    const targetService = new TargetService(db);
    const confirmedSalesService = new ConfirmedSalesService(db);
    const overallSalesTargetService = new OverallSalesTargetService(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const dashboardService = new DashboardService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = setupStatus.facilities;
    const [category] = setupStatus.nursingCategories;

    rateService.save({
      validFrom: '2026-07-01',
      rates: setupStatus.nursingCategories.map((nursingCategory) => ({
        nursingCategoryId: nursingCategory.id,
        amountThousandYen: '8'
      }))
    });
    targetService.saveMonthly({
      targetMonth: '2026-07-01',
      targets: [
        {
          facilityId: facility.id,
          nursingCategoryId: category.id,
          targetPeopleCount: 100,
          targetVisitCount: 100,
          targetSalesThousandYen: '1000'
        }
      ]
    });
    entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: facility.id,
      details: buildPeopleCountDetails(setupStatus.nursingCategories, category.id, 100)
    });
    confirmedSalesService.save({
      targetMonth: '2026-07-01',
      amountThousandYen: '750'
    });

    const fallbackDashboard = dashboardService.getMonthly({ targetMonth: '2026-07-01' });
    overallSalesTargetService.save({
      targetMonth: '2026-07-01',
      amountThousandYen: '900'
    });
    const dashboard = dashboardService.getMonthly({ targetMonth: '2026-07-01' });

    expect(fallbackDashboard.targetSalesSource).toBe('detailed_sum');
    expect(fallbackDashboard.summary.targetSalesYen).toBe(1_000_000);
    expect(fallbackDashboard.confirmedAchievement?.ratePercent).toBe(75);
    expect(dashboard.targetSalesSource).toBe('overall');
    expect(dashboard.overallSalesTarget?.targetSalesYen).toBe(900_000);
    expect(dashboard.summary.targetSalesYen).toBe(900_000);
    expect(dashboard.summary.actualSalesYen).toBe(800_000);
    expect(dashboard.confirmedSales?.confirmedSalesYen).toBe(750_000);
    expect(dashboard.confirmedAchievement).toMatchObject({
      ratePercent: 83.3,
      remainingYen: 150_000,
      status: 'remaining'
    });
    expect(dashboard.facilityRows[0].targetSalesYen).toBe(1_000_000);
    expect(dashboard.facilityRows[0].actualSalesYen).toBe(800_000);
    expect(dashboard.nursingCategoryRows[0].actualSalesYen).toBe(800_000);

    db.close();
  });
});

describe('confirmed sales service', () => {
  it('saves thousand-yen values, preserves explicit zero, and clears to missing', () => {
    const db = createTestDatabase();
    const service = new ConfirmedSalesService(db);

    expect(
      service.save({ targetMonth: '2026-07-01', amountThousandYen: '8.5' })?.confirmedSalesYen
    ).toBe(8_500);
    expect(
      service.save({ targetMonth: '2026-07-01', amountThousandYen: 0 })?.confirmedSalesYen
    ).toBe(0);
    expect(service.save({ targetMonth: '2026-07-01', amountThousandYen: null })).toBeNull();
    expect(service.getByMonth({ targetMonth: '2026-07-01' })).toBeNull();
    expect(() => service.save({ targetMonth: '2026-07-01', amountThousandYen: '8.55' })).toThrow(
      'AMOUNT_INVALID'
    );

    db.close();
  });
});

describe('overall sales target service', () => {
  it('saves thousand-yen values, preserves explicit zero, and clears to fallback', () => {
    const db = createTestDatabase();
    const service = new OverallSalesTargetService(db);

    expect(
      service.save({ targetMonth: '2026-07-01', amountThousandYen: '8.5' })?.targetSalesYen
    ).toBe(8_500);
    expect(service.save({ targetMonth: '2026-07-01', amountThousandYen: 0 })?.targetSalesYen).toBe(
      0
    );
    expect(new DashboardService(db).getMonthly({ targetMonth: '2026-07-01' })).toMatchObject({
      targetSalesSource: 'overall',
      summary: { targetSalesYen: 0 }
    });
    expect(service.save({ targetMonth: '2026-07-01', amountThousandYen: null })).toBeNull();
    expect(service.getByMonth({ targetMonth: '2026-07-01' })).toBeNull();

    db.close();
  });
});

describe('month closing service', () => {
  it('closes a month after all entries are completed and blocks edits until reopened', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const targetService = new TargetService(db);
    const confirmedSalesService = new ConfirmedSalesService(db);
    const overallSalesTargetService = new OverallSalesTargetService(db);
    const closingService = new MonthClosingService(db);
    const periods = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const [facility] = status.facilities;
    const [firstCategory] = status.nursingCategories;

    targetService.saveMonthly({
      targetMonth: '2026-07-01',
      targets: status.facilities.flatMap((targetFacility) =>
        status.nursingCategories.map((category) => ({
          facilityId: targetFacility.id,
          nursingCategoryId: category.id,
          targetPeopleCount: 1,
          targetVisitCount: 1,
          targetSalesThousandYen: '10'
        }))
      )
    });
    completeAllEntriesForMonth(
      entryService,
      '2026-07-01',
      periods,
      status.facilities,
      status.nursingCategories
    );
    confirmedSalesService.save({
      targetMonth: '2026-07-01',
      amountThousandYen: '100'
    });
    overallSalesTargetService.save({
      targetMonth: '2026-07-01',
      amountThousandYen: '200'
    });

    const closed = closingService.closeMonth({
      targetMonth: '2026-07-01',
      acknowledgeWarnings: false
    });

    expect(closed.status).toBe('closed');
    expect(() =>
      entryService.saveDraft({
        targetMonth: '2026-07-01',
        monthlyPeriodId: periods[0].id,
        facilityId: facility.id,
        details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
          one: 2,
          two: 0,
          three: 0
        })
      })
    ).toThrow('MONTH_CLOSED');
    expect(() =>
      targetService.saveMonthly({
        targetMonth: '2026-07-01',
        targets: []
      })
    ).toThrow('MONTH_CLOSED');
    expect(() =>
      confirmedSalesService.save({
        targetMonth: '2026-07-01',
        amountThousandYen: '200'
      })
    ).toThrow('MONTH_CLOSED');
    expect(() =>
      overallSalesTargetService.save({
        targetMonth: '2026-07-01',
        amountThousandYen: '300'
      })
    ).toThrow('MONTH_CLOSED');

    const reopened = closingService.reopenMonth({ targetMonth: '2026-07-01' });
    expect(reopened.status).toBe('open');
    expect(() =>
      entryService.saveDraft({
        targetMonth: '2026-07-01',
        monthlyPeriodId: periods[0].id,
        facilityId: facility.id,
        details: buildWeeklyDetails(status.nursingCategories, firstCategory.id, {
          one: 2,
          two: 0,
          three: 0
        })
      })
    ).not.toThrow();

    db.close();
  });

  it('returns missing entry warnings and target warnings before closing', () => {
    const db = createTestDatabase();
    saveCommonRatesForEntry(db);
    const closingService = new MonthClosingService(db);

    const status = closingService.getStatus({ targetMonth: '2026-07-01' });

    expect(status.canClose).toBe(false);
    expect(status.warnings.some((warning) => warning.type === 'missing_entry')).toBe(true);
    expect(status.warnings.some((warning) => warning.type === 'missing_target')).toBe(true);
    expect(status.warnings.some((warning) => warning.type === 'missing_overall_sales_target')).toBe(
      true
    );
    expect(status.warnings.some((warning) => warning.type === 'missing_confirmed_sales')).toBe(
      true
    );
    expect(() =>
      closingService.closeMonth({ targetMonth: '2026-07-01', acknowledgeWarnings: true })
    ).toThrow('MONTH_CLOSING_INCOMPLETE');

    db.close();
  });

  it('allows closing with target warnings only after acknowledgement and returns comparison', () => {
    const db = createTestDatabase();
    saveCommonRatesForEntry(db, '2026-06-01');
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const dashboardService = new DashboardService(db);
    const closingService = new MonthClosingService(db);
    const julyPeriods = periodService.listByMonth({ targetMonth: '2026-07-01' });
    const junePeriods = periodService.listByMonth({ targetMonth: '2026-06-01' });
    const setupStatus = new SetupService(db).getStatus();

    completeAllEntriesForMonth(
      entryService,
      '2026-07-01',
      julyPeriods,
      setupStatus.facilities,
      setupStatus.nursingCategories
    );
    entryService.complete({
      targetMonth: '2026-06-01',
      monthlyPeriodId: junePeriods[0].id,
      facilityId: setupStatus.facilities[0].id,
      details: buildWeeklyDetails(
        setupStatus.nursingCategories,
        setupStatus.nursingCategories[0].id,
        {
          one: 1,
          two: 0,
          three: 0
        }
      )
    });

    expect(() =>
      closingService.closeMonth({ targetMonth: '2026-07-01', acknowledgeWarnings: false })
    ).toThrow('MONTH_CLOSING_WARNINGS_UNACKNOWLEDGED');

    const closed = closingService.closeMonth({
      targetMonth: '2026-07-01',
      acknowledgeWarnings: true
    });
    const withComparison = closingService.getStatus(
      { targetMonth: '2026-07-01' },
      dashboardService.getMonthly({ targetMonth: '2026-07-01' }),
      dashboardService.getMonthly({ targetMonth: '2026-06-01' })
    );

    expect(closed.status).toBe('closed');
    expect(withComparison.comparison.previousSalesYen).toBeGreaterThan(0);
    expect(withComparison.comparison.differenceYen).toBe(
      withComparison.comparison.currentSalesYen - withComparison.comparison.previousSalesYen
    );

    db.close();
  });
});

describe('export service', () => {
  it('builds UTF-8 BOM detail CSV with required monthly columns', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const periodService = new PeriodService(db);
    const entryService = new EntryService(db);
    const exportService = new ExportService(db);
    const [period] = periodService.listByMonth({ targetMonth: '2026-07-01' });

    entryService.complete({
      targetMonth: '2026-07-01',
      monthlyPeriodId: period.id,
      facilityId: status.facilities[0].id,
      details: buildWeeklyDetails(status.nursingCategories, status.nursingCategories[0].id, {
        one: 1,
        two: 0,
        three: 0
      })
    });

    const csv = exportService.buildDetailCsv('2026-07-01');

    expect(csv.content.charCodeAt(0)).toBe(0xfeff);
    expect(csv.content).toContain('対象年月,施設名,看護区分,人数,売上円,売上千円,入力状態');
    expect(csv.content).toContain(status.facilities[0].name);
    expect(csv.content).toContain(status.nursingCategories[0].name);
    expect(csv.rowCount).toBe(4);

    db.close();
  });

  it('builds monthly summary CSV with overall, facility, and category rows', () => {
    const db = createTestDatabase();
    const status = saveCommonRatesForEntry(db);
    const targetService = new TargetService(db);
    const confirmedSalesService = new ConfirmedSalesService(db);
    const exportService = new ExportService(db);

    targetService.saveMonthly({
      targetMonth: '2026-07-01',
      targets: status.facilities.flatMap((facility) =>
        status.nursingCategories.map((category) => ({
          facilityId: facility.id,
          nursingCategoryId: category.id,
          targetPeopleCount: 1,
          targetVisitCount: 1,
          targetSalesThousandYen: '10'
        }))
      )
    });
    confirmedSalesService.save({
      targetMonth: '2026-07-01',
      amountThousandYen: '175'
    });

    const csv = exportService.buildMonthlyCsv('2026-07-01');

    expect(csv.content.charCodeAt(0)).toBe(0xfeff);
    expect(csv.content).toContain(
      '種別,名称,目標千円,概算売上千円,確定売上千円,概算達成率,確定達成率,概算差額千円,確定差額千円'
    );
    expect(csv.content).toContain('全体,全体');
    expect(csv.content).toContain('175千円');
    expect(csv.content).toContain('施設別');
    expect(csv.content).toContain('看護区分別');

    db.close();
  });
});

describe('backup service', () => {
  it('creates a backup database that can be opened and read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hokan-backup-test-'));
    const dbPath = join(dir, 'application.db');
    const backupPath = join(dir, 'backup.db');
    const manager = new DatabaseManager(dbPath);
    const backupService = new BackupService(manager, dir);

    await backupService.createToPath(backupPath);
    validateBackupDatabase(backupPath);

    const backupDb = openDatabase(backupPath);
    expect(backupDb.prepare('SELECT COUNT(*) AS count FROM facilities').get()).toMatchObject({
      count: 5
    });
    backupDb.close();
    manager.getDb().close();
  });

  it('restores from a backup and creates an automatic pre-restore backup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hokan-restore-test-'));
    const dbPath = join(dir, 'application.db');
    const backupPath = join(dir, 'backup.db');
    const manager = new DatabaseManager(dbPath);
    const backupService = new BackupService(manager, dir);
    const facilityService = new FacilityService(manager.getDb());
    const [facility] = facilityService.list();

    facilityService.update({ id: facility.id, name: '復元前' });
    await backupService.createToPath(backupPath);
    facilityService.update({ id: facility.id, name: '変更後' });

    const result = await backupService.restoreFromPath(backupPath);

    expect(result.ok).toBe(true);
    expect(result.backupFileName).toBeTruthy();
    expect(existsSync(join(dir, 'backups', result.backupFileName!))).toBe(true);
    expect(new FacilityService(manager.getDb()).list()[0].name).toBe('復元前');

    manager.getDb().close();
  });

  it('rejects a broken backup file and keeps current data', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hokan-broken-restore-test-'));
    const dbPath = join(dir, 'application.db');
    const brokenPath = join(dir, 'broken.db');
    const manager = new DatabaseManager(dbPath);
    const backupService = new BackupService(manager, dir);
    const facilityService = new FacilityService(manager.getDb());
    const [facility] = facilityService.list();

    facilityService.update({ id: facility.id, name: '維持する施設' });
    writeFileSync(brokenPath, 'not sqlite');

    await expect(backupService.restoreFromPath(brokenPath)).rejects.toThrow();
    expect(new FacilityService(manager.getDb()).list()[0].name).toBe('維持する施設');

    manager.getDb().close();
  });
});
