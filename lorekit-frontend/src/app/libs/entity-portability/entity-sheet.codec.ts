import { inspectPortableContent, jsonObject, mapRichContent, ContentMapper, PACKAGE_ASSET_PREFIX, validateJsonTree } from './entity-content.codec';

/** Stored character state only: catalog consumers/definitions are never traversed. */
export async function mapSheet(
  input: Record<string, unknown>, oldOwner: string, newOwner: string, mapper: ContentMapper,
  direction: 'export' | 'import', createId: () => string = () => crypto.randomUUID(),
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = { ...input, ownerKey: newOwner };
  const instances = new Map<string, string>();
  const abilities = new Map<string, string>();
  if (typeof data['inventory'] === 'string' && data['inventory']) {
    const inventory = jsonObject(data['inventory']);
    if (inventory['version'] !== 1 || !Array.isArray(inventory['entries']) || !Array.isArray(inventory['backpackOrder']) || !inventory['equipment'] || typeof inventory['equipment'] !== 'object') throw new Error('Inventário Ironpaw sem suporte à portabilidade.');
    for (const entry of inventory['entries'] as Array<Record<string, unknown>>) {
      if (!entry || typeof entry['instanceId'] !== 'string' || instances.has(entry['instanceId'])) throw new Error('Identidade de item de inventário inválida.');
      const newId = direction === 'export' ? `instance-${instances.size + 1}` : createId();
      instances.set(entry['instanceId'], newId); entry['instanceId'] = newId;
      entry['sourceItemId'] = null; entry['sourcePortableId'] = null; entry['sourceRevision'] = null;
      const snapshot = entry['snapshot'] as Record<string, unknown>;
      if (!snapshot || typeof snapshot !== 'object') throw new Error('Snapshot de inventário ausente.');
      const definition = snapshot['definition'] as Record<string, unknown>;
      if (!definition || typeof definition !== 'object') throw new Error('Definição do snapshot ausente.');
      if (definition['imageReference']) definition['imageReference'] = await mapper.asset(String(definition['imageReference']));
      for (const column of ['description', 'effects']) if (typeof snapshot[column] === 'string') snapshot[column] = await mapRichContent(snapshot[column], mapper);
    }
    inventory['backpackOrder'] = (inventory['backpackOrder'] as string[]).map(id => {
      if (!instances.has(id)) throw new Error('Ordem do inventário aponta para item ausente.'); return instances.get(id)!;
    });
    const equipment = inventory['equipment'] as Record<string, unknown>;
    for (const [slot, id] of Object.entries(equipment)) {
      if (id === null) continue;
      if (typeof id !== 'string' || !instances.has(id)) throw new Error('Equipamento aponta para item ausente.'); equipment[slot] = instances.get(id)!;
    }
    data['inventory'] = JSON.stringify(inventory);
  }
  if (typeof data['habilities'] === 'string' && data['habilities']) {
    const list: unknown = JSON.parse(data['habilities']); validateJsonTree(list);
    if (!Array.isArray(list)) throw new Error('Habilidades Ironpaw inválidas.');
    for (const [index, item] of list.entries()) {
      if (!item || typeof item !== 'object') throw new Error('Habilidade inválida.');
      const oldId = String(item['id'] || `index-${index}`);
      const newId = direction === 'export' ? `ability-${index + 1}` : createId(); abilities.set(oldId, newId); item['id'] = newId;
      if (typeof item['description'] === 'string') item['description'] = await mapRichContent(item['description'], mapper);
    }
    data['habilities'] = JSON.stringify(list);
  }
  if (typeof data['marks'] === 'string' && data['marks']) {
    const marks: unknown = JSON.parse(data['marks']); validateJsonTree(marks);
    if (!Array.isArray(marks)) throw new Error('Marcas Ironpaw inválidas.');
    for (const mark of marks) {
      if (!mark || typeof mark !== 'object') throw new Error('Marca inválida.');
      if (typeof mark['description'] === 'string') mark['description'] = await mapRichContent(mark['description'], mapper);
      for (const group of ['habilities', 'weaknesses']) if (Array.isArray(mark[group])) for (const item of mark[group]) {
        if (typeof item?.['description'] === 'string') item['description'] = await mapRichContent(item['description'], mapper);
      }
    }
    data['marks'] = JSON.stringify(marks);
  }
  if (typeof data['favoriteActions'] === 'string' && data['favoriteActions']) {
    const favorites: unknown = JSON.parse(data['favoriteActions']);
    if (!Array.isArray(favorites) || favorites.some(value => typeof value !== 'string')) throw new Error('Favoritos Ironpaw inválidos.');
    data['favoriteActions'] = JSON.stringify(favorites.flatMap((key: string) => {
      const own = `ability:character:${oldOwner}:`;
      if (key.startsWith(own)) { const id = abilities.get(key.slice(own.length)); return id ? [`ability:character:${newOwner}:${id}`] : []; }
      if (key.startsWith('attack:')) { const id = instances.get(key.slice(7)); return id ? [`attack:${id}`] : []; }
      // Inherited catalog actions are not snapshots belonging to this character.
      if (key.startsWith('ability:')) return [];
      return [key];
    }));
  }
  return data;
}

