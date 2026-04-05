import { World } from "./world.model";
import { Image } from "./image.model";
import { Location } from "./location.model";

export class WorldObject {
  id: string;
  name: string;
  concept?: string;
  age?: string;
  properties?: string;
  history?: string;

  Images?: Image[];
  Personalization?: any;
  ParentWorld?: World;
  ParentLocation?: Location;
  ObjectType?: ObjectType;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

export class ObjectType {
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
