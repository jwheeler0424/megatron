import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { app } from 'electron';
import fs from 'fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'path';
import * as schema from './schema';

export const getDatabase = (filename: string) => {
  // Wait until Electron app is ready (if used early in app startup, ensure app.whenReady)
  const isProd = app?.isPackaged || false;
  // In production, put DB in resourcesPath; in dev, just use path as-is
  const dbPath = isProd ? join(process.resourcesPath, filename) : filename;

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!fs.existsSync(dir)) execSync('npx drizzle-kit migrate');

  // Open (create) the database
  const client = new PGlite();
  const db = drizzle(client, { schema });

  return db;
};

// Create path to DB file in user data location
const dbFilePath = join(
  app.getAppPath(), // recommended cross-platform location
  'database'
);

// Export singleton instance
export const db = getDatabase(dbFilePath);
export type Database = typeof db;
