import {
  calculateDefensePointsMax,
  createEmptyItemDefinition,
  parseIrpwDefensePoints,
  parseIrpwInventory,
  protectionContribution,
  validateIrpwItemDefinition,
  normalizeIrpwItemDefinition,
  IRPW_EQUIPMENT_SLOTS,
  IRPW_EQUIPMENT_SLOT_LABEL,
} from './irpw-item.model';

describe('Ironpaw item and inventory models', () => {
  it('validates item unique benefit limits and protection tiers', () => {
    const definition = createEmptyItemDefinition('protection');
    definition.protection = { tier: 'heavy', effects: 'Redução descritiva' };
    definition.unique = true;
    definition.uniqueBenefits = ['um', 'dois', 'três'];
    expect(validateIrpwItemDefinition(definition).length).toBe(1);
    expect(definition.protection.tier).toBe('heavy');
  });

  it('normalizes system and custom colors while rejecting malformed values', () => {
    expect(normalizeIrpwItemDefinition({ color: '#ABCDEF', backgroundColor: '#123456' }).color).toBe('#abcdef');
    expect(normalizeIrpwItemDefinition({ backgroundColor: '#123456' }).backgroundColor).toBe('#123456');
    expect(normalizeIrpwItemDefinition({ color: 'red' }).color).toBeNull();
  });

  it('keeps the three accessory slots and lower underwear slot addressable', () => {
    expect(IRPW_EQUIPMENT_SLOTS).toContain('accessory1');
    expect(IRPW_EQUIPMENT_SLOTS).toContain('accessory2');
    expect(IRPW_EQUIPMENT_SLOTS).toContain('accessory3');
    expect(IRPW_EQUIPMENT_SLOT_LABEL.underwear).toContain('inferior');
    expect(normalizeIrpwItemDefinition({
      equipmentSlots: ['accessory1', 'accessory2', 'accessory3', 'underwear'],
    }).equipmentSlots).toEqual(['accessory1', 'accessory2', 'accessory3', 'underwear']);
  });
  it('keeps current defense points while deriving the maximum', () => {
    const defense = parseIrpwDefensePoints(
      JSON.stringify({ currentPoints: 1 }),
      2,
      3,
    );
    expect(defense.currentPoints).toBe(1);
    expect(calculateDefensePointsMax(defense)).toBe(5);
  });

  it('rejects unknown inventory versions without mutating the input', () => {
    const raw = JSON.stringify({ version: 99, entries: [], backpackOrder: [] });
    expect(parseIrpwInventory(raw)).toBeNull();
    expect(
      protectionContribution({
        version: 1,
        entries: [],
        backpackOrder: [],
        equipment: {},
      }),
    ).toBe(0);
  });
});
