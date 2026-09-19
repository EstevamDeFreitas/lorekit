import { ATTRIBUTE_GROUP_SKILLS, AttributeGroupCode, SkillCode } from './irpw-attributes-skills.model';

export interface IrpwVocationSkillGroup {
  skills: Record<SkillCode, number>;
}

export type IrpwVocationSkills = Record<AttributeGroupCode, IrpwVocationSkillGroup>;

export interface IrpwCharacterAttributeGroup {
  value: number | null;
  skills: Record<SkillCode, number>;
}

export type IrpwCharacterAttributes = Record<AttributeGroupCode, IrpwCharacterAttributeGroup>;

export interface IrpwPerceptions {
  smell: number | null;
  vision: number | null;
  hearing: number | null;
}

export function normalizeIrpwSkillLevel(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(3, Math.max(0, Math.trunc(numericValue)));
}

export function normalizeIrpwInteger(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.trunc(numericValue);
}

export function createDefaultVocationSkills(): IrpwVocationSkills {
  const result = {} as IrpwVocationSkills;

  for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
    const skills = {} as Record<SkillCode, number>;
    for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
      skills[skill] = 0;
    }
    result[group] = { skills };
  }

  return result;
}

export function parseVocationSkills(rawValue: string | null | undefined): IrpwVocationSkills {
  let parsed: Record<string, { skills?: Record<string, unknown> }> = {};

  if (rawValue) {
    try {
      const candidate = JSON.parse(rawValue);
      parsed = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
        ? candidate
        : {};
    } catch {
      parsed = {};
    }
  }

  const skills = createDefaultVocationSkills();
  for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
    for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
      skills[group].skills[skill] = normalizeIrpwSkillLevel(parsed[group]?.skills?.[skill]);
    }
  }

  return skills;
}

export function serializeVocationSkills(value: IrpwVocationSkills): string {
  const normalized = createDefaultVocationSkills();

  for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
    for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
      normalized[group].skills[skill] = normalizeIrpwSkillLevel(value[group]?.skills?.[skill]);
    }
  }

  return JSON.stringify(normalized);
}

export function getVocationSkillMinimums(rawAttributes: string | null | undefined): Record<SkillCode, number> {
  const parsed = parseVocationSkills(rawAttributes);
  const minimums = {} as Record<SkillCode, number>;

  for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
    for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
      minimums[skill] = parsed[group].skills[skill];
    }
  }

  return minimums;
}

export function parseIrpwPerceptions(rawValue: string | null | undefined): IrpwPerceptions {
  if (!rawValue) return { smell: null, vision: null, hearing: null };

  try {
    const parsed = JSON.parse(rawValue);
    return {
      smell: normalizeIrpwInteger(parsed?.smell),
      vision: normalizeIrpwInteger(parsed?.vision),
      hearing: normalizeIrpwInteger(parsed?.hearing),
    };
  } catch {
    return { smell: null, vision: null, hearing: null };
  }
}

export function getIronpawLifeMinimum(
  vocationBaseHealth: string | number | null | undefined,
  speciesBaseHealth: string | number | null | undefined,
): number {
  const vocationValue = Math.max(0, normalizeIrpwInteger(vocationBaseHealth) ?? 0);
  const speciesValue = Math.max(0, normalizeIrpwInteger(speciesBaseHealth) ?? 0);
  return 1 + vocationValue + speciesValue;
}
