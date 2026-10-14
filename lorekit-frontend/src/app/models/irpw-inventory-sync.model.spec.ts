import { synchronizeInventory } from './irpw-inventory-sync.model';
import { createEmptyInventory, createEmptyItemDefinition, IrpwInventoryEntry } from './irpw-item.model';

describe('Shared catalog inventory definitions', () => {
  function setup() {
    const inventory = createEmptyInventory();
    const definition = createEmptyItemDefinition('weapon'); definition.equipmentSlots = ['primary', 'secondary'];
    const source = { id: 'sword', portableId: 'portable', revision: 2, name: 'Espada nova', description: 'Descrição nova', effects: 'Novo efeito', definition };
    const entry: IrpwInventoryEntry = { instanceId: 'instance', sourceItemId: 'sword', snapshot: { name: 'Antiga', description: '', definition: createEmptyItemDefinition() }, quantity: 10, notes: 'Presente', location: 'backpack' };
    inventory.entries.push(entry); inventory.backpackOrder.push(entry.instanceId);
    return { inventory, source, entry };
  }
  it('updates definitions while preserving possession data and original input', () => {
    const { inventory, source } = setup();
    const result = synchronizeInventory(inventory, [source]);
    expect(result.entries[0].snapshot.name).toBe('Espada nova');
    expect(result.entries[0].snapshot.effects).toBe('Novo efeito');
    expect(result.entries[0].quantity).toBe(10);
    expect(result.entries[0].notes).toBe('Presente');
    expect(inventory.entries[0].snapshot.name).toBe('Antiga');
  });
  it('splits piles on reduced limits while preserving all units', () => {
    const { inventory, source } = setup(); source.definition.stackLimit = 3;
    const result = synchronizeInventory(inventory, [source]);
    expect(result.entries.map(entry => entry.quantity)).toEqual([3, 3, 3, 1]);
    expect(result.backpackOrder.length).toBe(4);
    expect(result.entries.every(entry => entry.notes === 'Presente')).toBeTrue();
    expect(synchronizeInventory(result, [source])).toEqual(result);
  });
  it('returns incompatible equipment to the backpack', () => {
    const { inventory, source, entry } = setup(); entry.quantity = 1; entry.location = 'equipment'; entry.slot = 'primary'; inventory.equipment.primary = entry.instanceId; inventory.backpackOrder = [];
    source.definition.equipmentSlots = [];
    const result = synchronizeInventory(inventory, [source]);
    expect(result.equipment.primary).toBeNull();
    expect(result.entries[0].location).toBe('backpack');
    expect(result.backpackOrder).toEqual(['instance']);
  });
  it('frees the secondary slot when a linked weapon changes to two hands', () => {
    const { inventory, source, entry } = setup(); entry.quantity = 1; entry.location = 'equipment'; entry.slot = 'primary'; inventory.equipment.primary = entry.instanceId; inventory.backpackOrder = [];
    inventory.entries.push({ ...structuredClone(entry), instanceId: 'secondary', sourceItemId: null, slot: 'secondary' }); inventory.equipment.secondary = 'secondary'; source.definition.weapon!.hands = 2;
    const result = synchronizeInventory(inventory, [source]);
    expect(result.equipment.secondary).toBeNull();
    expect(result.backpackOrder).toContain('secondary');
  });
  it('retains fallback definitions when sources are removed', () => {
    const { inventory } = setup();
    expect(synchronizeInventory(inventory, [])).toEqual(inventory);
  });
});
