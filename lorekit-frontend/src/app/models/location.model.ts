export class Location{
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  worldId?: string;
  parentLocationId?: string;
  relationOptions?: string;

  concept?: string;

  constructor(id: string = '', name: string = '', description: string = '', categoryId?: string, worldId?: string, parentLocationId?: string, relationOptions?: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.categoryId = categoryId;
    this.worldId = worldId;
    this.parentLocationId = parentLocationId;
    this.relationOptions = relationOptions;
  }
}

export class LocationCategory {
  id: string;
  name: string;

  constructor(id: string = '', name: string = '') {
    this.id = id;
    this.name = name;
  }
}
