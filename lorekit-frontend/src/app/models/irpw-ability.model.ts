import { IrpwVocationHability, IrpwRemodelingKind, IrpwHabilityType } from './irpw-vocation.model';

export const TECHNIQUE_GRADES = [
  { value: 'basic', label: 'Básica', cost: 1 },
  { value: 'intermediate', label: 'Intermediária', cost: 3 },
  { value: 'master', label: 'Mestre', cost: 5 },
];
export const MAGIC_GRADES = [
  { value: 'minor', label: 'Menor', cost: 2 },
  { value: 'medium', label: 'Média', cost: 3 },
  { value: 'major', label: 'Maior', cost: 5 },
];
export const REMODELING_KINDS: { value: IrpwRemodelingKind; label: string; cost: number; level: string }[] = [
  { value: 'empower', label: 'Potenciar', cost: 1, level: 'Treinado' },
  { value: 'adjacent', label: 'Alterar em Adjacência', cost: 1, level: 'Intermediário' },
  { value: 'potential', label: 'Moldar Potencial', cost: 2, level: 'Intermediário' },
];
export function abilityGrades(ability: IrpwVocationHability) {
  return ability.type === 'magic' ? MAGIC_GRADES : TECHNIQUE_GRADES;
}
export function abilityCost(ability: IrpwVocationHability): number {
  if (ability.type === 'passive' || ability.spellKind === 'trick' && ability.type === 'magic') return 0;
  return finiteCost(ability.cost, abilityGrades(ability).find(g => g.value === ability.grade)?.cost ?? abilityGrades(ability)[0].cost);
}
export function abilitySummary(ability: IrpwVocationHability): string {
  if (ability.type === 'passive') return 'Passiva';
  const grade = ability.type === 'magic' && ability.spellKind === 'trick' ? 'Truque' : abilityGrades(ability).find(g => g.value === ability.grade)?.label ?? abilityGrades(ability)[0].label;
  return grade + ' · ' + abilityCost(ability) + (ability.type === 'magic' ? ' Essência' : ' Vigor');
}
export function normalizeAbilityMechanics(source: IrpwVocationHability): Partial<IrpwVocationHability> {
  if (source.type === 'passive') return {};
  const magic = source.type === 'magic';
  const trick = magic && source.spellKind === 'trick';
  const grades = abilityGrades(source);
  const grade = grades.find(g => g.value === source.grade) ?? grades[0];
  return {
    grade: trick ? null : grade.value,
    cost: trick ? 0 : finiteCost(source.cost, grade.cost),
    ...(magic ? { spellKind: trick ? 'trick' : 'key', core: text(source.core), tags: text(source.tags) } : {}),
    variations: trick ? [] : (Array.isArray(source.variations) ? source.variations : []).filter(v => v && grades.some(g => g.value === v.grade)).map(v => ({ grade: v.grade, cost: finiteCost(v.cost, grades.find(g => g.value === v.grade)!.cost), description: text(v.description) })),
    remodelings: magic && !trick ? (Array.isArray(source.remodelings) ? source.remodelings : []).filter(r => r && REMODELING_KINDS.some(k => k.value === r.kind)).map(r => ({ id: text(r.id) || crypto.randomUUID(), name: text(r.name), kind: r.kind, grade: r.kind === 'potential' ? (r.grade === 'major' ? 'major' : 'medium') : (MAGIC_GRADES.some(g => g.value === r.grade) ? r.grade : grade.value), description: text(r.description) })) : [],
  };
}
function finiteCost(value: unknown, fallback: number): number {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? fallback : Math.max(0, Math.trunc(Number(value)));
}
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }

export function changeAbilityType(ability: IrpwVocationHability, type: IrpwHabilityType): IrpwVocationHability {
  if (ability.type === type) return ability;
  const updated: IrpwVocationHability = { ...ability, type, grade: null, cost: null, variations: [], remodelings: [], spellKind: 'key' };
  return { ...updated, ...normalizeAbilityMechanics(updated) };
}
