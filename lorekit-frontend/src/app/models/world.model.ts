import { Personalization } from "./personalization.model";

export class World {
  id: string;
  name: string;
  description?: string;

  concept?: string;

  personalization?: Personalization;

  constructor(id: string = '', name: string = '', description?: string) {
    this.id = id;
    this.name = name;
    this.description = description;
  }
}
