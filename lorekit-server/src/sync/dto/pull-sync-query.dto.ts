import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { SYNC_PULL_LIMIT } from '../sync-contract';

export class PullSyncQueryDto {
  @IsOptional()
  @Matches(/^\d+$/)
  after = '0';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SYNC_PULL_LIMIT)
  limit = SYNC_PULL_LIMIT;
}
