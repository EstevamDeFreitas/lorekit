import { Injectable, Optional } from '@angular/core';
import { DbProvider } from '../app.config';
import { IrpwItemDefinition, normalizeIrpwItemDefinition, validateIrpwItemDefinition } from '../models/irpw-item.model';
import { IrpwCatalogItem, IrpwItemCatalogService } from './irpw-item-catalog.service';
import { ImageService, StagedImageAsset } from './image.service';

const PORTABLE_ASSET_PREFIX = 'asset-sha256:';

export interface IrpwItemPackageAsset {
  sha256: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64: string;
  width?: number;
  height?: number;
}
export interface IrpwItemPackageItem {
  portableId: string;
  revision: number;
  name: string;
  description: string;
  concept?: string | null;
  definition: IrpwItemDefinition;
}
export interface IrpwItemPackage {
  format: 'lorekit-ironpaw-items';
  version: 1;
  system: 'ironpaw';
  package: { id: string; name: string };
  items: IrpwItemPackageItem[];
  assets: IrpwItemPackageAsset[];
}
export interface IrpwItemImportPlan {
  document: IrpwItemPackage;
  added: IrpwItemPackageItem[];
  equivalent: IrpwItemPackageItem[];
  conflicts: Array<{ incoming: IrpwItemPackageItem; local: IrpwCatalogItem }>;
}
export interface IrpwItemExportOptions {
  readonly includeImages?: boolean;
}

@Injectable({ providedIn: 'root' })
export class IrpwItemPortabilityService {
  constructor(
    private readonly dbProvider: DbProvider,
    private readonly catalog: IrpwItemCatalogService,
    @Optional() private readonly imageService?: ImageService,
  ) {}

  async exportItems(items: IrpwCatalogItem[], packageName = 'Itens Ironpaw', options: IrpwItemExportOptions = {}): Promise<IrpwItemPackage> {
    const assets = new Map<string, IrpwItemPackageAsset>();
    const portableItems: IrpwItemPackageItem[] = [];
    for (const item of items) {
      const definition = options.includeImages === false
        ? { ...normalizeIrpwItemDefinition(item.definition), imageReference: null, imageAssetSha256: null }
        : await this.toPortableDefinition(item.definition, assets);
      portableItems.push({
        portableId: item.portableId || crypto.randomUUID(),
        revision: Math.max(1, item.revision || 1),
        name: item.name,
        description: item.description,
        concept: item.concept ?? null,
        definition,
      });
    }
    return {
      format: 'lorekit-ironpaw-items',
      version: 1,
      system: 'ironpaw',
      package: { id: crypto.randomUUID(), name: packageName },
      items: portableItems,
      assets: [...assets.values()],
    };
  }

  prepareImport(serialized: string): IrpwItemImportPlan {
    if (serialized.length > 20 * 1024 * 1024) throw new Error('O pacote excede o limite de 20 MiB.');
    let raw: unknown;
    try { raw = JSON.parse(serialized); } catch { throw new Error('O conteúdo não é um JSON válido.'); }
    const document = this.parseDocument(raw);
    const local = this.catalog.getItems(true);
    const localByPortableId = new Map(local.filter(item => item.portableId).map(item => [item.portableId!, item]));
    const added: IrpwItemPackageItem[] = [];
    const equivalent: IrpwItemPackageItem[] = [];
    const conflicts: Array<{ incoming: IrpwItemPackageItem; local: IrpwCatalogItem }> = [];
    for (const incoming of document.items) {
      const existing = localByPortableId.get(incoming.portableId);
      if (!existing) added.push(incoming);
      else if (comparableDefinition(existing.definition) === comparableDefinition(incoming.definition) && existing.name === incoming.name && existing.description === incoming.description) equivalent.push(incoming);
      else conflicts.push({ incoming, local: existing });
    }
    return { document, added, equivalent, conflicts };
  }

