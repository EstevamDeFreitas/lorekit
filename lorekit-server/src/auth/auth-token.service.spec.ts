import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppEnvironment } from '../config/environment';
import { EnvironmentService } from '../config/environment.service';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  const values: AppEnvironment = {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 3000,
    appVersion: 'test',
    corsOrigins: [],
    database: {
      host: 'localhost',
      port: 5432,
      database: 'lorekit',
      user: 'test',
      password: 'test',
      ssl: false,
      maxConnections: 1,
    },
    auth: {
      jwtSecret: 'test-secret-with-at-least-thirty-two-bytes',
      jwtIssuer: 'lorekit-test',
      jwtAudience: 'lorekit-test-client',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
    },
  };
  const environment = { values } as EnvironmentService;
  const service = new AuthTokenService(new JwtService(), environment);

  it('signs and verifies the expected claims', async () => {
    const token = await service.sign({
      userId: 'user-id',
      sessionId: 'session-id',
      tokenVersion: 3,
    });
    const payload = await service.verify(token);
    expect(payload).toMatchObject({
      sub: 'user-id',
      sid: 'session-id',
      ver: 3,
      typ: 'access',
    });
  });

  it('rejects tokens signed with another key', async () => {
    const foreign = await new JwtService().signAsync(
      { sub: 'user-id', sid: 'session-id', ver: 1, typ: 'access' },
      { secret: 'another-secret-with-at-least-thirty-two-bytes' },
    );
    await expect(service.verify(foreign)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
