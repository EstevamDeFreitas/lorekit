import { Personalization } from "./personalization.model";

export class Moodboard{
  id: string;
  name?: string;

  MoodboardItems?:MoodboardItem[] = [];
  Personalization?:Personalization

  constructor(id:string, name?:string){
    this.id = id;
    this.name = name;
  }
}

export class MoodboardItem{
  id: string;
  configJson?: string;
  postX ?: number;
  postY ?: number;
  index ?: number;

  constructor(id: string, configJson?:string, postX?:number, postY?:number, index?:number){
    this.id = id;
    this.configJson = configJson;
    this.postX = postX;
    this.postY = postY;
    this.index = index;
  }
}

