import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['app'],
  dbCredentials: {
    url: process.env['MIGRATION_DATABASE_URL'] ??
      'postgresql://lorekit_migrator:unused@localhost:5432/lorekit',
  },
  strict: true,
  verbose: true,
});
