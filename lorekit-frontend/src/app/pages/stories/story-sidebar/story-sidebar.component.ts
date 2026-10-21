import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../components/button/button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { StoryClientService } from '../../../services/story-client.service';
import { StoryNavigationService } from '../../../services/story-navigation.service';
import { TabManagerService } from '../../../services/tab-manager.service';

@Component({
  selector: 'app-story-sidebar',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, IconButtonComponent],
  templateUrl: './story-sidebar.component.html',
  styleUrl: './story-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorySidebarComponent {
  readonly panelMode = input(false);
  readonly client = inject(StoryClientService);
  readonly navigation = inject(StoryNavigationService);
  private readonly router = inject(Router);
  private readonly tabs = inject(TabManagerService);
  readonly title = new FormControl('', { nonNullable: true });
  readonly sceneTitle = new FormControl('', { nonNullable: true });
  readonly creating = signal(false);
  readonly creatingScene = signal(false);
  readonly error = signal('');
  readonly sceneError = signal('');
  readonly createOpen = signal(false);
  readonly createSceneStoryId = signal<string | null>(null);
  private operationId = crypto.randomUUID();

  activeStoryId(): string | null {
    return this.navigation.target()?.id ?? this.client.current()?.story.id ?? null;
  }

  activeSceneId(): string | null {
    return this.navigation.target()?.sceneId ?? this.client.scope();
  }

  isCurrentStory(storyId: string): boolean {
    return this.client.current()?.story.id === storyId;
  }

  async create(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    this.error.set('');
    try {
      this.client.requireOnline();
      const story = await this.client.api.create(this.title.value, this.operationId);
      this.operationId = crypto.randomUUID();
      this.title.setValue('');
      this.createOpen.set(false);
      await this.client.refreshList();
      await this.router.navigate(['/stories', story.id]);
      this.closeMobileSidebar();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível criar a História.');
    } finally {
      this.creating.set(false);
    }
  }

  toggleSceneCreate(storyId: string): void {
    const next = this.createSceneStoryId() === storyId ? null : storyId;
    this.createSceneStoryId.set(next);
    this.sceneTitle.setValue('');
    this.sceneError.set('');
  }

  async createScene(storyId: string): Promise<void> {
    if (this.creatingScene()) return;
    this.creatingScene.set(true);
    this.sceneError.set('');
    try {
      this.client.requireOnline();
      if (!this.sceneTitle.value.trim())
        throw new Error('Informe um título para a cena.');
      if (this.client.current()?.story.id !== storyId)
        throw new Error('Aguarde o carregamento da História para criar a cena.');
      const scene = await this.client.api.scene(
        storyId,
        this.sceneTitle.value,
        crypto.randomUUID(),
      );
      await this.client.refreshCurrent();
      this.sceneTitle.setValue('');
      this.createSceneStoryId.set(null);
      this.openScene(storyId, scene.id);
    } catch (error) {
      this.sceneError.set(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a cena.',
      );
    } finally {
      this.creatingScene.set(false);
    }
  }

  openScene(storyId: string, sceneId: string): void {
    const target = this.navigation.target();
    const alreadyOnScene = target?.id === storyId && target.sceneId === sceneId;
    if (
      alreadyOnScene &&
      this.client.current()?.story.id === storyId &&
      this.client.scope() !== sceneId
    )
      void this.client.scene(sceneId);
    void this.router.navigate(['/stories', storyId], {
      queryParams: { scene: sceneId },
    });
    this.closeMobileSidebar();
  }

  closeMobileSidebar(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
      this.tabs.setSidebarVisible(false);
  }
}
