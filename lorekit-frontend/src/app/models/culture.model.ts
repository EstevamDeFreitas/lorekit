import { Location } from "./location.model";
import { World } from "./world.model";
import { Image } from "./image.model";

export class Culture {
  id: string;
  name: string;
  description: string;
  concept?: string;
  values?: string;
  traditions?: string;
  socialStructure?: string;
  culinaryPractices?: string;
  beliefSystems?: string;
  technologyLevel?: string;
  language?: string;

  ParentWorld?:World;
  ParentLocation?:Location;
  Images?: Image[];

  constructor(id: string = '', name: string = '', description: string = ''){
    this.id = id;
    this.name = name;
    this.description = description;
  }
}
