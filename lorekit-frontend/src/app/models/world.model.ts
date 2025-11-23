import { Personalization } from "./personalization.model";
import { Image } from "./image.model";

export class World {
  id: string;
  name: string;
  description?: string;

  concept?: string;

  Personalization?: Personalization;
  Images?: Image[];

  constructor(id: string = '', name: string = '', description?: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.concept = '';
  }
}
