import { AttributeGroupCode, SkillCode } from './irpw-attributes-skills.model';
import { Personalization } from './personalization.model';

export type IrpwHabilityType = 'technical' | 'magic' | 'passive';

export interface IrpwVocationHability {
  id?: string | null;
  name?: string | null;
  description: string;
  type?: IrpwHabilityType;
  rollSkill?: SkillCode | null;
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
