import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvironment, readSecret } from './environment';

describe('environment', () => {
  it('prefers a secret file over the direct value', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lorekit-config-'));
    const secretPath = join(directory, 'secret');
    try {
      writeFileSync(secretPath, 'from-file\n', 'utf8');
      expect(
        readSecret('TEST_SECRET', {
          TEST_SECRET: 'direct',
          TEST_SECRET_FILE: secretPath,
        }),
      ).toBe('from-file');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads safe defaults and required secrets', () => {
    const environment = loadEnvironment({
      DATABASE_PASSWORD: 'database-password',
      JWT_SECRET: 'a-secure-jwt-secret-with-more-than-32-bytes',
    });

    expect(environment.port).toBe(3000);
    expect(environment.database.user).toBe('lorekit_api');
    expect(environment.auth.accessTokenTtlSeconds).toBe(900);
    expect(environment.corsOrigins).toEqual(['https://app.lorekit.online']);
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_PASSWORD: 'database-password',
        JWT_SECRET: 'short',
      }),
    ).toThrow('JWT_SECRET must contain at least 32 bytes');
  });

  it('rejects out-of-range numeric settings', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_PASSWORD: 'database-password',
        JWT_SECRET: 'a-secure-jwt-secret-with-more-than-32-bytes',
        PORT: '70000',
      }),
    ).toThrow('PORT must be an integer');
  });
});
