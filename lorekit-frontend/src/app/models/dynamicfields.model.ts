export class DynamicField {
  id: string;
  name: string;
  entityTable: string;
  options ?: string;
  isEditorField: boolean = false;

  constructor(id: string = '', name: string = '', entityTable: string = '', options: string = ''){
    this.id = id;
    this.name = name;
    this.entityTable = entityTable;
    this.options = options;
  }
}

export class DynamicFieldValue  {
  id: string;
  value: string;

  ParentDynamicField?: DynamicField;

  constructor(id: string = '', value: string = ''){
    this.id = id;
    this.value = value;
  }
}
