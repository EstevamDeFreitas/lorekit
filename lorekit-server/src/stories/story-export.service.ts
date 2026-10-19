import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, lte } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { storyMessages, storyScenes, stories } from '../database/schema';
import { escapeMarkdown, messageMarkdown } from '../shared/ironpaw';
import { StoriesService } from './stories.service';
import { StorySettingsService } from './story-settings.service';

@Injectable()
export class StoryExportService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: StoriesService,
    private readonly settings: StorySettingsService,
  ) {}

  async *generate(storyId: string, userId: string): AsyncGenerator<string> {
    await this.access.member(storyId, userId);
    const snapshot = await this.database.db.transaction(
      async (tx) => {
        const [story] = await tx
          .select()
          .from(stories)
          .where(eq(stories.id, storyId));
        const scenes = await tx
          .select()
          .from(storyScenes)
          .where(eq(storyScenes.storyId, storyId))
          .orderBy(asc(storyScenes.position));
        return { story: story!, scenes };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    yield `# ${escapeMarkdown(snapshot.story.title)}\n\nRecorte confirmado: ${snapshot.story.sequence}\n\nAs imagens exigem conexão e acesso à História no Lorekit.\n\n`;
    for (const scene of snapshot.scenes) {
      yield `## ${escapeMarkdown(scene.title)}\n\n`;
      let after = 0n;
      while (true) {
        await this.access.member(storyId, userId);
        const page = await this.database.db
          .select({ id: storyMessages.id, sequence: storyMessages.sequence })
          .from(storyMessages)
          .where(
            and(
              eq(storyMessages.storyId, storyId),
              eq(storyMessages.sceneId, scene.id),
              gt(storyMessages.sequence, after),
              lte(storyMessages.sequence, snapshot.story.sequence),
            ),
          )
          .orderBy(asc(storyMessages.sequence))
          .limit(100);
        if (!page.length) break;
        for (const message of await this.access.messagesFrom(
          this.database.db,
          storyId,
          page.map((entry) => entry.id),
        )) {
          yield messageMarkdown(
            message,
            (assetId) =>
              `${this.settings.webOrigin}/#/stories/${storyId}/assets/${assetId}`,
          );
        }
        after = page.at(-1)!.sequence;
      }
    }
  }
}
