export class Link{
  id: string;
  name?: string;
  fromTable: string;
  fromId: string;
  toTable: string;
  toId: string;
  configJson?: string;

  constructor(id: string, fromTable: string, fromId: string, toTable: string, toId: string, name?: string, configJson?: string){
    this.id = id;
    this.fromTable = fromTable;
    this.fromId = fromId;
    this.toTable = toTable;
    this.toId = toId;
    this.name = name;
    this.configJson = configJson;
  }
}
