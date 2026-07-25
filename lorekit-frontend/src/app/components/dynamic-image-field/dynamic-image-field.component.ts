import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { buildImageUrl } from '../../models/image.model';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import {
  DynamicImageGalleryDialogComponent,
  DynamicImageGalleryDialogData,
} from './dynamic-image-gallery-dialog.component';
import {
  DynamicImageViewerDialogComponent,
  DynamicImageViewerDialogData,
} from './dynamic-image-viewer-dialog.component';
import {
  decodeDynamicImageValue,
  encodeDynamicImageValue,
  resolveDynamicImageAspectRatio,
} from './dynamic-image-field.utils';

@Component({
  selector: 'app-dynamic-image-field',
  imports: [ButtonComponent, IconButtonComponent],
  templateUrl: './dynamic-image-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicImageFieldComponent {
  readonly label = input.required<string>();
  readonly value = input<string>('');
  readonly aspectRatio = input<string | number | undefined>();
  readonly valueChange = output<string>();

  private readonly dialog = inject(Dialog);

  protected readonly activeIndex = signal(0);
  protected readonly images = computed(() => decodeDynamicImageValue(this.value()));
  protected readonly resolvedAspectRatio = computed(() =>
    resolveDynamicImageAspectRatio(this.aspectRatio())
  );
  protected readonly activeImage = computed(() =>
    this.images()[this.activeIndex()] ?? null
  );

  private readonly keepActiveIndexValid = effect(() => {
    const lastIndex = Math.max(0, this.images().length - 1);
    if (this.activeIndex() > lastIndex) {
      this.activeIndex.set(lastIndex);
    }
  });

  protected openGallery(): void {
    const data: DynamicImageGalleryDialogData = {
      title: this.label(),
      imagePaths: this.images(),
      aspectRatio: this.resolvedAspectRatio(),
    };
    const galleryDialog = this.dialog.open<string[]>(
      DynamicImageGalleryDialogComponent,
      {
        data,
        panelClass: 'screen-dialog',
        maxWidth: '95vw',
        maxHeight: '95vh',
      }
    );

    galleryDialog.closed.subscribe(paths => {
      if (paths) {
        this.activeIndex.set(Math.min(this.activeIndex(), Math.max(0, paths.length - 1)));
        this.valueChange.emit(encodeDynamicImageValue(paths));
      }
    });
  }

  protected openImageViewer(): void {
    const image = this.activeImage();
    if (!image) {
      return;
    }

    const data: DynamicImageViewerDialogData = {
      title: this.label(),
      imageUrl: this.imageUrl(image),
    };

    this.dialog.open<void>(DynamicImageViewerDialogComponent, {
      data,
      panelClass: 'bg-transparent',
      maxWidth: '96vw',
      maxHeight: '96vh',
    });
  }

  protected previousImage(event: Event): void {
    event.stopPropagation();
    const count = this.images().length;
    if (count > 1) {
      this.activeIndex.update(index => (index - 1 + count) % count);
    }
  }

  protected nextImage(event: Event): void {
    event.stopPropagation();
    const count = this.images().length;
    if (count > 1) {
      this.activeIndex.update(index => (index + 1) % count);
    }
  }

  protected selectImage(index: number, event: Event): void {
    event.stopPropagation();
    this.activeIndex.set(index);
  }

  protected imageUrl(path: string): string {
    return buildImageUrl(path);
  }
}
