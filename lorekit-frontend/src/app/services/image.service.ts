import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Image } from '../models/image.model';
import { CrudHelper, ElectronSafeAPI } from '../database/database.helper';
import { DbProvider } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  async uploadImage(file: File, entityTable: string, entityId: string, usageKey: string): Promise<Image> {
    const imagesDir = await ElectronSafeAPI.electron.getImagePath();
    const baseImageDir = `${imagesDir}/${entityTable.toLowerCase()}`;
    await ElectronSafeAPI.electron.writeFile; // garante acesso

    let imageGuid = crypto.randomUUID();

    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}-${imageGuid}.${ext}`;
    const fullPath = `${baseImageDir}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await ElectronSafeAPI.electron.writeFile(fullPath, uint8Array);

    // salva o registro no banco
    const image: Image = new Image(imageGuid, usageKey, fullPath);

    this.crud.create('Image', image);
    this.crud.create('Relationship', {
      parentTable: entityTable,
      parentId: entityId,
      entityTable: 'Image',
      entityId: image.id
    });
    return image;
  }

  getImages(entityTable: string, entityId: string, usageKey: string): Image[] {
    let entity = this.crud.findById(entityTable, entityId, [{"table": "Image", "firstOnly": false}]);
    let images: Image[] = entity.Images || [];
    if (usageKey) {
      images = images.filter(img => img.usageKey === usageKey);
    }
    return images;
  }

  getImage(entityTable: string, entityId: string, usageKey: string): Image | null {
    const imgs = this.getImages(entityTable, entityId, usageKey);
    return imgs.length ? imgs[0] : null;
  }

  async deleteImage(id: string, deleteRelated: boolean = false) {
    const img = this.crud.findById('Image', id);
    if (!img) return;
    await ElectronSafeAPI.electron.deleteFile(img.filePath);
    this.crud.delete('Image', id, deleteRelated);
  }


}