  async applyImport(plan: IrpwItemImportPlan, conflict: 'keep' | 'update' | 'copy' = 'update'): Promise<void> {
    this.assertPlanFresh(plan);
    if (plan.document.assets.length && !this.imageService) throw new Error('O suporte a imagens não está disponível neste workspace. Nenhuma alteração foi aplicada.');

    const operationId = crypto.randomUUID();
    const staged: StagedImageAsset[] = [];
    const stagedByHash = new Map<string, StagedImageAsset>();
    const requiredHashes = new Set<string>();
    for (const incoming of plan.added) {
      const hash = imageHash(incoming.definition.imageReference) ?? incoming.definition.imageAssetSha256;
      if (hash) requiredHashes.add(hash);
    }
    if (conflict !== 'keep') {
      for (const entry of plan.conflicts) {
        const hash = imageHash(entry.incoming.definition.imageReference) ?? entry.incoming.definition.imageAssetSha256;
        if (hash) requiredHashes.add(hash);
      }
    }
    let committed = false;
    try {
      this.writeOperationMarker(operationId, 'pending', []);
      await this.dbProvider.flushPendingWrites();
      for (const asset of plan.document.assets) {
        if (!requiredHashes.has(asset.sha256)) continue;
        const bytes = decodeBase64(asset.base64);
        const actualSha256 = await sha256Hex(bytes);
        if (actualSha256 !== asset.sha256) throw new Error(`A imagem ${asset.sha256} não corresponde ao hash declarado.`);
        const dimensions = readImageDimensions(bytes, asset.mimeType);
        if (dimensions && (dimensions.width > 4096 || dimensions.height > 4096)) throw new Error('Uma imagem importada excede 4096 x 4096 pixels.');
        const stagedAsset = await this.imageService!.stagePortableAsset({ bytes, mimeType: asset.mimeType, sha256: asset.sha256 }, operationId);
        staged.push(stagedAsset);
        stagedByHash.set(asset.sha256, stagedAsset);
        this.writeOperationMarker(operationId, 'pending', staged.map(item => item.blobId));
        await this.dbProvider.flushPendingWrites();
      }
      const references = new Map([...stagedByHash.entries()].map(([hash, asset]) => [hash, asset.reference]));
      await this.dbProvider.runInTransaction(async () => {
        for (const incoming of plan.added) this.saveIncoming(incoming, undefined, this.resolveDefinition(incoming.definition, references));
        for (const entry of plan.conflicts) {
          if (conflict === 'keep') continue;
          const definition = this.resolveDefinition(entry.incoming.definition, references);
          if (conflict === 'copy') this.saveIncoming({ ...entry.incoming, portableId: crypto.randomUUID() }, undefined, definition);
          else this.saveIncoming(entry.incoming, entry.local, definition);
        }
      });
      committed = true;
      this.writeOperationMarker(operationId, 'committed', staged.map(item => item.blobId));
      await this.dbProvider.flushPendingWrites();
      this.deleteOperationMarker(operationId);
      await this.dbProvider.flushPendingWrites();
    } catch (error) {
      if (!committed) {
        for (const asset of staged) {
          try { await this.imageService?.cleanupStagedAsset(asset); } catch { /* Recovery will retry cleanup from the marker. */ }
        }
        this.deleteOperationMarker(operationId);
        await this.dbProvider.flushPendingWrites().catch(() => undefined);
      }
      throw error;
    }
  }

  private assertPlanFresh(plan: IrpwItemImportPlan): void {
    const current = new Map(this.catalog.getItems(true).filter(item => item.portableId).map(item => [item.portableId!, item]));
    for (const incoming of plan.document.items) {
      const actual = current.get(incoming.portableId);
      const wasAdded = plan.added.some(item => item.portableId === incoming.portableId);
      const wasEquivalent = plan.equivalent.some(item => item.portableId === incoming.portableId);
      const conflict = plan.conflicts.find(item => item.incoming.portableId === incoming.portableId);
      if (wasAdded && actual) throw new Error('O catálogo mudou desde a prévia. Valide a importação novamente.');
      if (wasEquivalent && (!actual || comparableDefinition(actual.definition) !== comparableDefinition(incoming.definition) || actual.name !== incoming.name || actual.description !== incoming.description)) throw new Error('O catálogo mudou desde a prévia. Valide a importação novamente.');
      if (conflict && (!actual || actual.revision !== conflict.local.revision || comparableDefinition(actual.definition) !== comparableDefinition(conflict.local.definition) || actual.name !== conflict.local.name || actual.description !== conflict.local.description)) throw new Error('O catálogo mudou desde a prévia. Valide a importação novamente.');
    }
  }

  private saveIncoming(incoming: IrpwItemPackageItem, local?: IrpwCatalogItem, definition = incoming.definition): void {
    this.catalog.saveItem({
      id: local?.id ?? '',
      name: incoming.name,
      description: incoming.description,
      concept: incoming.concept,
      definition,
      portableId: local?.portableId ?? incoming.portableId,
      revision: Math.max(incoming.revision, local?.revision ?? 0),
      archived: local?.archived ?? 0,
      effects: local?.effects ?? null,
      definitionJson: null,
    });
  }

