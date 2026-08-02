import { readFileSync } from 'node:fs';

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
};

export type AppEnvironment = {
  nodeEnv: string;
  host: string;
  port: number;
  appVersion: string;
  corsOrigins: string[];
  database: DatabaseConfig;
  auth: {
    jwtSecret: string;
    jwtIssuer: string;
    jwtAudience: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
  };
};

type EnvironmentSource = NodeJS.ProcessEnv;

export function readSecret(
  name: string,
  source: EnvironmentSource = process.env,
  required = true,
): string | undefined {
  const filePath = source[`${name}_FILE`]?.trim();
  if (filePath) {
    const value = readFileSync(filePath, 'utf8').trim();
    if (value) return value;
  }

  const directValue = source[name]?.trim();
  if (directValue) return directValue;

  if (required) {
    throw new Error(`Missing required secret: ${name} or ${name}_FILE`);
  }

  return undefined;
}

function integerFromEnvironment(
  name: string,
  fallback: number,
  source: EnvironmentSource,
  minimum: number,
  maximum: number,
): number {
  const raw = source[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function booleanFromEnvironment(
  name: string,
  fallback: boolean,
  source: EnvironmentSource,
): boolean {
  const raw = source[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${name} must be true, false, 1, or 0`);
}

export function loadDatabaseConfig(
  source: EnvironmentSource = process.env,
  role: 'api' | 'migrator' = 'api',
): DatabaseConfig {
  const isMigrator = role === 'migrator';
  const passwordName = isMigrator
    ? 'DATABASE_MIGRATOR_PASSWORD'
    : 'DATABASE_PASSWORD';

  return {
    host: source['DATABASE_HOST']?.trim() || 'postgres',
    port: integerFromEnvironment('DATABASE_PORT', 5432, source, 1, 65535),
    database: source['DATABASE_NAME']?.trim() || 'lorekit',
    user: source[isMigrator ? 'DATABASE_MIGRATOR_USER' : 'DATABASE_USER']?.trim() ||
      (isMigrator ? 'lorekit_migrator' : 'lorekit_api'),
    password: readSecret(passwordName, source)!,
    ssl: booleanFromEnvironment('DATABASE_SSL', false, source),
    maxConnections: integerFromEnvironment(
      'DATABASE_MAX_CONNECTIONS',
      isMigrator ? 1 : 10,
      source,
      1,
      40,
    ),
  };
}

export function loadEnvironment(source: EnvironmentSource = process.env): AppEnvironment {
  const jwtSecret = readSecret('JWT_SECRET', source)!;
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes');
  }

  const corsOrigins = (source['CORS_ORIGINS'] ?? 'https://app.lorekit.online')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv: source['NODE_ENV']?.trim() || 'development',
    host: source['HOST']?.trim() || '0.0.0.0',
    port: integerFromEnvironment('PORT', 3000, source, 1, 65535),
    appVersion: source['APP_VERSION']?.trim() || 'dev',
    corsOrigins,
    database: loadDatabaseConfig(source),
    auth: {
      jwtSecret,
      jwtIssuer: source['JWT_ISSUER']?.trim() || 'https://api.lorekit.online',
      jwtAudience: source['JWT_AUDIENCE']?.trim() || 'lorekit',
      accessTokenTtlSeconds: integerFromEnvironment(
        'ACCESS_TOKEN_TTL_SECONDS',
        900,
        source,
        60,
        3600,
      ),
      refreshTokenTtlDays: integerFromEnvironment(
        'REFRESH_TOKEN_TTL_DAYS',
        30,
        source,
        1,
        365,
      ),
    },
  };
}
