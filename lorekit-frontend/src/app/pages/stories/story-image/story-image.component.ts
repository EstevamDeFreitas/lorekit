import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { StoryClientService } from '../../../services/story-client.service';

@Component({
  selector: 'story-image',
  templateUrl: './story-image.component.html',
  styleUrl: './story-image.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryImageComponent {
  readonly storyId = input.required<string>();
  readonly assetId = input.required<string>();
  readonly description = input('Imagem da cena');
  readonly avatar = input(false);
  readonly url = signal<string | null>(null);
  readonly visible = signal(false);
  private readonly client = inject(StoryClientService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  private readonly viewer = viewChild<ElementRef<HTMLDialogElement>>('viewer');
  constructor() {
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          this.visible.set(entries.some((entry) => entry.isIntersecting));
        },
        { rootMargin: '200px' },
      );
      observer.observe(this.host.nativeElement);
      this.destroy.onDestroy(() => observer.disconnect());
    });
    effect((onCleanup) => {
      const visible = this.visible(),
        storyId = this.storyId(),
        assetId = this.assetId();
      this.client.status();
      let active = true;
      const release = visible
        ? this.client.retainImage(storyId, assetId)
        : () => {};
      onCleanup(() => {
        active = false;
        release();
      });
      if (!visible) this.url.set(null);
      if (visible)
        void this.client.imageUrl(storyId, assetId).then((url) => {
          if (
            active &&
            storyId === this.storyId() &&
            assetId === this.assetId()
          )
            this.url.set(url);
        });
    });
  }
  open(): void {
    this.viewer()?.nativeElement.showModal();
  }
  close(): void {
    this.viewer()?.nativeElement.close();
  }
  backdrop(event: MouseEvent): void {
    if (event.target === this.viewer()?.nativeElement) this.close();
  }
}
