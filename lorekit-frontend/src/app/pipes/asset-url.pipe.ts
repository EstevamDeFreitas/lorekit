import { Pipe, PipeTransform } from '@angular/core';
import { buildImageRecordUrl, buildImageUrl, Image } from '../models/image.model';

@Pipe({
  name: 'assetUrl',
  pure: false,
})
export class AssetUrlPipe implements PipeTransform {
  transform(value: string | Pick<Image, 'filePath' | 'blobId'> | null | undefined): string {
    return typeof value === 'string' ? buildImageUrl(value) : buildImageRecordUrl(value);
  }
}
