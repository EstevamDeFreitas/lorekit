import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlobController } from './blob.controller';
import { BlobService } from './blob.service';

@Module({
  imports: [AuthModule],
  controllers: [BlobController],
  providers: [BlobService],
})
export class BlobModule {}
