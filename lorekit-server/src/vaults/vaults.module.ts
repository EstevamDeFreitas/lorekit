import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VaultsController } from './vaults.controller';
import { VaultsService } from './vaults.service';

@Module({
  imports: [AuthModule],
  controllers: [VaultsController],
  providers: [VaultsService],
})
export class VaultsModule {}
