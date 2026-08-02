import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from '../config/environment.service';
import { DatabaseService } from '../database/database.service';
import { BlobModule } from './blob.module';

const environment = {
  values: {
    nodeEnv: 'test',
    corsOrigins: ['https://app.lorekit.online'],
    auth: {
      jwtSecret: 'test-secret-that-is-long-enough-for-a-jwt-signing-key',
      jwtIssuer: 'https://api.lorekit.online',
      jwtAudience: 'lorekit',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
    },
  },
};

@Global()
@Module({
  providers: [
    { provide: DatabaseService, useValue: { db: {} } },
    { provide: EnvironmentService, useValue: environment },
  ],
  exports: [DatabaseService, EnvironmentService],
})
class TestInfrastructureModule {}

describe('BlobModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    await module?.close();
  });

  it('resolves the access-token guard from AuthModule', async () => {
    module = await Test.createTestingModule({
      imports: [TestInfrastructureModule, BlobModule],
    }).compile();

    expect(module).toBeDefined();
  });
});
