import type {
  CompleteInitialSetupInput,
  InitialSetupStatus,
  SaveFacilityInput
} from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { NursingCategoryRepository } from '../db/repositories/nursing-category-repository.js';
import { RateSettingRepository } from '../db/repositories/rate-setting-repository.js';
import { SettingsRepository } from '../db/repositories/settings-repository.js';
import {
  assertPositiveId,
  normalizeFacilityName,
  parseThousandYenToYen
} from './validation.js';

const initialSetupKey = 'initial_setup_completed';
const defaultFacilityNames = ['施設A', '施設B', '施設C', '施設D', '施設E'] as const;

export class SetupService {
  private readonly facilities: FacilityRepository;
  private readonly nursingCategories: NursingCategoryRepository;
  private readonly rates: RateSettingRepository;
  private readonly settings: SettingsRepository;

  constructor(private readonly db: AppDatabase) {
    this.facilities = new FacilityRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
    this.rates = new RateSettingRepository(db);
    this.settings = new SettingsRepository(db);
  }

  getStatus(): InitialSetupStatus {
    const facilities = this.facilities.list();
    const nursingCategories = this.nursingCategories.list();
    const rates = this.rates.listCommon();
    const hasRequiredMasters = facilities.length >= 5 && nursingCategories.length >= 4;

    return {
      completed: this.settings.getBoolean(initialSetupKey, false) && hasRequiredMasters,
      facilities,
      nursingCategories,
      rates
    };
  }

  complete(input: CompleteInitialSetupInput): InitialSetupStatus {
    const activeFacilities = this.facilities.list();
    if (input.facilities.length < 5) {
      throw new Error('INITIAL_FACILITIES_REQUIRED');
    }

    const facilityInputs = input.facilities.map((facility, index) => ({
      id: assertPositiveId(facility.id),
      name: normalizeFacilityName(facility.name),
      displayOrder: index + 1
    }));

    const activeFacilityIds = new Set(activeFacilities.map((facility) => facility.id));
    if (!facilityInputs.every((facility) => activeFacilityIds.has(facility.id))) {
      throw new Error('FACILITY_NOT_FOUND');
    }

    const categories = this.nursingCategories.list();
    const categoryIds = new Set(categories.map((category) => category.id));
    const expectedRateCount = categories.length;

    if (input.rates.length !== expectedRateCount) {
      throw new Error('RATE_SETTINGS_INCOMPLETE');
    }

    const rateKeys = new Set<number>();
    const rates = input.rates.map((rate) => {
      const nursingCategoryId = assertPositiveId(rate.nursingCategoryId);

      if (!categoryIds.has(nursingCategoryId) || rateKeys.has(nursingCategoryId)) {
        throw new Error('RATE_SETTINGS_INCOMPLETE');
      }

      rateKeys.add(nursingCategoryId);

      return {
        nursingCategoryId,
        amountYen: parseThousandYenToYen(rate.amountThousandYen)
      };
    });

    this.db.transaction(() => {
      facilityInputs.forEach((facility) => {
        this.facilities.update(facility);
      });
      this.rates.replaceInitialCommonRates(rates);
      this.settings.setBoolean(initialSetupKey, true);
    })();

    return this.getStatus();
  }
}

export class FacilityService {
  private readonly facilities: FacilityRepository;

  constructor(private readonly db: AppDatabase) {
    this.facilities = new FacilityRepository(db);
  }

  list(input?: { includeInactive?: boolean }) {
    return this.facilities.list(input?.includeInactive ?? false);
  }

  create(input: SaveFacilityInput) {
    return this.facilities.create({
      name: normalizeFacilityName(input.name),
      displayOrder: input.displayOrder
    });
  }

  restoreDefaults() {
    this.db.transaction(() => {
      const activeCount = (
        this.db.prepare('SELECT COUNT(*) AS count FROM facilities WHERE is_active = 1').get() as {
          count: number;
        }
      ).count;

      if (activeCount >= defaultFacilityNames.length) {
        return;
      }

      const now = new Date().toISOString();
      const findByOrder = this.db.prepare(
        'SELECT id FROM facilities WHERE display_order = ? ORDER BY id LIMIT 1'
      );
      const reactivateById = this.db.prepare(`
        UPDATE facilities
        SET name = ?, is_active = 1, updated_at = ?
        WHERE id = ?
      `);
      const createDefault = this.db.prepare(`
        INSERT INTO facilities (name, display_order, is_active, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `);

      defaultFacilityNames.forEach((name, index) => {
        const displayOrder = index + 1;
        const existing = findByOrder.get(displayOrder) as { id: number } | undefined;

        if (existing) {
          reactivateById.run(name, now, existing.id);
          return;
        }

        createDefault.run(name, displayOrder, now, now);
      });
    })();

    return this.facilities.list();
  }

  update(input: SaveFacilityInput) {
    if (!input.id) {
      throw new Error('ID_INVALID');
    }

    return this.facilities.update({
      id: assertPositiveId(input.id),
      name: normalizeFacilityName(input.name),
      displayOrder: input.displayOrder
    });
  }

  deactivate(input: { id: number }) {
    return this.facilities.deactivate(assertPositiveId(input.id));
  }
}
