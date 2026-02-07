import { Image } from "./image.model";
import { Personalization } from "./personalization.model";
export class Document {
  id: string;
  title: string;
  content?: string;
  type?: string;

  Images?: Image[];
  Personalization?: Personalization;

  SubDocuments?: Document[];

  constructor(id: string = '', title: string = '', content?: string, type?: string) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.type = type;
  }
}
