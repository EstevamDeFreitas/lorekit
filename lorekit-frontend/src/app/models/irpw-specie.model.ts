export interface IrpwSpecieHability {
  name?: string | null;
  description: string;
}

export interface IrpwSpeciePerceptions {
  smell: number | null;
  vision: number | null;
  hearing: number | null;
}

export class IrpwSpecie {
  id: string;
  perceptions?: string | null;
  basehealth?: string | null;
  passive?: string | null;
  weakness?: string | null;

  constructor(id: string = '') {
    this.id = id;
  }
}
