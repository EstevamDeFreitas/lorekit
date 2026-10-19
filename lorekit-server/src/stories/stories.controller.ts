import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { StoriesService } from './stories.service';
import { StoryAssetsService } from './story-assets.service';
import { StoryExportService } from './story-export.service';
import { StorySettingsService } from './story-settings.service';
import { StoryRealtimeService } from './story-realtime.service';
import { StoryPushService } from './story-push.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Stories')
@ApiBearerAuth()
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@UseGuards(AccessTokenGuard)
@Controller()
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly assets: StoryAssetsService,
    private readonly exporter: StoryExportService,
    private readonly settings: StorySettingsService,
    private readonly realtime: StoryRealtimeService,
    private readonly push: StoryPushService,
  ) {}
  @Post('story-push-subscriptions') registerPush(
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.push.register(auth, body);
  }
  @Delete('story-push-subscriptions/:installationId') removePush(
    @CurrentAuth() auth: AuthenticatedRequest,
    @Param('installationId', ParseUUIDPipe) installationId: string,
  ) {
    return this.push.unregister(auth, installationId);
  }
  @Post('story-alerts/:eventId/presented') presented(
    @CurrentAuth() auth: AuthenticatedRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body('installationId') installationId: unknown,
  ) {
    return this.push.presented(auth, eventId, installationId);
  }
  @Post('stories/realtime-ticket') ticket(
    @Headers('authorization') authorization: string,
    @Body('installationId') installationId: unknown,
  ) {
    return this.realtime.ticket(authorization, installationId);
  }
  @Get('stories/capabilities') capabilities() {
    return {
      version: 1,
      enabled: this.settings.enabled,
      push: Boolean(
        this.settings.vapidPublicKey && this.settings.vapidPrivateKey,
      ),
      vapidPublicKey: this.settings.vapidPublicKey ?? null,
    };
  }
  @Get('stories') list(@CurrentAuth() auth: AuthenticatedRequest) {
    return this.stories.list(auth.userId);
  }
  @Post('stories') create(
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.create(body, auth.userId);
  }
  @Post('story-invites/accept') accept(
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body('token') token: unknown,
  ) {
    return this.stories.acceptInvite(token, auth.userId);
  }
  @Get('stories/:id') detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.detail(id, auth.userId);
  }
  @Post('stories/:id/scenes') scene(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.scene(id, auth.userId, body);
  }
  @Patch('stories/:id/scenes/:sceneId') rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.scene(id, auth.userId, body, sceneId);
  }
  @Post('stories/:id/speakers') speaker(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.speaker(id, auth.userId, body);
  }
  @Patch('stories/:id/speakers/:speakerId') revise(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('speakerId', ParseUUIDPipe) speakerId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.speaker(id, auth.userId, body, speakerId);
  }
  @Post('stories/:id/messages') send(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.send(id, auth.userId, body);
  }
  @Get('stories/:id/messages') messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Query('after') after?: string,
    @Query('through') through?: string,
  ) {
    return this.stories.messages(id, auth.userId, after, through);
  }
  @Get('stories/:id/window') window(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Query('before') before?: string,
    @Query('through') through?: string,
    @Query('sceneId') sceneId?: string,
  ) {
    return this.stories.window(id, auth.userId, before, through, sceneId);
  }
  @Get('stories/:id/events') events(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Query('after') after?: string,
  ) {
    return this.stories.events(id, auth.userId, after);
  }
  @Get('stories/:id/operations/:operationId') operation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.operationResult(id, auth.userId, operationId);
  }
  @Post('stories/:id/rolls') roll(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.roll(id, auth.userId, body);
  }
  @Get('stories/:id/members') members(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.members(id, auth.userId);
  }
  @Post('stories/:id/read-position') read(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.markRead(id, auth.userId, body);
  }
  @Put('stories/:id/notification-preferences') preferences(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.stories.preferences(id, auth.userId, body);
  }
  @Post('stories/:id/invites') invite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.invite(id, auth.userId);
  }
  @Get('stories/:id/invites') invites(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.invites(id, auth.userId);
  }
  @Delete('stories/:id/invites/:inviteId') cancelInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.cancelInvite(id, auth.userId, inviteId);
  }
  @Delete('stories/:id/members/:userId') remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.removeMember(id, auth.userId, userId);
  }
  @Post('stories/:id/leave') leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
  ) {
    return this.stories.removeMember(id, auth.userId, auth.userId);
  }
  @Post('stories/:id/assets') reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.assets.reserve(id, auth.userId, body);
  }
  @Put('stories/:id/assets/:assetId') upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('content-type') mime: string,
  ) {
    return this.assets.upload(id, auth.userId, assetId, body, mime);
  }
  @Get('stories/:id/assets/:assetId') async asset(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    const { metadata, bytes } = await this.assets.get(id, auth.userId, assetId);
    return reply
      .header('content-type', metadata.mimeType)
      .header('cache-control', 'private, no-store')
      .header('x-content-type-options', 'nosniff')
      .send(bytes);
  }
  @Get('stories/:id/export.md') async export(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.stories.member(id, auth.userId);
    return reply
      .header('content-type', 'text/markdown; charset=utf-8')
      .header('content-disposition', `attachment; filename="story-${id}.md"`)
      .header('cache-control', 'private, no-store')
      .send(Readable.from(this.exporter.generate(id, auth.userId)));
  }
}
