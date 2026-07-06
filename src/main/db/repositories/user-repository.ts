import type { AppDatabase } from '../connection.js';

export class UserRepository {
  constructor(private readonly db: AppDatabase) {}

  getInitialAdminId(): number {
    const row = this.db
      .prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1")
      .get() as { id: number } | undefined;

    if (!row) {
      throw new Error('ADMIN_USER_NOT_FOUND');
    }

    return row.id;
  }
}
