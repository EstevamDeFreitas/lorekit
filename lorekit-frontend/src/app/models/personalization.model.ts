export class Personalization {
  id: string;
  entityTable: string;
  entityId: string;
  contentJson: string;

  constructor(id: string = '', entityTable: string = '', entityId: string = '', contentJson: string = '') {
    this.id = id;
    this.entityTable = entityTable;
    this.entityId = entityId;
    this.contentJson = contentJson;
  }
}
