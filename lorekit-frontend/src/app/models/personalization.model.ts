import { Image } from "./image.model";

export class Personalization {
  id: string;
  contentJson: string;

  image?: Image;

  constructor(id: string = '', contentJson: string = '') {
    this.id = id;
    this.contentJson = contentJson;
  }
}

export interface WeakRelationship {
  entityTable: string;
  entityId: string;
}
