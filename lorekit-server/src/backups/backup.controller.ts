import { Controller, Get, Param, ParseUUIDPipe, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { BackupService } from './backup.service';

@ApiTags('Backups')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('vaults/:vaultId/backup')
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  download(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return this.backups.download(vaultId, auth, reply);
  }

  @Put()
  restore(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Req() request: FastifyRequest & { body: Readable },
    @CurrentAuth() auth: AuthenticatedRequest,
  ): Promise<{ vaultId: string }> {
    return this.backups.restore(vaultId, request.body, auth);
  }
}
