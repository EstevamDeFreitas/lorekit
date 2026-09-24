import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { IrpwItemDefinition, IrpwItemRecord, createEmptyItemDefinition, normalizeIrpwItemDefinition, validateIrpwItemDefinition } from '../models/irpw-item.model';

export interface IrpwCatalogItem extends IrpwItemRecord {
  definition: IrpwItemDefinition;
}

@Injectable({ providedIn: 'root' })
export class IrpwItemCatalogService {
  private readonly crud: CrudHelper;

  constructor(private readonly dbProvider: DbProvider) {
    this.crud = dbProvider.getCrudHelper();
  }

  getItems(includeArchived = false): IrpwCatalogItem[] {
    const rows = this.crud.findAll('IRPWItem') as IrpwItemRecord[];
    const baseItems = new Map((this.crud.findAll('Item') as Array<{ id: string; name: string; description: string; concept?: string | null }>).map(item => [item.id, item]));
    return rows
      .map(row => ({ ...baseItems.get(row.id), ...row, name: row.name || baseItems.get(row.id)?.name || '', description: row.description || baseItems.get(row.id)?.description || '', concept: row.concept ?? baseItems.get(row.id)?.concept ?? null }))
      .map(row => this.withDefinition(row))
      .filter(item => includeArchived || !Boolean(item.archived))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  getItem(id: string): IrpwCatalogItem | null {
    const row = this.crud.findById('IRPWItem', id) as IrpwItemRecord | null;
    if (!row) return null;
    const base = this.crud.findById('Item', id) as { name?: string; description?: string; concept?: string | null } | null;
    return this.withDefinition({ ...base, ...row, name: row.name || base?.name || '', description: row.description || base?.description || '', concept: row.concept ?? base?.concept ?? null });
  }

  saveItem(item: IrpwCatalogItem): IrpwCatalogItem {
    if (!item.name.trim()) throw new Error('Informe um nome para o item.');
    const definition = normalizeIrpwItemDefinition(item.definition);
    const errors = validateIrpwItemDefinition(definition);
    if (errors.length) throw new Error(errors.join(' '));
    const now = item.id || crypto.randomUUID();
    const row: IrpwItemRecord = {
      id: now, name: item.name.trim(), description: item.description?.trim() ?? '', concept: item.concept ?? null,
      effects: item.effects ?? null, definitionJson: JSON.stringify(definition), portableId: item.portableId || crypto.randomUUID(),
      revision: Math.max(1, Number(item.revision) || 1) + (item.id ? 1 : 0), archived: item.archived ? 1 : 0,
    };
    const base = { id: now, name: row.name, description: row.description, concept: row.concept ?? null };
    if (this.crud.findById('Item', now)) this.crud.update('Item', now, base); else this.crud.create('Item', base);
    if (this.crud.findById('IRPWItem', now)) this.crud.update('IRPWItem', now, row); else this.crud.create('IRPWItem', row);
    return this.withDefinition(row);
  }

  createDraft(category: IrpwItemDefinition['category'] = 'common'): IrpwCatalogItem {
    return { id: '', name: '', description: '', concept: null, effects: null, definitionJson: null, portableId: null, revision: 0, archived: 0, definition: createEmptyItemDefinition(category) };
  }

  duplicateItem(item: IrpwCatalogItem): IrpwCatalogItem {
    return this.saveItem({ ...item, id: '', name: `${item.name} (cópia)`, portableId: null, revision: 0, archived: 0, definition: normalizeIrpwItemDefinition(item.definition) });
  }

  archiveItem(id: string): void {
    if (!this.crud.findById('IRPWItem', id)) return;
    this.crud.update('IRPWItem', id, { archived: 1 });
  }

  private withDefinition(row: IrpwItemRecord): IrpwCatalogItem {
    let raw: unknown = {};
    try { raw = row.definitionJson ? JSON.parse(row.definitionJson) : {}; } catch { raw = {}; }
    return { ...row, definition: normalizeIrpwItemDefinition(raw as Partial<IrpwItemDefinition>) };
  }
}