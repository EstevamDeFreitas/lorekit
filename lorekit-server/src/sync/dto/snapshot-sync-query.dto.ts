import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { SYNC_PULL_LIMIT } from '../sync-contract';

export class SnapshotSyncQueryDto {
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,2048}$/)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SYNC_PULL_LIMIT)
  limit = SYNC_PULL_LIMIT;
}
