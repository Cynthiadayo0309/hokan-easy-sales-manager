import type { NursingCategory } from '../../../shared/types/app-api.js';
import type { AppDatabase } from '../connection.js';
import { mapNursingCategory, type NursingCategoryRow } from '../row-mappers.js';

export class NursingCategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): NursingCategory[] {
    return this.db
      .prepare(
        `
          SELECT id, code, name, display_order, is_active
          FROM nursing_categories
          WHERE is_active = 1
          ORDER BY display_order
        `
      )
      .all()
      .map((row) => mapNursingCategory(row as NursingCategoryRow));
  }
}
