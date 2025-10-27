export class Document {
  id: string;
  title: string;
  content?: string;
  type?: string;

  constructor(id: string = '', title: string = '', content?: string, type?: string) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.type = type;
  }
}
