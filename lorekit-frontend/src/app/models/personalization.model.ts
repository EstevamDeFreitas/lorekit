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

export function getPersonalizationValue(entity:any, key: string): string | null {
  let personalization = <Personalization>entity.Personalization;

  if (personalization && personalization.contentJson != null && personalization.contentJson != '') {
    return JSON.parse(personalization.contentJson)[key] || null;
  }

  return null;
}
