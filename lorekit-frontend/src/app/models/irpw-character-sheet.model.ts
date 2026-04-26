export class IrpwCharacterSheet {
  id: string;
  perceptions?: string | null;
  attributes?: string | null;
  lifepoints?: string | null;
  defensepoints?: string | null;
  stress?: string | null;
  mana?: string | null;
  vigor?: string | null;
  subspecialization?: string | null;
  inventory?: string | null;
  habilities?: string | null;
  marks?: string | null;
  conditions?: string | null;

  constructor(id: string = '') {
    this.id = id;
  }
}
