import { EntityImportPlan } from './entity-import.planner';
import { immutableCopy } from './entity-portability.registry';
import { mapRichContent, ContentMapper, PACKAGE_ASSET_PREFIX, EXTERNAL_MENTION_PREFIX, RICH_CHARACTER_COLUMNS } from './entity-content.codec';
import { mapSheet } from './entity-sheet.codec';

export async function resolveImportContent(plan: EntityImportPlan): Promise<EntityImportPlan> {
  const rows = structuredClone(plan.rows); const ids = new Map(plan.entityIds.map(item => [item.key, item.id]));
  const assetIds = new Map(plan.assets.map(item => [item.key, item.blobId]));
  const currencyUnits = new Map<string, Map<string, string>>();
  for (const entity of plan.bundle.entities.filter(entity => entity.type === 'IRPWCurrency')) {
    const row = rows.find(row => row.table === 'IRPWCurrency' && row.id === ids.get(entity.key))!;
    const units = JSON.parse(String(row.data['unitsJson'])) as Array<{ id: string }>;
    const mapping = new Map<string, string>(); for (const unit of units) { const id = crypto.randomUUID(); mapping.set(unit.id, id); unit.id = id; }
    row.data['unitsJson'] = JSON.stringify(units); currencyUnits.set(entity.key, mapping);
  }
  const mapper: ContentMapper = {
    asset: reference => {
      if (!reference.startsWith(PACKAGE_ASSET_PREFIX)) throw new Error('Referência de asset não portátil.');
      const id = assetIds.get(reference.slice(PACKAGE_ASSET_PREFIX.length)); if (!id) throw new Error('Asset ausente.'); return `lorekit-asset://${id}`;
    },
    mention: part => {
      if (part.entityId.startsWith(EXTERNAL_MENTION_PREFIX)) {
        const key = part.entityId.slice(EXTERNAL_MENTION_PREFIX.length);
        if (!Object.hasOwn(plan.resolutions.references || {}, key)) throw new Error('Menção externa sem resolução.');
        const id = plan.resolutions.references![key];
        return id === null ? { kind: 'text', text: part.label } : { ...part, entityId: id };
      }
      const id = ids.get(part.entityId); if (!id) throw new Error('Menção interna sem destino.'); return { ...part, entityId: id };
    },
  };
  for (const entity of plan.bundle.entities) {
    const row = rows.find(candidate => candidate.table === entity.type && candidate.id === ids.get(entity.key))!;
    if (entity.type === 'Character' || entity.type === 'Document') {
      for (const column of Object.keys(row.data)) if ((entity.type === 'Document' && column === 'content') || (entity.type === 'Character' && RICH_CHARACTER_COLUMNS.has(column))) {
        if (typeof row.data[column] === 'string') row.data[column] = await mapRichContent(row.data[column], mapper);
      }
    } else if (entity.type === 'DynamicFieldValue') {
      const field = plan.bundle.dynamicFields.find(field => field.key === entity.data['fieldKey'])!;
      if (field.fieldType === 'image' && typeof row.data['value'] === 'string' && row.data['value']) {
        const paths = JSON.parse(row.data['value']) as string[]; const rewritten: string[] = [];
        for (const path of paths) rewritten.push(await mapper.asset(path)); row.data['value'] = JSON.stringify(rewritten);
      } else if ((field.fieldType === 'editor' || field.isEditorField) && typeof row.data['value'] === 'string') row.data['value'] = await mapRichContent(row.data['value'], mapper);
    } else if (entity.type === 'IRPWCharacterSheet') {
      if (typeof row.data['wallet'] === 'string' && row.data['wallet']) {
        const wallet = JSON.parse(row.data['wallet']) as { accounts: Array<{ currencyId: string; balances: Record<string, number> }> };
        for (const account of wallet.accounts) {
          const units = currencyUnits.get(account.currencyId); const id = ids.get(account.currencyId);
          if (!units || !id) throw new Error('Moeda sem destino.');
          account.balances = Object.fromEntries(Object.entries(account.balances).map(([unit, value]) => { const id = units.get(unit); if (!id) throw new Error('Unidade sem destino.'); return [id, value]; })); account.currencyId = id;
        }
        row.data['wallet'] = JSON.stringify(wallet);
      }
      row.data = await mapSheet(row.data, String(entity.data['ownerKey']), row.id, mapper, 'import'); delete row.data['ownerKey'];
    }
  }
  return immutableCopy({ ...plan, rows });
}
