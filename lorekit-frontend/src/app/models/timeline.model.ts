import { Image } from "./image.model";
import { Personalization } from "./personalization.model";
import { World } from "./world.model";

export class Timeline {
  id: string;
  name: string;
  description: string;
  concept?: string | null;

  Personalization?: Personalization | null;
  Images?: Image[];
  ParentWorld?: World | null;

  constructor(id: string = '', name: string = '', description: string = '') {
    this.id = id;
    this.name = name;
    this.description = description;
    this.concept = '';
  }
}
