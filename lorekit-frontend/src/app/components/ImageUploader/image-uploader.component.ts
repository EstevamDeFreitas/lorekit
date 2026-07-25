import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Image } from '../../models/image.model';
import { ImageService } from '../../services/image.service';
import {
  ImageCropDialogComponent,
  ImageCropDialogData,
} from '../image-crop-dialog/image-crop-dialog.component';

interface ImageUploaderData {
  entityTable: string;
  entityId: string;
  usageKey: string;
  aspectRatio?: number;
  initialFile?: File;
}

@Component({
  selector: 'app-image-uploader',
  imports: [],
  templateUrl: './image-uploader.component.html',
  styleUrl: './image-uploader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUploaderComponent implements OnInit {
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly data = inject<ImageUploaderData>(DIALOG_DATA);
  private readonly dialog = inject(Dialog);
  private readonly imageService = inject(ImageService);

  protected readonly images = signal<Image[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isFileOver = signal(false);
  protected readonly errorMessage = signal('');

  private readonly entityTable = this.data.entityTable ?? '';
  private readonly entityId = this.data.entityId ?? '';
  private readonly usageKey = this.data.usageKey ?? 'default';
  private readonly aspectRatio =
    Number.isFinite(this.data.aspectRatio) && (this.data.aspectRatio ?? 0) > 0
      ? this.data.aspectRatio!
      : 10 / 1;

  ngOnInit(): void {
    if (this.entityTable && this.entityId) {
      this.loadImages();
    }

    if (this.data.initialFile?.type.startsWith('image/')) {
      queueMicrotask(() => this.openCropper(this.data.initialFile!));
    }
  }

  protected selectFile(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file?.type.startsWith('image/')) {
      this.openCropper(file);
    }
  }

  protected allowFileDrop(event: DragEvent): void {
    if (!this.hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isFileOver.set(true);
  }

  protected leaveFileDrop(event: DragEvent): void {
    const container = event.currentTarget as Node;
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) {
      return;
    }
    this.isFileOver.set(false);
  }

  protected dropFile(event: DragEvent): void {
    event.preventDefault();
    this.isFileOver.set(false);
    const file = this.getImageFile(event.dataTransfer);
    if (file) {
      this.openCropper(file);
    }
  }

  protected async deleteImage(id: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.imageService.deleteImage(id);
      this.images.update(images => images.filter(image => image.id !== id));
    } catch {
      this.errorMessage.set('Não foi possível excluir a imagem.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private loadImages(): void {
    this.images.set(
      this.imageService.getImages(this.entityTable, this.entityId, this.usageKey)
    );
  }

  private openCropper(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      const cropData: ImageCropDialogData = {
        imageSrc: reader.result,
        aspectRatio: this.aspectRatio,
        imageType: file.type,
      };
      const cropDialog = this.dialog.open<Blob>(ImageCropDialogComponent, {
        data: cropData,
        width: 'min(95vw, 900px)',
        maxWidth: '95vw',
        maxHeight: '95vh',
        panelClass: 'bg-transparent',
      });

      cropDialog.closed.subscribe(blob => {
        if (blob) {
          void this.uploadCroppedImage(blob);
        }
      });
    };
    reader.onerror = () => this.errorMessage.set('Não foi possível ler esta imagem.');
    reader.readAsDataURL(file);
  }

  private async uploadCroppedImage(blob: Blob): Promise<void> {
    const extension = blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : 'jpg';
    const file = new File([blob], `cropped-image.${extension}`, { type: blob.type });
    const previousImage = this.images()[0];

    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const image = await this.imageService.uploadImage(
        file,
        this.entityTable,
        this.entityId,
        this.usageKey
      );
      if (previousImage) {
        await this.imageService.deleteImage(previousImage.id);
      }
      this.images.set([image]);
      this.dialogRef.close();
    } catch {
      this.errorMessage.set('Não foi possível salvar a imagem.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private hasImageFile(dataTransfer: DataTransfer | null): boolean {
    return Array.from(dataTransfer?.items ?? []).some(
      item => item.kind === 'file' && item.type.startsWith('image/')
    ) || !!this.getImageFile(dataTransfer);
  }

  private getImageFile(dataTransfer: DataTransfer | null): File | undefined {
    return Array.from(dataTransfer?.files ?? []).find(file => file.type.startsWith('image/'));
  }
}
