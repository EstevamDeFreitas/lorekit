import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadDatabaseConfig } from '../config/environment';

async function run(): Promise<void> {
  const config = loadDatabaseConfig(process.env, 'migrator');
  const client = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.user,
    password: config.password,
    ssl: config.ssl ? 'require' : false,
    max: 1,
  });
  const apiRole = process.env['DATABASE_USER']?.trim() || 'lorekit_api';

  try {
    await migrate(drizzle(client), {
      migrationsFolder: process.env['MIGRATIONS_FOLDER'] || './drizzle',
      migrationsSchema: 'app',
      migrationsTable: '__drizzle_migrations',
    });
    await client`GRANT USAGE ON SCHEMA app TO ${client(apiRole)}`;
    await client`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ${client(apiRole)}`;
    await client`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO ${client(apiRole)}`;
    await client`ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${client(apiRole)}`;
    await client`ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO ${client(apiRole)}`;
    await client`REVOKE ALL PRIVILEGES ON TABLE app.__drizzle_migrations FROM ${client(apiRole)}`;
    console.log('Database migrations completed successfully.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

void run().catch((error: unknown) => {
  console.error('Database migration failed.', error);
  process.exitCode = 1;
});
