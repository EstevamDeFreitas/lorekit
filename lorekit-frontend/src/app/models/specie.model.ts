import { Image } from "./image.model";
import { Location } from "./location.model";
import { World } from "./world.model";

export class Specie{
  id: string;
  name: string;
  description: string;
  classification : string;
  concept: string;
  diet: string;
  averageHeight: number;
  averageLifespan: number;
  averageWeight: number;
  physicalCharacteristics: string;
  behavioralCharacteristics: string;

  Images?:Image[];
  ParentLocation?: Location;
  ParentWorld?: World;
  ParentSpecies?: Specie;

  constructor(id: string = '', name: string = '', description: string = '') {
    this.id = id;
    this.name = name;
    this.description = description;

    this.classification = '';
    this.concept = '';
    this.diet = '';
    this.averageHeight = 0;
    this.averageLifespan = 0;
    this.averageWeight = 0;
    this.physicalCharacteristics = '';
    this.behavioralCharacteristics = '';
  }
}
