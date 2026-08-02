import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { PasswordService } from '../auth/password.service';
import { DatabaseService } from '../database/database.service';
import { auditEvents, refreshSessions, users, vaultMembers, vaults } from '../database/schema';

type CreateUserInput = {
  email: string;
  password: string;
  displayName?: string;
  vaultName?: string;
};

type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  createdAt: Date;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly passwords: PasswordService,
  ) {}

  async createUser(input: CreateUserInput): Promise<PublicUser & { vaultId: string }> {
    const email = input.email.trim();
    const emailNormalized = this.normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(emailNormalized) || emailNormalized.length > 320) {
      throw new Error('A valid email address is required');
    }
    this.passwords.assertAcceptableNewPassword(input.password);
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.database.db.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            email,
            emailNormalized,
            passwordHash,
            displayName: input.displayName?.trim() || null,
          })
          .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            isActive: users.isActive,
            createdAt: users.createdAt,
          });
        if (!user) throw new Error('User creation did not return a record');

        const [vault] = await transaction
          .insert(vaults)
          .values({
            ownerUserId: user.id,
            name: input.vaultName?.trim() || 'Minha biblioteca Lorekit',
          })
          .returning({ id: vaults.id });
        if (!vault) throw new Error('Vault creation did not return a record');

        await transaction.insert(vaultMembers).values({
          vaultId: vault.id,
          userId: user.id,
          role: 'owner',
        });
        await transaction.insert(auditEvents).values({
          actorUserId: user.id,
          action: 'admin.user_created',
          targetType: 'user',
          targetId: user.id,
          metadata: { source: 'admin-cli' },
        });

        return { ...user, vaultId: vault.id };
      });
    } catch (error: unknown) {
      if (this.postgresErrorCode(error) === '23505') {
        throw new Error('A user with this email already exists');
      }
      throw error;
    }
  }

  async listUsers(): Promise<PublicUser[]> {
    return this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.emailNormalized));
  }

  async setUserActive(email: string, isActive: boolean): Promise<PublicUser> {
    const now = new Date();
    const emailNormalized = this.normalizeEmail(email);
    return this.database.db.transaction(async (transaction) => {
      const [user] = await transaction
        .update(users)
        .set({
          isActive,
          disabledAt: isActive ? null : now,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: now,
        })
        .where(eq(users.emailNormalized, emailNormalized))
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          isActive: users.isActive,
          createdAt: users.createdAt,
        });
      if (!user) throw new Error('User not found');

      await transaction
        .update(refreshSessions)
        .set({ revokedAt: now })
        .where(
          and(eq(refreshSessions.userId, user.id), isNull(refreshSessions.revokedAt)),
        );
      await transaction.insert(auditEvents).values({
        actorUserId: user.id,
        action: isActive ? 'admin.user_enabled' : 'admin.user_disabled',
        targetType: 'user',
        targetId: user.id,
        metadata: { source: 'admin-cli' },
      });
      return user;
    });
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    this.passwords.assertAcceptableNewPassword(newPassword);
    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    await this.database.db.transaction(async (transaction) => {
      const [user] = await transaction
        .update(users)
        .set({
          passwordHash,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: now,
        })
        .where(eq(users.emailNormalized, this.normalizeEmail(email)))
        .returning({ id: users.id });
      if (!user) throw new Error('User not found');

      await transaction
        .update(refreshSessions)
        .set({ revokedAt: now })
        .where(and(eq(refreshSessions.userId, user.id), isNull(refreshSessions.revokedAt)));
      await transaction.insert(auditEvents).values({
        actorUserId: user.id,
        action: 'admin.password_reset',
        targetType: 'user',
        targetId: user.id,
        metadata: { source: 'admin-cli' },
      });
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase('en-US');
  }

  private postgresErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    return typeof error.code === 'string' ? error.code : undefined;
  }
}
