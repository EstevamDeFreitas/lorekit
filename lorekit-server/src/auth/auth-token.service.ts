import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentService } from '../config/environment.service';
import { AccessTokenPayload } from './auth.types';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly environment: EnvironmentService,
  ) {}

  async sign(input: {
    userId: string;
    sessionId: string;
    tokenVersion: number;
  }): Promise<string> {
    const config = this.environment.values.auth;
    const payload: AccessTokenPayload = {
      sub: input.userId,
      sid: input.sessionId,
      ver: input.tokenVersion,
      typ: 'access',
    };

    return this.jwt.signAsync(payload, {
      secret: config.jwtSecret,
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: config.accessTokenTtlSeconds,
    });
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    const config = this.environment.values.auth;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: config.jwtSecret,
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      });

      if (
        payload.typ !== 'access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.ver !== 'number'
      ) {
        throw new UnauthorizedException('Invalid access token');
      }

      return payload;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
