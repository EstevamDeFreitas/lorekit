import { abilityCost, abilitySummary, normalizeAbilityMechanics, changeAbilityType } from './irpw-ability.model';
import { IrpwVocationHability } from './irpw-vocation.model';

describe('Ironpaw ability mechanics', () => {
  it('switches category with the correct default cost while preserving the original ability', () => {
    const original: IrpwVocationHability = { type: 'technical', grade: 'master', cost: 5, description: 'Efeito registrado', name: 'Chama' };
    const changed = changeAbilityType(original, 'magic');
    expect(changed).not.toBe(original);
    expect(changed.grade).toBe('minor');
    expect(changed.cost).toBe(2);
    expect(changed.description).toBe('Efeito registrado');
    expect(original.type).toBe('technical');
    const saved = normalizeAbilityMechanics(JSON.parse(JSON.stringify(changed)));
    expect(saved.grade).toBe('minor');
  });

  it('uses the different technique and magic costs from the rules', () => {
    expect(abilityCost({ type: 'technical', grade: 'basic', description: '' })).toBe(1);
    expect(abilityCost({ type: 'technical', grade: 'intermediate', description: '' })).toBe(3);
    expect(abilityCost({ type: 'technical', grade: 'master', description: '' })).toBe(5);
    expect(abilityCost({ type: 'magic', grade: 'minor', description: '' })).toBe(2);
    expect(abilitySummary({ type: 'magic', grade: 'medium', description: '' })).toBe('Média · 3 Essência');
    expect(abilityCost({ type: 'magic', grade: 'major', description: '' })).toBe(5);
  });
  it('keeps custom costs, grade effects and remodeling after serialization', () => {
    const ability: IrpwVocationHability = { type: 'magic', grade: 'minor', cost: 4, description: 'Fogo', core: 'Chama', tags: 'fogo', variations: [{ grade: 'medium', cost: 6, description: 'Área maior' }], remodelings: [{ id: 'r1', name: 'Muralha', kind: 'adjacent', grade: 'medium', description: 'Protege uma passagem' }] };
    const restored = normalizeAbilityMechanics(JSON.parse(JSON.stringify(ability)));
    expect(restored.cost).toBe(4);
    expect(restored.variations?.[0].description).toBe('Área maior');
    expect(restored.remodelings?.[0]).toEqual(ability.remodelings![0]);
  });
  it('makes tricks free and prevents variations or remodeling', () => {
    const restored = normalizeAbilityMechanics({ type: 'magic', spellKind: 'trick', cost: 9, description: 'Luz', variations: [{ grade: 'major', cost: 5, description: 'Amplificação' }], remodelings: [{ id: 'r1', name: '', kind: 'empower', grade: 'minor', description: '' }] });
    expect(restored.cost).toBe(0);
    expect(restored.variations).toEqual([]);
    expect(restored.remodelings).toEqual([]);
  });
  it('restricts Moldar Potencial to medium or major spells', () => {
    const restored = normalizeAbilityMechanics({ type: 'magic', description: '', remodelings: [{ id: 'r1', name: '', kind: 'potential', grade: 'minor', description: '' }] });
    expect(restored.remodelings?.[0].grade).toBe('medium');
  });
  it('normalizes negative or invalid costs without changing the source', () => {
    const ability: IrpwVocationHability = { type: 'technical', grade: 'master', cost: -2, description: '' };
    expect(normalizeAbilityMechanics(ability).cost).toBe(0);
    expect(ability.cost).toBe(-2);
  });
});
