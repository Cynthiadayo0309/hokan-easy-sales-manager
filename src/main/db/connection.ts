import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { runMigrations } from './migrations.js';
import { seedInitialData } from './seeds/initial-data.js';

export type AppDatabase = SqliteDatabase;

export function getApplicationDbPath(userDataPath: string): string {
  return join(userDataPath, 'data', 'application.db');
}

export function openDatabase(dbPath: string): AppDatabase {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  return db;
}

export function initializeDatabase(dbPath: string): AppDatabase {
  const db = openDatabase(dbPath);
  runMigrations(db);
  seedInitialData(db);
  return db;
}

export class DatabaseManager {
  private db: AppDatabase;

  constructor(private readonly dbPath: string) {
    this.db = initializeDatabase(dbPath);
  }

  getDb(): AppDatabase {
    return this.db;
  }

  getDbPath(): string {
    return this.dbPath;
  }

  async backupTo(destinationPath: string): Promise<void> {
    mkdirSync(dirname(destinationPath), { recursive: true });
    await this.db.backup(destinationPath);
  }

  replaceWith(sourcePath: string): void {
    const currentDb = this.db;
    currentDb.close();

    try {
      copyFileSync(sourcePath, this.dbPath);
      this.db = initializeDatabase(this.dbPath);
    } catch (error) {
      this.db = initializeDatabase(this.dbPath);
      throw error;
    }
  }
}
