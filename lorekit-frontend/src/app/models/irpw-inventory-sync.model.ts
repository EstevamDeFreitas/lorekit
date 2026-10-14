import { IrpwInventoryEnvelope, IrpwItemDefinition, IrpwItemRecord } from './irpw-item.model';

/** Catalog definitions are shared; quantities, notes and placement belong to the sheet. */
export function synchronizeInventory(inventory: IrpwInventoryEnvelope, items: (IrpwItemRecord & { definition: IrpwItemDefinition })[]): IrpwInventoryEnvelope {
  const result = structuredClone(inventory);
  const byId = new Map(items.map(item => [item.id, item]));
  const byPortableId = new Map(items.filter(item => item.portableId).map(item => [item.portableId, item]));
  for (const entry of [...result.entries]) {
    const source = (entry.sourceItemId && byId.get(entry.sourceItemId)) || (entry.sourcePortableId && byPortableId.get(entry.sourcePortableId));
    if (!source) continue; // Keep the last known definition if the source was removed.
    entry.sourceItemId = source.id;
    entry.sourcePortableId = source.portableId;
    entry.sourceRevision = source.revision;
    entry.snapshot = { name: source.name, description: source.description, effects: source.effects, definition: structuredClone(source.definition), icon: source.definition.icon };
    if (entry.location === 'equipment' && entry.slot && !source.definition.equipmentSlots.includes(entry.slot)) {
      result.equipment[entry.slot] = null;
      entry.location = 'backpack';
      entry.slot = null;
      if (!result.backpackOrder.includes(entry.instanceId)) result.backpackOrder.push(entry.instanceId);
    }
    const limit = source.definition.stackable ? source.definition.stackLimit : 1;
    if (entry.location === 'backpack' && entry.quantity > limit) {
      let remaining = entry.quantity - limit;
      entry.quantity = limit;
      let index = result.backpackOrder.indexOf(entry.instanceId) + 1;
      while (remaining > 0) {
        const copy = { ...structuredClone(entry), instanceId: crypto.randomUUID(), quantity: Math.min(remaining, limit) };
        result.entries.push(copy);
        result.backpackOrder.splice(index++, 0, copy.instanceId);
        remaining -= copy.quantity;
      }
    }
  }
  const primary = result.entries.find(entry => entry.instanceId === result.equipment.primary);
  if (primary?.snapshot.definition.weapon?.hands === 2 && result.equipment.secondary) {
    const secondary = result.entries.find(entry => entry.instanceId === result.equipment.secondary);
    if (secondary) {
      secondary.location = 'backpack'; secondary.slot = null;
      if (!result.backpackOrder.includes(secondary.instanceId)) result.backpackOrder.push(secondary.instanceId);
    }
    result.equipment.secondary = null;
  }
  return result;
}