  private async toPortableDefinition(definition: IrpwItemDefinition, assets: Map<string, IrpwItemPackageAsset>): Promise<IrpwItemDefinition> {
    const normalized = normalizeIrpwItemDefinition(definition);
    const reference = normalized.imageReference;
    if (!reference && normalized.imageAssetSha256) throw new Error('O item possui hash de imagem, mas não possui referência local para leitura. Escolha exportar sem imagens para continuar.');
    if (!reference) return normalized;
    if (!this.imageService || !reference.startsWith('lorekit-asset://')) throw new Error('A imagem do item não está disponível para exportação. Escolha exportar somente com ícones para continuar.');
    const asset = await this.imageService.readAsset(reference);
    if (asset.mimeType !== 'image/png' && asset.mimeType !== 'image/jpeg' && asset.mimeType !== 'image/webp') throw new Error('A imagem do item usa um formato não suportado pelo pacote.');
    if (asset.bytes.byteLength > 2 * 1024 * 1024) throw new Error('Cada imagem exportada deve ter no máximo 2 MiB.');
    const dimensions = readImageDimensions(asset.bytes, asset.mimeType);
    if (dimensions && (dimensions.width > 4096 || dimensions.height > 4096)) throw new Error('A imagem do item excede 4096 x 4096 pixels.');
    if (!assets.has(asset.sha256)) assets.set(asset.sha256, { sha256: asset.sha256, mimeType: asset.mimeType, base64: encodeBase64(asset.bytes), ...(dimensions ?? {}) });
    return { ...normalized, imageReference: `${PORTABLE_ASSET_PREFIX}${asset.sha256}`, imageAssetSha256: asset.sha256 };
  }

  private resolveDefinition(definition: IrpwItemDefinition, references: Map<string, string | undefined>): IrpwItemDefinition {
    const normalized = normalizeIrpwItemDefinition(definition);
    const hash = imageHash(normalized.imageReference) ?? normalized.imageAssetSha256;
    if (!hash) return normalized;
    const reference = references.get(hash);
    if (!reference) throw new Error(`A imagem ${hash} não foi encontrada no pacote. Nenhum item foi aplicado.`);
    return { ...normalized, imageReference: reference, imageAssetSha256: hash };
  }

  private writeOperationMarker(operationId: string, state: 'pending' | 'committed', assetIds: string[]): void {
    this.dbProvider.getDb().run(
      `INSERT INTO "_AssetOperations" ("operationId", "state", "assetIds", "createdAt") VALUES (?, ?, ?, ?)
       ON CONFLICT("operationId") DO UPDATE SET "state" = excluded."state", "assetIds" = excluded."assetIds"`,
      [operationId, state, JSON.stringify(assetIds), new Date().toISOString()],
    );
    this.dbProvider.requestPersist();
  }

  private deleteOperationMarker(operationId: string): void {
    this.dbProvider.getDb().run(`DELETE FROM "_AssetOperations" WHERE "operationId" = ?`, [operationId]);
    this.dbProvider.requestPersist();
  }

