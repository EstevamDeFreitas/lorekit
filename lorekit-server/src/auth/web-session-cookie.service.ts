import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EnvironmentService } from '../config/environment.service';

const REFRESH_COOKIE_NAME = 'lorekit_refresh';
const REFRESH_COOKIE_PATH = '/auth';

@Injectable()
export class WebSessionCookieService {
  constructor(private readonly environment: EnvironmentService) {}

  read(request: FastifyRequest): string | null {
    const value = request.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  set(reply: FastifyReply, refreshToken: string): void {
    const ttlDays = this.environment.values.auth.refreshTokenTtlDays;
    reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.environment.values.nodeEnv === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: ttlDays * 24 * 60 * 60,
      expires: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
    });
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.environment.values.nodeEnv === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
  }

  requireAllowedOrigin(request: FastifyRequest): void {
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || !this.environment.values.corsOrigins.includes(origin)) {
      throw new ForbiddenException('Origin is not allowed for cookie authentication');
    }
  }

  requireToken(request: FastifyRequest, bodyToken?: string): {
    token: string;
    fromCookie: boolean;
  } {
    const cookieToken = this.read(request);
    if (cookieToken) {
      this.requireAllowedOrigin(request);
      return { token: cookieToken, fromCookie: true };
    }
    if (bodyToken) return { token: bodyToken, fromCookie: false };
    throw new UnauthorizedException('Refresh token is required');
  }
}
