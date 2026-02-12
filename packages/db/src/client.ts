/**
 * @chatbot/db — Database client (SQLite-backed for Phase 2)
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { logger } from '@chatbot/utils';

export interface DatabaseClient {
  db: Database.Database;
  close(): void;
}

let instance: DatabaseClient | null = null;

/**
 * Resolve the path to the SQLite database file.
 * Uses APP_DATA_DIR env or defaults to <cwd>/data.
 */
function resolveDbPath(): string {
  const baseDir = process.env.APP_DATA_DIR
    ? resolve(process.env.APP_DATA_DIR)
    : resolve(process.cwd(), 'data');
  return join(baseDir, 'worldmirror.db');
}

/**
 * Run numbered SQL migration files from a directory.
 */
export function runMigrations(db: Database.Database, migrationsDir: string): void {
  if (!existsSync(migrationsDir)) {
    logger.warn('Migrations directory not found, skipping', { migrationsDir });
    return;
  }

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    logger.info(`Applying migration: ${file}`);
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  }
}

/**
 * Create or return the singleton database client.
 * Optionally accepts a path override (useful for testing).
 */
export function createDatabase(dbPath?: string): DatabaseClient {
  if (instance) return instance;

  const path = dbPath ?? resolveDbPath();
  const db = new Database(path);

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  instance = { db, close: () => db.close() };
  logger.info('Database initialized', { path });

  return instance;
}

/**
 * Get the existing database client.
 */
export function getDatabase(): DatabaseClient {
  if (!instance) {
    throw new Error('Database not initialized. Call createDatabase() first.');
  }
  return instance;
}

/**
 * Reset the database — drops all user tables and re-runs migrations.
 * Used in tests for isolation.
 */
export function resetDatabase(): void {
  if (instance) {
    try {
      instance.db.close();
    } catch {
      // Ignore if already closed
    }
  }
  instance = null;
}

/**
 * Create an in-memory database for testing.
 */
export function createTestDatabase(migrationsDir: string): DatabaseClient {
  resetDatabase();
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  instance = { db, close: () => db.close() };

  runMigrations(db, migrationsDir);

  return instance;
}
