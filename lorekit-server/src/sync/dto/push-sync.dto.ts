import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SYNC_ENTITY_TYPES, SYNC_PUSH_LIMIT } from '../sync-contract';

export class SyncOperationDto {
  @IsUUID()
  operationId!: string;

  @IsIn(SYNC_ENTITY_TYPES)
  entityType!: string;

  @IsString()
  @MaxLength(512)
  entityId!: string;

  @IsIn(['upsert', 'delete'])
  operation!: 'upsert' | 'delete';

  @IsOptional()
  @Matches(/^\d+$/)
  baseVersion?: string | null;

  @IsInt()
  @Min(1)
  @Max(1)
  schemaVersion!: number;

  @IsOptional()
  @Matches(/^\d{1,16}$/)
  modifiedAt?: string;

  @IsOptional()
  @Matches(/^[0-9a-f]{32}$/)
  changeId?: string;

  @ValidateIf(operation => operation.operation === 'upsert')
  @IsObject()
  payload?: Record<string, unknown>;
}

export class PushSyncDto {
  @IsOptional()
  @IsIn([1, 2])
  protocolVersion = 1;

  @IsArray()
  @ArrayMaxSize(SYNC_PUSH_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];
}
