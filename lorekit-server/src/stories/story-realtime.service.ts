import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { AuthTokenService } from '../auth/auth-token.service';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
} from '../auth/auth.types';
import { StorySettingsService } from './story-settings.service';
import { contractId } from '../shared/ironpaw';
import { storyContract } from './stories.service';

export interface StoryConnection {
  payload: AccessTokenPayload;
  auth: AuthenticatedRequest;
  installationId: string;
  expiresAt: number;
}
@Injectable()
export class StoryRealtimeService {
  private readonly tickets = new Map<
    string,
    StoryConnection & { ticketExpiresAt: number }
  >();
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokenService,
    private readonly settings: StorySettingsService,
  ) {}

  async ticket(authorization: string, installationId: unknown) {
    this.settings.assertEnabled();
    const installation = storyContract(() => contractId(installationId));
    const token = authorization.trim().split(/\s+/)[1];
    if (!token) throw new UnauthorizedException();
    const payload = await this.tokens.verify(token);
    const auth = await this.auth.authenticate(payload);
    const expiresAt = Number(payload.exp) * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      throw new UnauthorizedException();
    for (const [key, value] of this.tickets)
      if (value.ticketExpiresAt <= Date.now()) this.tickets.delete(key);
    if (this.tickets.size >= 10_000)
      throw new UnauthorizedException(
        'Limite de conexões temporárias atingido.',
      );
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(this.hash(ticket), {
      auth,
      payload,
      installationId: installation,
      expiresAt,
      ticketExpiresAt: Date.now() + 30_000,
    });
    return { ticket, expiresAt: new Date(Date.now() + 30_000).toISOString() };
  }

  async consume(value: unknown): Promise<StoryConnection> {
    this.settings.assertEnabled();
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
      throw new UnauthorizedException();
    const key = this.hash(value),
      ticket = this.tickets.get(key);
    this.tickets.delete(key);
    if (!ticket || ticket.ticketExpiresAt <= Date.now())
      throw new UnauthorizedException('Ticket expirado ou já usado.');
    await this.validate(ticket);
    return ticket;
  }

  async validate(connection: StoryConnection): Promise<void> {
    if (connection.expiresAt <= Date.now())
      throw new UnauthorizedException('Reconecte para renovar a sessão.');
    await this.auth.authenticate(connection.payload);
  }
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
