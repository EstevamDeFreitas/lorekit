import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { PullSyncQueryDto } from './dto/pull-sync-query.dto';
import { PushSyncDto } from './dto/push-sync.dto';
import { ResolutionHistoryQueryDto, ResolutionReportBatchDto } from './dto/resolution-history.dto';
import { SnapshotSyncQueryDto } from './dto/snapshot-sync-query.dto';
import { SyncService } from './sync.service';

@ApiTags('Synchronization')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('sync/capabilities')
  capabilities() {
    return this.sync.capabilities();
  }

  @Get('vaults/:vaultId/sync/status')
  status(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.sync.status(vaultId, auth);
  }

  @Get('vaults/:vaultId/sync/changes')
  @ApiOkResponse({ description: 'Ordered changes after the supplied cursor.' })
  changes(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Query() query: PullSyncQueryDto,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.sync.changes(vaultId, query, auth);
  }

  @Get('vaults/:vaultId/sync/snapshot')
  snapshot(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Query() query: SnapshotSyncQueryDto,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.sync.snapshot(vaultId, query, auth);
  }

  @Post('vaults/:vaultId/sync/push')
  @ApiOkResponse({ description: 'Per-operation applied, superseded or legacy conflict results.' })
  push(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Body() input: PushSyncDto,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.sync.push(vaultId, input, auth);
  }

  @Get('vaults/:vaultId/sync/resolutions')
  resolutions(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Query() query: ResolutionHistoryQueryDto,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.sync.resolutions(vaultId, query, auth);
  }

  @Post('vaults/:vaultId/sync/resolutions')
  reportResolutions(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Body() input: ResolutionReportBatchDto,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.sync.reportResolutions(vaultId, input, auth);
  }
}
