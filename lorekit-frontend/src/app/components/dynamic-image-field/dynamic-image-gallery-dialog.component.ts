import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { buildImageUrl } from '../../models/image.model';
import { DynamicImageService } from '../../services/dynamic-image.service';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import {
  ImageCropDialogComponent,
  ImageCropDialogData,
} from '../image-crop-dialog/image-crop-dialog.component';

export interface DynamicImageGalleryDialogData {
  title: string;
  imagePaths: string[];
  aspectRatio: number;
}

@Component({
  selector: 'app-dynamic-image-gallery-dialog',
  imports: [ButtonComponent, IconButtonComponent],
  templateUrl: './dynamic-image-gallery-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicImageGalleryDialogComponent implements OnDestroy {
  private readonly dialogRef = inject<DialogRef<string[] | undefined>>(DialogRef);
  private readonly data = inject<DynamicImageGalleryDialogData>(DIALOG_DATA);
  private readonly dialog = inject(Dialog);
  private readonly dynamicImageService = inject(DynamicImageService);

  protected readonly title = this.data.title;
  protected readonly aspectRatio = this.data.aspectRatio;
  protected readonly images = signal([...this.data.imagePaths]);
  protected readonly isFileOver = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  private readonly originalPaths = new Set(this.data.imagePaths);
  private readonly createdPaths = new Set<string>();
  private completed = false;
  private cleanupStarted = false;

  ngOnDestroy(): void {
    if (!this.completed) {
      void this.cleanupCreatedImages();
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

  protected async removeImage(path: string): Promise<void> {
    this.images.update(images => images.filter(image => image !== path));
    if (this.createdPaths.has(path)) {
      try {
        await this.dynamicImageService.deleteImage(path);
        this.createdPaths.delete(path);
      } catch {
        this.errorMessage.set('Não foi possível remover o arquivo recém-adicionado.');
      }
    }
  }

  protected moveImage(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    const images = this.images();
    if (targetIndex < 0 || targetIndex >= images.length) {
      return;
    }

    const reordered = [...images];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    this.images.set(reordered);
  }

  protected imageUrl(path: string): string {
    return buildImageUrl(path);
  }

  protected async confirm(): Promise<void> {
    this.isSaving.set(true);
    this.errorMessage.set('');
    try {
      const currentPaths = new Set(this.images());
      const removedPaths = [...this.originalPaths].filter(path => !currentPaths.has(path));
      await Promise.all(
        removedPaths.map(path => this.dynamicImageService.deleteImage(path))
      );
      this.completed = true;
      this.dialogRef.close([...this.images()]);
    } catch {
      this.errorMessage.set('Não foi possível concluir as alterações da galeria.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    await this.cleanupCreatedImages();
    this.completed = true;
    this.dialogRef.close();
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
          void this.addCroppedImage(blob);
        }
      });
    };
    reader.onerror = () => this.errorMessage.set('Não foi possível ler esta imagem.');
    reader.readAsDataURL(file);
  }

  private async addCroppedImage(blob: Blob): Promise<void> {
    this.isSaving.set(true);
    this.errorMessage.set('');
    try {
      const path = await this.dynamicImageService.saveCroppedImage(blob);
      this.createdPaths.add(path);
      this.images.update(images => [...images, path]);
    } catch {
      this.errorMessage.set('Não foi possível salvar a imagem recortada.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async cleanupCreatedImages(): Promise<void> {
    if (this.cleanupStarted) {
      return;
    }
    this.cleanupStarted = true;
    await Promise.allSettled(
      [...this.createdPaths].map(path => this.dynamicImageService.deleteImage(path))
    );
    this.createdPaths.clear();
  }

  private hasImageFile(dataTransfer: DataTransfer | null): boolean {
    return Array.from(dataTransfer?.items ?? []).some(
      item => item.kind === 'file' && item.type.startsWith('image/')
    ) || !!this.getImageFile(dataTransfer);
  }

  private getImageFile(dataTransfer: DataTransfer | null): File | undefined {
    return Array.from(dataTransfer?.files ?? []).find(file =>
      file.type.startsWith('image/')
    );
  }
}
