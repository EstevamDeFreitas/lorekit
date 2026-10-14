import { decodeDynamicImageValue } from '../../components/dynamic-image-field/dynamic-image-field.utils';
import { ENTITY_BUNDLE_LIMITS, EntityBundleV2, PortableEntity, PortableExternalReference } from '../../models/entity-bundle.model';
import { EntityArchive, sha256, validateRaster, verifyArchive } from './entity-archive.codec';
import { mapRichContent, PACKAGE_ASSET_PREFIX, EXTERNAL_MENTION_PREFIX, RICH_CHARACTER_COLUMNS, validatePersonalization } from './entity-content.codec';
import { EntityExportPlan } from './entity-export.planner';
import { projectPortableRow } from './entity-portability.registry';
import { validateCurrency, parseWallet } from '../../models/irpw-currency.model';
import { mapSheet } from './entity-sheet.codec';

export interface ExportResources {
  read(reference: string): Promise<{ bytes: ArrayBuffer; mimeType: string; sha256?: string }>;
  /** Return a label only for readable entities in the origin world. */
  label(type: string, id: string): string | null;
}

export async function buildEntityArchive(plan: EntityExportPlan, resources: ExportResources): Promise<EntityArchive> {
  if (plan.issues.some(issue => issue.blocking)) throw new Error('Resolva ou autorize a omissão dos anexos sem suporte antes de exportar.');
  const local = new Map(plan.entities.map(node => [`${node.source.table}:${node.source.id}`, node]));
  const references: PortableExternalReference[] = [];
  const referenceKeys = new Map<string, string>();
  const dataByKey = new Map<string, Uint8Array>(); const assets: EntityBundleV2['assets'] = [];
  const byReference = new Map<string, string>(); const byHash = new Map<string, string>();
  let totalBytes = 0;
  const addReference = (ownerKey: string, kind: PortableExternalReference['kind'], targetType: string, id: string, fieldKey?: string): string => {
    const slot = `${ownerKey}:${kind}:${targetType}:${id}:${fieldKey ?? ''}`;
    const existing = referenceKeys.get(slot); if (existing) return existing;
    const key = `reference-${references.length + 1}`;
    references.push({ key, ownerKey, kind, targetType, ...(fieldKey ? { fieldKey } : {}), label: resources.label(targetType, id) || 'Referência externa' });
    referenceKeys.set(slot, key); return key;
  };
  const asset = async (reference: string): Promise<string> => {
    const previous = byReference.get(reference); if (previous) return `${PACKAGE_ASSET_PREFIX}${previous}`;
    const file = await resources.read(reference); const bytes = new Uint8Array(file.bytes);
    if (!bytes.length || bytes.length > ENTITY_BUNDLE_LIMITS.assetBytes) throw new Error('Imagem ausente ou acima de 25 MiB.');
    validateRaster(bytes, file.mimeType); const hash = await sha256(bytes);
    if (file.sha256 && file.sha256.toLowerCase() !== hash) throw new Error('Imagem alterada ou corrompida.');
    let key = byHash.get(hash);
    if (!key) {
      key = `asset-${assets.length + 1}`;
      if (assets.length >= ENTITY_BUNDLE_LIMITS.assets || (totalBytes += bytes.length) > ENTITY_BUNDLE_LIMITS.packageBytes) throw new Error('Imagens excedem os limites do pacote.');
      assets.push({ key, path: `assets/${key}`, mimeType: file.mimeType, sizeBytes: bytes.length, sha256: hash }); dataByKey.set(key, bytes); byHash.set(hash, key);
    }
    byReference.set(reference, key); return `${PACKAGE_ASSET_PREFIX}${key}`;
  };
  const currencyUnits = new Map<string, Map<string, string>>();
  const currencyData = new Map<string, Record<string, unknown>>();
  for (const node of plan.entities.filter(node => node.source.table === 'IRPWCurrency')) {
    const units = JSON.parse(String(node.data['unitsJson']));
    const currency = { id: node.key, name: String(node.data['name']), description: String(node.data['description'] ?? ''), units };
    if (validateCurrency(currency).length) throw new Error('Definição de moeda inválida.');
    const mapping = new Map<string, string>();
    const portable = units.map((unit: { id: string; name: string; convertAt: number | null }, index: number) => { const id = `unit-${index + 1}`; mapping.set(unit.id, id); return { id, name: unit.name, convertAt: unit.convertAt }; });
    currencyUnits.set(node.source.id, mapping); currencyData.set(node.key, { name: currency.name, description: currency.description, unitsJson: JSON.stringify(portable) });
  }
  const entities: PortableEntity[] = [];
  for (const node of plan.entities) {
    const type = node.source.table as PortableEntity['type']; const ownerKey = node.ownerCharacterKey || node.key;
    const mapper = {
      asset,
      mention: (part: { kind: 'mention'; entityTable: string; entityId: string; label: string }) => {
        const target = local.get(`${part.entityTable}:${part.entityId}`);
        if (target) return { ...part, entityId: target.key };
        const referenceKey = addReference(ownerKey, 'mention', part.entityTable, part.entityId);
        return { ...part, label: resources.label(part.entityTable, part.entityId) || 'Referência externa', entityId: `${EXTERNAL_MENTION_PREFIX}${referenceKey}` };
      },
    };
    let data = { ...node.data };
    if (type === 'Character' || type === 'Document') {
      for (const column of Object.keys(data)) if ((type === 'Document' && column === 'content') || (type === 'Character' && RICH_CHARACTER_COLUMNS.has(column))) {
        if (typeof data[column] === 'string') data[column] = await mapRichContent(data[column], mapper);
      }
    } else if (type === 'Image') {
      const reference = data['blobId'] ? `lorekit-asset://${data['blobId']}` : String(data['filePath'] || '');
      const uri = await asset(reference); data = { usageKey: data['usageKey'], assetKey: uri.slice(PACKAGE_ASSET_PREFIX.length) };
    } else if (type === 'Personalization') validatePersonalization(data['contentJson']);
    else if (type === 'IRPWCurrency') data = currencyData.get(node.key)!;
    else if (type === 'IRPWCharacterSheet') {
      if (typeof data['wallet'] === 'string' && data['wallet']) {
        const wallet = parseWallet(data['wallet']); if (!wallet) throw new Error('Carteira inválida.');
        for (const account of wallet.accounts) {
          const target = local.get(`IRPWCurrency:${account.currencyId}`); const units = currencyUnits.get(account.currencyId);
          if (!target || !units) throw new Error('Moeda usada pela carteira não foi incluída.');
          const balances: Record<string, number> = {};
          for (const [unit, amount] of Object.entries(account.balances)) { if (!units.has(unit)) throw new Error('Saldo sem definição de unidade.'); balances[units.get(unit)!] = amount; }
          account.currencyId = target.key; account.balances = balances;
        }
        data['wallet'] = JSON.stringify(wallet);
      }
      data = await mapSheet(data, node.source.id, ownerKey, mapper, 'export');
    }
    else if (type === 'DynamicFieldValue') {
      const definition = plan.dynamicFields.find(field => field.definition.key === data['fieldKey'])!.definition;
      if (definition.fieldType === 'entity' && data['value']) {
        const id = String(data['value']); const target = local.get(`${definition.targetEntityTable}:${id}`); data['value'] = null;
        if (target) data['entityKey'] = target.key;
        else data['externalReferenceKey'] = addReference(ownerKey, 'dynamic-field', definition.targetEntityTable!, id, definition.key);
      } else if (definition.fieldType === 'image' && data['value']) {
        const references: string[] = []; for (const ref of decodeDynamicImageValue(String(data['value']))) references.push(await asset(ref)); data['value'] = JSON.stringify(references);
      }
      else if ((definition.fieldType === 'editor' || definition.isEditorField) && typeof data['value'] === 'string') data['value'] = await mapRichContent(data['value'], mapper);
    }
    entities.push({ type, key: node.key, schemaVersion: 1, data: projectPortableRow(type, data) });
  }
  for (const reference of plan.externalReferences) {
    if (reference.kind === 'relationship') addReference(reference.ownerKey, 'relationship', reference.targetType, reference.sourceId || '');
  }
  const types = new Map(entities.map(entity => [entity.key, entity.type]));
  const manifest: EntityBundleV2 = { format: 'lorekit-entity-bundle', version: 2, exportedAt: new Date().toISOString(), root: { type: 'Character', key: plan.rootKey },
    entities, dynamicFields: plan.dynamicFields.map(field => field.definition), layouts: plan.layouts,
    relationships: plan.relationships.map(edge => ({ kind: edge.kind, from: { type: types.get(edge.fromKey)!, key: edge.fromKey }, to: { type: types.get(edge.toKey)!, key: edge.toKey } })),
    externalReferences: references, assets };
  const archive = { manifest, assets: dataByKey }; await verifyArchive(archive); return archive;
}
