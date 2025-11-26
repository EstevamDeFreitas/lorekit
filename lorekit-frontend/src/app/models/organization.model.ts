import { World } from "./world.model";
import { Image } from "./image.model";
import { Location } from "./location.model";

export class Organization {
  id: string;
  name: string;
  description: string;
  concept?: string;

  Images?: Image[];
  ParentWorld?: World;
  ParentLocation?: Location;
  OrganizationType?: OrganizationType;


  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.description = "";
  }
}

export class OrganizationType{
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
