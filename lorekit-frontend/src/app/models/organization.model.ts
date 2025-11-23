export class Organization {
  id: string;
  name: string;
  description: string;
  concept?: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.description = "";
  }
}

export class OrganizationType{
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
