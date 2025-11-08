import { Image } from "./image.model";
import { Specie } from "./specie.model";
import { World } from "./world.model";

export class Character{
  id: string;
  name: string;
  description: string;
  concept?: string | null;
  personality?: string | null;
  background?: string | null;
  height?: number | null;
  weight?: number | null;
  age?: number | null;
  occupation?: string | null;
  alignment?: string | null;
  objectives?: string | null;
  appearance?: string | null;

  ParentWorld?:World | null;
  ParentSpecies?:Specie | null;
  Images?: Image[];

  constructor(
    id: string = '',
    name: string = '',
    description: string = '',
  ){
    this.id = id;
    this.name = name;
    this.description = description;
    this.personality = '';
    this.background = '';
  }
}
