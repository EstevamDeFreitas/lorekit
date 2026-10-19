import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { StoryAssetsService } from './story-assets.service';
import { StoryExportService } from './story-export.service';
import { StorySettingsService } from './story-settings.service';
import { StoryRealtimeService } from './story-realtime.service';
import { StoryGateway } from './story.gateway';
import { StoryPushService } from './story-push.service';

@Module({
  imports: [AuthModule],
  controllers: [StoriesController],
  providers: [
    StoriesService,
    StoryAssetsService,
    StoryExportService,
    StorySettingsService,
    StoryRealtimeService,
    StoryGateway,
    StoryPushService,
  ],
  exports: [StoriesService, StoryAssetsService, StorySettingsService],
})
export class StoriesModule {}
