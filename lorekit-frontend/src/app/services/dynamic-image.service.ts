import { inject, Injectable } from '@angular/core';
import { ImageService } from './image.service';

@Injectable({ providedIn: 'root' })
export class DynamicImageService {
  private readonly images = inject(ImageService);

  async saveCroppedImage(blob: Blob): Promise<string> {
    return this.images.uploadStandaloneImage(blob, 'dynamic');
  }

  async deleteImage(reference: string): Promise<void> {
    await this.images.deleteAssetReference(reference);
  }
}
