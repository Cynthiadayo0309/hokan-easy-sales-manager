import { dialog } from 'electron';
import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { BackupResult, RestoreResult } from '../../shared/types/app-api.js';
import { DatabaseManager, openDatabase, type AppDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrations.js';
import { seedInitialData } from '../db/seeds/initial-data.js';

export class BackupService {
  constructor(
    private readonly dbManager: DatabaseManager,
    private readonly userDataPath: string
  ) {}

  async create(): Promise<BackupResult> {
    const result = await dialog.showSaveDialog({
      title: 'バックアップを保存',
      defaultPath: `hokan-backup-${timestamp()}.db`,
      filters: [{ name: 'SQLite DB', extensions: ['db'] }]
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, fileName: null, message: 'バックアップ作成をキャンセルしました。' };
    }

    await this.createToPath(result.filePath);
    return {
      ok: true,
      fileName: basename(result.filePath),
      message: 'バックアップを作成しました。'
    };
  }

  async restore(): Promise<RestoreResult> {
    const result = await dialog.showOpenDialog({
      title: 'バックアップから復元',
      properties: ['openFile'],
      filters: [{ name: 'SQLite DB', extensions: ['db'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        ok: false,
        backupFileName: null,
        restoredFileName: null,
        message: '復元をキャンセルしました。'
      };
    }

    return this.restoreFromPath(result.filePaths[0]);
  }

  async createToPath(destinationPath: string): Promise<void> {
    await this.dbManager.backupTo(destinationPath);
  }

  async restoreFromPath(sourcePath: string): Promise<RestoreResult> {
    const restoreDir = join(this.userDataPath, 'restore-work');
    const backupsDir = join(this.userDataPath, 'backups');
    mkdirSync(restoreDir, { recursive: true });
    mkdirSync(backupsDir, { recursive: true });

    const checkedPath = join(restoreDir, `checked-${timestamp()}.db`);
    const autoBackupPath = join(backupsDir, `auto-before-restore-${timestamp()}.db`);

    copyFileSync(sourcePath, checkedPath);
    validateBackupDatabase(checkedPath);
    await this.dbManager.backupTo(autoBackupPath);
    this.dbManager.replaceWith(checkedPath);

    return {
      ok: true,
      backupFileName: basename(autoBackupPath),
      restoredFileName: basename(sourcePath),
      message: 'バックアップから復元しました。表示を更新しました。'
    };
  }
}

export function validateBackupDatabase(dbPath: string): void {
  const db = openDatabase(dbPath);

  try {
    const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (integrity.integrity_check !== 'ok') {
      throw new Error('BACKUP_INTEGRITY_INVALID');
    }

    runMigrations(db);
    seedInitialData(db);
  } finally {
    closeQuietly(db);
  }
}

function closeQuietly(db: AppDatabase): void {
  try {
    db.close();
  } catch {
    // Nothing useful to do after validation failure; the caller keeps the current DB.
  }
}

function timestamp(): string {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ];

  return `${parts.slice(0, 3).join('')}-${parts.slice(3).join('')}`;
}
