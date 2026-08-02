import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { BlobService } from './blob.service';

@ApiTags('Blobs')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('vaults/:vaultId/blobs')
export class BlobController {
  constructor(private readonly blobs: BlobService) {}

  @Put(':blobId')
  put(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('blobId', ParseUUIDPipe) blobId: string,
    @Body() body: Buffer,
    @Headers('content-type') mimeType: string,
    @Headers('x-content-sha256') sha256: string,
    @Headers('x-original-name') originalName: string | undefined,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.blobs.put(vaultId, blobId, body, mimeType, sha256, originalName ?? blobId, auth);
  }

  @Get(':blobId')
  async get(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('blobId', ParseUUIDPipe) blobId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { metadata, body } = await this.blobs.get(vaultId, blobId, auth);
    reply
      .header('content-type', metadata.mimeType)
      .header('content-length', metadata.sizeBytes.toString())
      .header('etag', `"${metadata.sha256}"`)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .send(body);
  }

  @Head(':blobId')
  async head(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('blobId', ParseUUIDPipe) blobId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const metadata = await this.blobs.head(vaultId, blobId, auth);
    reply
      .header('content-type', metadata.mimeType)
      .header('content-length', metadata.sizeBytes.toString())
      .header('etag', `"${metadata.sha256}"`)
      .send();
  }

  @Delete(':blobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('blobId', ParseUUIDPipe) blobId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ): Promise<void> {
    return this.blobs.delete(vaultId, blobId, auth);
  }
}
