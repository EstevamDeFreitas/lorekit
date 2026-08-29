import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BlobModule } from './blobs/blob.module';
import { BackupModule } from './backups/backup.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SyncModule } from './sync/sync.module';
import { VaultsModule } from './vaults/vaults.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    BlobModule,
    BackupModule,
    AdminModule,
    VaultsModule,
    SyncModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
