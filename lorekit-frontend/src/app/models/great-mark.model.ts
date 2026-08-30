import { Image } from "./image.model";
import { Personalization } from "./personalization.model";
import { Timeline } from "./timeline.model";

export class GreatMark {
  id: string;
  name: string;
  description: string;
  concept?: string | null;
  date: number;
  sortOrder: number;

  Images?: Image[];
  Personalization?: Personalization | null;
  ParentTimeline?: Timeline | null;

  constructor(id: string = '', name: string = '', description: string = '', date: number = 0) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.date = date;
    this.sortOrder = date;
    this.concept = '';
  }
}