export function inspectSheet(data: Record<string, unknown>, ownerKey: string, mention: (type: string, key: string) => void, asset: (key: string) => void): void {
  if (data['ownerKey'] !== ownerKey) throw new Error('Ficha Ironpaw com proprietário inválido.');
  for (const [column, value] of Object.entries(data)) {
    if (column === 'ownerKey' || value === null || value === '' || typeof value === 'number') continue;
    if (typeof value !== 'string') throw new Error('Estado Ironpaw inválido.');
    const parsed: unknown = JSON.parse(value); validateJsonTree(parsed);
    if (column === 'inventory') {
      const inventory = jsonObject(value);
      if (inventory['version'] !== 1 || !Array.isArray(inventory['entries']) || !Array.isArray(inventory['backpackOrder'])) throw new Error('Inventário inválido.');
      const ids = new Set<string>();
      for (const entry of inventory['entries'] as Array<Record<string, unknown>>) {
        if (!entry || typeof entry['instanceId'] !== 'string' || ids.has(entry['instanceId']) || entry['sourceItemId'] || entry['sourcePortableId'] || entry['sourceRevision']) throw new Error('Vínculo de catálogo não portátil.');
        ids.add(entry['instanceId']);
        const snapshot = entry['snapshot'] as Record<string, unknown>; const definition = snapshot?.['definition'] as Record<string, unknown>;
        if (!definition) throw new Error('Snapshot inválido.');
        if (definition['imageReference']) {
          const reference = String(definition['imageReference']); if (!/^bundle-asset:\/\/[\w-]{1,128}$/.test(reference)) throw new Error('Imagem do inventário fora do pacote.'); asset(reference.slice(PACKAGE_ASSET_PREFIX.length));
        }
        for (const rich of ['description', 'effects']) if (snapshot[rich] != null) inspectPortableContent(snapshot[rich], mention, asset);
      }
      if ((inventory['backpackOrder'] as unknown[]).some(id => typeof id !== 'string' || !ids.has(id))) throw new Error('Ordem do inventário inválida.');
      for (const id of Object.values(inventory['equipment'] as object || {})) if (id !== null && (typeof id !== 'string' || !ids.has(id))) throw new Error('Equipamento inválido.');
    } else if (column === 'habilities' || column === 'marks') {
      if (!Array.isArray(parsed)) throw new Error('Lista Ironpaw inválida.');
      for (const item of parsed) {
        if (!item || typeof item !== 'object') throw new Error('Entrada Ironpaw inválida.');
        if (item['description'] != null) inspectPortableContent(item['description'], mention, asset);
        for (const group of ['habilities', 'weaknesses']) if (Array.isArray(item[group])) for (const child of item[group]) if (child?.['description'] != null) inspectPortableContent(child['description'], mention, asset);
      }
    } else if (column === 'favoriteActions') {
      if (!Array.isArray(parsed) || parsed.some(key => typeof key !== 'string' || (key.startsWith('ability:') && !key.startsWith(`ability:character:${ownerKey}:`)))) throw new Error('Favorito de catálogo não portátil.');
    }
  }
}
