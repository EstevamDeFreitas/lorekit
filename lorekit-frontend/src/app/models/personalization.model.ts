import { Image } from "./image.model";

export class Personalization {
  id: string;
  entityTable: string;
  entityId: string;
  contentJson: string;

  image?: Image;

  constructor(id: string = '', entityTable: string = '', entityId: string = '', contentJson: string = '') {
    this.id = id;
    this.entityTable = entityTable;
    this.entityId = entityId;
    this.contentJson = contentJson;
  }
}

export interface WeakRelationship {
  entityTable: string;
  entityId: string;
}
