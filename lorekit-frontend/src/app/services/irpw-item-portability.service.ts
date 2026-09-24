import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { IrpwItemDefinition, normalizeIrpwItemDefinition, validateIrpwItemDefinition } from '../models/irpw-item.model';
import { IrpwCatalogItem, IrpwItemCatalogService } from './irpw-item-catalog.service';

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

@Injectable({ providedIn: 'root' })
export class IrpwItemPortabilityService {
  constructor(private readonly dbProvider: DbProvider, private readonly catalog: IrpwItemCatalogService) {}

  exportItems(items: IrpwCatalogItem[], packageName = 'Itens Ironpaw'): IrpwItemPackage {
    return {
      format: 'lorekit-ironpaw-items', version: 1, system: 'ironpaw',
      package: { id: crypto.randomUUID(), name: packageName }, assets: [],
      items: items.map(item => ({
        portableId: item.portableId || crypto.randomUUID(), revision: Math.max(1, item.revision || 1),
        name: item.name, description: item.description, concept: item.concept ?? null,
        definition: normalizeIrpwItemDefinition(item.definition),
      })),
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
      else if (canonical(existing.definition) === canonical(incoming.definition) && existing.name === incoming.name && existing.description === incoming.description) equivalent.push(incoming);
      else conflicts.push({ incoming, local: existing });
    }
    return { document, added, equivalent, conflicts };
  }

  async applyImport(plan: IrpwItemImportPlan, conflict: 'keep' | 'update' | 'copy' = 'update'): Promise<void> {
    if (plan.document.assets.length) throw new Error('O pacote contém imagens válidas, mas o staging de assets ainda não está disponível nesta versão. Nenhuma alteração foi aplicada.');
    this.assertPlanFresh(plan);
    await this.dbProvider.runInTransaction(async () => {
      for (const incoming of plan.added) this.saveIncoming(incoming);
      for (const entry of plan.conflicts) {
        if (conflict === 'keep') continue;
        if (conflict === 'copy') this.saveIncoming({ ...entry.incoming, portableId: crypto.randomUUID() });
        else this.saveIncoming(entry.incoming, entry.local);
      }
    });
  }

  private assertPlanFresh(plan: IrpwItemImportPlan): void {
    const current = new Map(this.catalog.getItems(true).filter(item => item.portableId).map(item => [item.portableId!, item]));
    for (const incoming of plan.document.items) {
      const actual = current.get(incoming.portableId);
      const wasAdded = plan.added.some(item => item.portableId === incoming.portableId);
      const wasEquivalent = plan.equivalent.some(item => item.portableId === incoming.portableId);
      const conflict = plan.conflicts.find(item => item.incoming.portableId === incoming.portableId);
      if (wasAdded && actual) throw new Error('O catálogo mudou desde a prévia. Valide a importação novamente.');
      if (wasEquivalent && (!actual || canonical(actual.definition) !== canonical(incoming.definition) || actual.name !== incoming.name || actual.description !== incoming.description)) throw new Error('O catálogo mudou desde a prévia. Valide a importação novamente.');
      if (conflict && (!actual || actual.revision !== conflict.local.revision || canonical(actual.definition) !== canonical(conflict.local.definition) || actual.name !== conflict.local.name || actual.description !== conflict.local.description)) throw new Error('O catálogo mudou desde a prévia. Valide a importação novamente.');
    }
  }

  private saveIncoming(incoming: IrpwItemPackageItem, local?: IrpwCatalogItem): void {
    const record: IrpwCatalogItem = {
      id: local?.id ?? '', name: incoming.name, description: incoming.description, concept: incoming.concept,
      definition: incoming.definition, portableId: local?.portableId ?? incoming.portableId, revision: Math.max(incoming.revision, local?.revision ?? 0), archived: local?.archived ?? 0,
    };
    this.catalog.saveItem(record);
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
      return { portableId: item.portableId, revision: Number.isInteger(item.revision) && item.revision > 0 ? item.revision : 1, name: item.name, description: item.description, concept: item.concept ?? null, definition };
    });
    return { format: 'lorekit-ironpaw-items', version: 1, system: 'ironpaw', package: value.package ?? { id: crypto.randomUUID(), name: 'Importação Ironpaw' }, items, assets };
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
