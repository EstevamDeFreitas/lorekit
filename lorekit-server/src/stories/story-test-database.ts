import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as schema from '../database/schema';
import type { DatabaseService } from '../database/database.service';

/** Isolated PostgreSQL engine for integration tests. Never connects to production. */
export async function createStoryTestDatabase(
  beforeStoryMigration?: (database: PGlite) => Promise<void>,
) {
  const postgres = new PGlite();
  const folder = join(__dirname, '../../drizzle');
  try {
    for (const file of (await readdir(folder))
      .filter((file) => file.endsWith('.sql'))
      .sort()) {
      if (file.startsWith('0002') && beforeStoryMigration)
        await beforeStoryMigration(postgres);
      await postgres.exec(await readFile(join(folder, file), 'utf8'));
    }
  } catch (error) {
    await postgres.close();
    throw error;
  }
  return {
    postgres,
    db: drizzle(postgres, { schema }) as unknown as DatabaseService['db'],
  };
}
