import { Image } from "./image.model";
export class Document {
  id: string;
  title: string;
  content?: string;
  type?: string;

  Images?: Image[];

  constructor(id: string = '', title: string = '', content?: string, type?: string) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.type = type;
  }
}
