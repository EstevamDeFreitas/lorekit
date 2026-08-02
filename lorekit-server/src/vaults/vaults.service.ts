import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { vaultMembers, vaults } from '../database/schema';

@Injectable()
export class VaultsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string): Promise<Array<{
    id: string;
    name: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    return await this.database.db
      .select({
        id: vaults.id,
        name: vaults.name,
        role: vaultMembers.role,
        createdAt: vaults.createdAt,
        updatedAt: vaults.updatedAt,
      })
      .from(vaultMembers)
      .innerJoin(vaults, eq(vaults.id, vaultMembers.vaultId))
      .where(eq(vaultMembers.userId, userId))
      .orderBy(asc(vaults.createdAt));
  }
}
