import { Image } from './image.model';
import { Personalization } from './personalization.model';
import { Timeline } from './timeline.model';
export class Age {
  id: string;
  name: string;
  description: string;
  startDate: number;
  endDate: number;
  Images?: Image[];
  Personalization?: Personalization | null;
  ParentTimeline?: Timeline | null;
  constructor(
    id: string = '',
    name: string = '',
    description: string = '',
    startDate: number = 0,
    endDate: number = 0,
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.startDate = startDate;
    this.endDate = endDate;
  }
}
