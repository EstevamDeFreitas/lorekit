import { Image } from "./image.model";
import { Personalization } from "./personalization.model";
import { World } from "./world.model";

export class Location{
  id: string;
  name: string;
  description: string;

  concept?: string;

  Personalization?: Personalization;
  Image?: Image;
  LocationCategory?: LocationCategory;
  ParentWorld?: World;
  ParentLocation?: Location;

  constructor(id: string = '', name: string = '', description: string = '') {
    this.id = id;
    this.name = name;
    this.description = description;
    this.concept = '';
  }
}

export class LocationCategory {
  id: string;
  name: string;

  constructor(id: string = '', name: string = '') {
    this.id = id;
    this.name = name;
  }
}
