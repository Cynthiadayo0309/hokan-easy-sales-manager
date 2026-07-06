import type { Facility, SaveFacilityInput } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapFacility, type FacilityRow } from '../row-mappers.js';

export class FacilityRepository {
  constructor(private readonly db: AppDatabase) {}

  list(includeInactive = false): Facility[] {
    const rows = this.db
      .prepare(
        `
          SELECT id, name, display_order, is_active, created_at, updated_at
          FROM facilities
          ${includeInactive ? '' : 'WHERE is_active = 1'}
          ORDER BY display_order, id
        `
      )
      .all() as FacilityRow[];

    return rows.map((row) => mapFacility(row));
  }

  getById(id: number): Facility | null {
    const row = this.db
      .prepare(
        `
          SELECT id, name, display_order, is_active, created_at, updated_at
          FROM facilities
          WHERE id = ?
        `
      )
      .get(id) as FacilityRow | undefined;

    return row ? mapFacility(row) : null;
  }

  create(input: SaveFacilityInput): Facility {
    const now = new Date().toISOString();
    const nextOrder =
      input.displayOrder ??
      Number(
        (
          this.db
            .prepare('SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM facilities')
            .get() as {
            next_order: number;
          }
        ).next_order
      );

    const result = this.db
      .prepare(
        `
          INSERT INTO facilities (name, display_order, is_active, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?)
        `
      )
      .run(input.name, nextOrder, now, now);

    return this.getById(Number(result.lastInsertRowid))!;
  }

  update(
    input: Required<Pick<SaveFacilityInput, 'id' | 'name'>> &
      Pick<SaveFacilityInput, 'displayOrder'>
  ): Facility {
    const current = this.getById(input.id);
    if (!current) {
      throw new Error('FACILITY_NOT_FOUND');
    }

    this.db
      .prepare(
        `
          UPDATE facilities
          SET name = ?, display_order = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        input.name,
        input.displayOrder ?? current.displayOrder,
        new Date().toISOString(),
        input.id
      );

    return this.getById(input.id)!;
  }

  deactivate(id: number): Facility {
    const current = this.getById(id);
    if (!current) {
      throw new Error('FACILITY_NOT_FOUND');
    }

    this.db
      .prepare('UPDATE facilities SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    return this.getById(id)!;
  }
}