  private parseAssets(raw: unknown[]): IrpwItemPackageAsset[] {
    const seen = new Set<string>();
    let totalBytes = 0;
    return raw.map(asset => {
      if (!asset || typeof asset !== 'object') throw new Error('O pacote contém um recurso de imagem inválido.');
      const value = asset as Partial<IrpwItemPackageAsset>;
      const hash = String(value.sha256 ?? '').toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(hash) || seen.has(hash)) throw new Error('O pacote contém hashes de imagem inválidos ou duplicados.');
      if (value.mimeType !== 'image/png' && value.mimeType !== 'image/jpeg' && value.mimeType !== 'image/webp') throw new Error('O pacote contém um formato de imagem não permitido.');
      if (typeof value.base64 !== 'string' || !value.base64 || /^(data:|https?:|file:|lorekit-)/i.test(value.base64) || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.base64)) throw new Error('Recursos de imagem devem ser base64 sem caminhos ou URLs.');
      validateRasterSignature(value.base64, value.mimeType);
      const bytes = Math.floor(value.base64.length * 3 / 4) - (value.base64.endsWith('==') ? 2 : value.base64.endsWith('=') ? 1 : 0);
      if (bytes <= 0 || bytes > 2 * 1024 * 1024) throw new Error('Cada imagem importada deve ter no máximo 2 MiB.');
      totalBytes += bytes;
      if (totalBytes > 10 * 1024 * 1024) throw new Error('As imagens importadas devem somar no máximo 10 MiB.');
      if (value.width !== undefined && (!Number.isInteger(value.width) || value.width < 1 || value.width > 4096)) throw new Error('Largura de imagem inválida.');
      if (value.height !== undefined && (!Number.isInteger(value.height) || value.height < 1 || value.height > 4096)) throw new Error('Altura de imagem inválida.');
      seen.add(hash);
      return { sha256: hash, mimeType: value.mimeType, base64: value.base64, ...(value.width === undefined ? {} : { width: value.width }), ...(value.height === undefined ? {} : { height: value.height }) } as IrpwItemPackageAsset;
    });
  }

  private parseDocument(raw: unknown): IrpwItemPackage {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('O pacote de itens é inválido.');
    const value = raw as Partial<IrpwItemPackage>;
    if (value.format !== 'lorekit-ironpaw-items' || value.version !== 1 || value.system !== 'ironpaw' || !Array.isArray(value.items) || !Array.isArray(value.assets)) throw new Error('Formato, versão ou recursos do pacote não são suportados.');
    if (value.items.length > 500) throw new Error('O pacote excede o limite de 500 itens.');
    const assets = this.parseAssets(value.assets);
    const seen = new Set<string>();
    const items = value.items.map(item => {
      if (!item || typeof item !== 'object' || typeof item.portableId !== 'string' || !item.portableId || seen.has(item.portableId) || typeof item.name !== 'string' || typeof item.description !== 'string') throw new Error('O pacote contém uma definição inválida ou identidade duplicada.');
      seen.add(item.portableId);
      const definition = normalizeIrpwItemDefinition(item.definition ?? {});
      const errors = validateIrpwItemDefinition(definition);
      if (errors.length) throw new Error(`Item "${item.name}": ${errors.join(' ')}`);
      const assetHash = imageHash(definition.imageReference);
      if (definition.imageReference && !assetHash) throw new Error(`Item "${item.name}": referências locais de imagem não são permitidas no pacote.`);
      if (assetHash && !assets.some(asset => asset.sha256 === assetHash)) throw new Error(`Item "${item.name}": a imagem ${assetHash} não foi incluída no pacote.`);
      return { portableId: item.portableId, revision: Number.isInteger(item.revision) && item.revision > 0 ? item.revision : 1, name: item.name, description: item.description, concept: item.concept ?? null, definition: assetHash ? { ...definition, imageAssetSha256: assetHash } : definition };
    });
    return { format: 'lorekit-ironpaw-items', version: 1, system: 'ironpaw', package: value.package ?? { id: crypto.randomUUID(), name: 'Importação Ironpaw' }, items, assets };
  }
}

function imageHash(reference: string | null | undefined): string | null {
  const match = typeof reference === 'string' ? reference.match(/^asset-sha256:([a-f0-9]{64})$/i) : null;
  return match?.[1].toLowerCase() ?? null;
}

function comparableDefinition(definition: IrpwItemDefinition): string {
  const normalized = normalizeIrpwItemDefinition(definition);
  const hash = imageHash(normalized.imageReference) ?? normalized.imageAssetSha256;
  return canonical({ ...normalized, imageReference: hash ? `${PORTABLE_ASSET_PREFIX}${hash}` : null, imageAssetSha256: hash });
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function validateRasterSignature(base64: string, mimeType: string): void {
  const bytes = new Uint8Array(decodeBase64(base64));
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid = mimeType === 'image/png'
    ? startsWith([0x89, 0x50, 0x4e, 0x47])
    : mimeType === 'image/jpeg'
      ? startsWith([0xff, 0xd8])
      : startsWith([0x52, 0x49, 0x46, 0x46]) && bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!valid) throw new Error('O recurso de imagem não corresponde ao formato raster declarado.');
}

function readImageDimensions(bytes: ArrayBuffer, mimeType: string): { width: number; height: number } | null {
  const data = new Uint8Array(bytes);
  if (mimeType === 'image/png' && data.length >= 24) {
    return { width: (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19], height: (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23] };
  }
  if (mimeType === 'image/webp' && data.length >= 30 && data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x58) {
    return { width: 1 + data[24] + (data[25] << 8) + (data[26] << 16), height: 1 + data[27] + (data[28] << 8) + (data[29] << 16) };
  }
  return null;
}

function encodeBase64(bytes: ArrayBuffer): string {
  const values = new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < values.length; index += chunkSize) binary += String.fromCharCode(...values.subarray(index, Math.min(index + chunkSize, values.length)));
  return btoa(binary);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
