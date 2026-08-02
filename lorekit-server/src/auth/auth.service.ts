import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { EnvironmentService } from '../config/environment.service';
import { DatabaseService } from '../database/database.service';
import { auditEvents, devices, refreshSessions, users } from '../database/schema';
import { AuthTokenService } from './auth-token.service';
import { AccessTokenPayload, AuthResponse, AuthenticatedRequest } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type UserRow = typeof users.$inferSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly environment: EnvironmentService,
  ) {}

  async login(input: LoginDto, metadata: RequestMetadata): Promise<AuthResponse> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, this.normalizeEmail(input.email)))
      .limit(1);

    if (!user || !user.isActive || !(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const deviceId = await this.resolveDevice(user.id, input);
    const response = await this.issueSession(user, deviceId, metadata);
    await this.writeAuditEvent(user.id, 'auth.login', 'refresh_session', undefined, metadata);
    return response;
  }

  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<AuthResponse> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const now = new Date();
    const [result] = await this.database.db
      .select({ session: refreshSessions, user: users })
      .from(refreshSessions)
      .innerJoin(users, eq(users.id, refreshSessions.userId))
      .where(
        and(
          eq(refreshSessions.tokenHash, tokenHash),
          isNull(refreshSessions.revokedAt),
          gt(refreshSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (!result || !result.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const replacementSessionId = randomUUID();
    const replacementToken = this.createRefreshToken();
    const replacementHash = this.hashRefreshToken(replacementToken);
    const expiresAt = this.refreshExpiration(now);

    await this.database.db.transaction(async (transaction) => {
      const revoked = await transaction
        .update(refreshSessions)
        .set({
          revokedAt: now,
          lastUsedAt: now,
          replacedBySessionId: replacementSessionId,
        })
        .where(
          and(
            eq(refreshSessions.id, result.session.id),
            isNull(refreshSessions.revokedAt),
          ),
        )
        .returning({ id: refreshSessions.id });

      if (revoked.length !== 1) {
        throw new UnauthorizedException('Refresh token was already used');
      }

      await transaction.insert(refreshSessions).values({
        id: replacementSessionId,
        userId: result.user.id,
        deviceId: result.session.deviceId,
        tokenHash: replacementHash,
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      if (result.session.deviceId) {
        await transaction
          .update(devices)
          .set({ lastSeenAt: now })
          .where(eq(devices.id, result.session.deviceId));
      }
    });

    const accessToken = await this.tokens.sign({
      userId: result.user.id,
      sessionId: replacementSessionId,
      tokenVersion: result.user.tokenVersion,
    });
    await this.writeAuditEvent(
      result.user.id,
      'auth.refresh',
      'refresh_session',
      replacementSessionId,
      metadata,
    );

    return this.buildResponse(
      result.user,
      result.session.deviceId ?? '',
      accessToken,
      replacementToken,
    );
  }

  async authenticate(payload: AccessTokenPayload): Promise<AuthenticatedRequest> {
    const [result] = await this.database.db
      .select({ session: refreshSessions, user: users })
      .from(refreshSessions)
      .innerJoin(users, eq(users.id, refreshSessions.userId))
      .where(
        and(
          eq(refreshSessions.id, payload.sid),
          eq(refreshSessions.userId, payload.sub),
          isNull(refreshSessions.revokedAt),
          gt(refreshSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!result || !result.user.isActive || result.user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return {
      userId: result.user.id,
      sessionId: result.session.id,
      deviceId: result.session.deviceId,
    };
  }

  async logout(auth: AuthenticatedRequest, metadata: RequestMetadata): Promise<void> {
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshSessions.id, auth.sessionId),
          eq(refreshSessions.userId, auth.userId),
          isNull(refreshSessions.revokedAt),
        ),
      );
    await this.writeAuditEvent(
      auth.userId,
      'auth.logout',
      'refresh_session',
      auth.sessionId,
      metadata,
    );
  }

  async revokeAll(auth: AuthenticatedRequest, metadata: RequestMetadata): Promise<void> {
    const now = new Date();
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: now })
        .where(eq(users.id, auth.userId));
      await transaction
        .update(refreshSessions)
        .set({ revokedAt: now })
        .where(
          and(eq(refreshSessions.userId, auth.userId), isNull(refreshSessions.revokedAt)),
        );
    });
    await this.writeAuditEvent(auth.userId, 'auth.revoke_all', 'user', auth.userId, metadata);
  }

  private async issueSession(
    user: UserRow,
    deviceId: string,
    metadata: RequestMetadata,
  ): Promise<AuthResponse> {
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken();
    await this.database.db.insert(refreshSessions).values({
      id: sessionId,
      userId: user.id,
      deviceId,
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: this.refreshExpiration(new Date()),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const accessToken = await this.tokens.sign({
      userId: user.id,
      sessionId,
      tokenVersion: user.tokenVersion,
    });
    return this.buildResponse(user, deviceId, accessToken, refreshToken);
  }

  private async resolveDevice(userId: string, input: LoginDto): Promise<string> {
    const now = new Date();
    if (input.deviceId) {
      const [ownedDevice] = await this.database.db
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(
            eq(devices.id, input.deviceId),
            eq(devices.userId, userId),
            isNull(devices.revokedAt),
          ),
        )
        .limit(1);
      if (ownedDevice) {
        await this.database.db
          .update(devices)
          .set({
            lastSeenAt: now,
            name: input.deviceName || 'Lorekit client',
            platform: input.platform || 'unknown',
            appVersion: input.appVersion,
          })
          .where(eq(devices.id, ownedDevice.id));
        return ownedDevice.id;
      }
    }

    const deviceId = randomUUID();
    await this.database.db.insert(devices).values({
      id: deviceId,
      userId,
      name: input.deviceName || 'Lorekit client',
      platform: input.platform || 'unknown',
      appVersion: input.appVersion,
      lastSeenAt: now,
    });
    return deviceId;
  }

  private buildResponse(
    user: UserRow,
    deviceId: string,
    accessToken: string,
    refreshToken: string,
  ): AuthResponse {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.environment.values.auth.accessTokenTtlSeconds,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      deviceId,
    };
  }

  private createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private refreshExpiration(from: Date): Date {
    const expiresAt = new Date(from);
    expiresAt.setUTCDate(
      expiresAt.getUTCDate() + this.environment.values.auth.refreshTokenTtlDays,
    );
    return expiresAt;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase('en-US');
  }

  private async writeAuditEvent(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string | undefined,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.database.db.insert(auditEvents).values({
      actorUserId,
      action,
      targetType,
      targetId,
      ipAddress: metadata.ipAddress,
      metadata: metadata.userAgent ? { userAgent: metadata.userAgent } : undefined,
    });
  }
}
