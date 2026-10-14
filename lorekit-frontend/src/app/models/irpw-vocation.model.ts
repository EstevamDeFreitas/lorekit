import { AttributeGroupCode, SkillCode } from './irpw-attributes-skills.model';
import { Personalization } from './personalization.model';

export type IrpwHabilityType = 'technical' | 'magic' | 'passive';

export interface IrpwVocationHability {
  id?: string | null;
  name?: string | null;
  description: string;
  type?: IrpwHabilityType;
  rollSkill?: SkillCode | null;
  grade?: string | null;
  cost?: number | null;
  spellKind?: 'key' | 'trick';
  core?: string;
  tags?: string;
  variations?: IrpwAbilityVariation[];
  remodelings?: IrpwSpellRemodeling[];
}

export interface IrpwAbilityVariation {
  grade: string;
  cost: number;
  description: string;
}

export type IrpwRemodelingKind = 'empower' | 'adjacent' | 'potential';
export interface IrpwSpellRemodeling {
  id: string;
  name: string;
  kind: IrpwRemodelingKind;
  grade: string;
  description: string;
}

export interface IrpwVocationAttributeGroup {
  value: number | null;
  skills: Record<string, number>;
}

export type IrpwVocationAttributes = Record<AttributeGroupCode, IrpwVocationAttributeGroup>;

export class IrpwVocation {
  id: string;
  name?: string | null;
  description?: string | null;
  habilities?: string | null;
  passive?: string | null;
  basehealth?: string | null;
  basedefense?: string | null;
  attributes?: string | null;
  Personalization?: Personalization | null;

  constructor(id: string = '') {
    this.id = id;
  }
}
