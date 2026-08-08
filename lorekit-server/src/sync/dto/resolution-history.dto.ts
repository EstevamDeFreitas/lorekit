import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SYNC_ENTITY_TYPES } from '../sync-contract';

export class ResolutionReportDto {
  @Matches(/^[0-9a-f]{64}$/)
  resolutionKey!: string;

  @IsIn(SYNC_ENTITY_TYPES)
  entityType!: string;

  @IsString()
  @MaxLength(512)
  entityId!: string;

  @IsIn(['upsert', 'delete'])
  winnerOperation!: 'upsert' | 'delete';

  @IsOptional()
  @IsObject()
  winnerPayload?: Record<string, unknown> | null;

  @Matches(/^\d{1,16}$/)
  winnerModifiedAt!: string;

  @Matches(/^[0-9a-f]{32}$/)
  winnerChangeId!: string;

  @IsIn(['upsert', 'delete'])
  loserOperation!: 'upsert' | 'delete';

  @IsOptional()
  @IsObject()
  loserPayload?: Record<string, unknown> | null;

  @Matches(/^\d{1,16}$/)
  loserModifiedAt!: string;

  @Matches(/^[0-9a-f]{32}$/)
  loserChangeId!: string;
}

export class ResolutionReportBatchDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ResolutionReportDto)
  resolutions!: ResolutionReportDto[];
}

export class ResolutionHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
