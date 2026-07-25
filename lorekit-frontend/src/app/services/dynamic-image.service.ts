import { Injectable } from '@angular/core';
import { ElectronSafeAPI } from '../database/database.helper';

@Injectable({
  providedIn: 'root',
})
export class DynamicImageService {
  async saveCroppedImage(blob: Blob): Promise<string> {
    const imagesDirectory = await ElectronSafeAPI.electron.getImagePath();
    const extension = blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : 'jpg';
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const fullPath = `${imagesDirectory}/dynamic/${filename}`;
    const buffer = await blob.arrayBuffer();

    await ElectronSafeAPI.electron.writeFile(fullPath, new Uint8Array(buffer));
    return fullPath;
  }

  async deleteImage(filePath: string): Promise<void> {
    if (filePath) {
      await ElectronSafeAPI.electron.deleteFile(filePath);
    }
  }
}
