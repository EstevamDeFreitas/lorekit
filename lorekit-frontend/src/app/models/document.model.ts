import { Image } from "./image.model";
import { Personalization } from "./personalization.model";
import { World } from "./world.model";
export class Document {
  id: string;
  title: string;
  content?: string;
  type?: string;

  Images?: Image[];
  Personalization?: Personalization;
  ParentWorld?: World | null;

  SubDocuments?: Document[];
  ParentDocument?: Document | null;

  constructor(id: string = '', title: string = '', content?: string, type?: string) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.type = type;
  }
}
