import { inject, Injectable, Injector } from '@angular/core';
import { DbProvider } from '../database/db-provider.service';
import { schema } from '../database/schema';
import { HistoryAddress, HistoryField } from '../models/entity-history.model';
import { DynamicField, DynamicFieldValue } from '../models/dynamicfields.model';
import { DynamicFieldService } from './dynamic-field.service';
import { LorekitDocumentCodec } from '../components/editor/lorekit-document.codec';

export function historyValue(value: unknown, rich = false): string {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  if (!rich) return text;
  const document = LorekitDocumentCodec.deserialize(text);
  // Both engines materialize these defaults when mounted. They are not edits.
  for (const block of document.blocks) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      block.alignment ??= 'left';
      block.indent ??= 0;
    } else if (block.type === 'quote') block.alignment ??= 'left';
  }
  if (document.blocks.length === 1) {
    const block = document.blocks[0];
    if (block.type === 'paragraph' && block.content.length === 0 && block.alignment === 'left' && !block.indent) document.blocks = [];
  }
  return LorekitDocumentCodec.serialize(document);
}

export function normalizeHistoryValue(value: unknown, field: HistoryField): string {
  const text = historyValue(value, field.rich);
  return field.trim ? text.trim() : text;
}

export function parseHistoryJson(value: unknown, path: readonly (string | number)[]): unknown {
  return value ? JSON.parse(String(value)) : typeof path[0] === 'number' ? [] : {};
}

export function readHistoryPath(value: unknown, path: readonly (string | number)[]): unknown {
  let result = value;
  for (const [index, key] of path.entries()) {
    if (!result || typeof result !== 'object') return '';
    if (!(key in result) && index === path.length - 1) return '';
    if (!(key in result)) return '';
    result = (result as Record<string | number, unknown>)[key];
  }
  return result;
}

export function writeHistoryPath(value: unknown, path: readonly (string | number)[], text: string): void {
  let parent = value;
  for (let index = 0; index < path.length - 1; index++) {
    if (!parent || typeof parent !== 'object') throw new Error('O campo do histórico não existe mais.');
    const record = parent as Record<string | number, unknown>;
    const key = path[index];
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('Campo inválido.');
    record[key] ??= typeof path[index + 1] === 'number' ? [] : {};
    parent = record[key];
  }
  if (!parent || typeof parent !== 'object') throw new Error('O campo do histórico não existe mais.');
  const key = path[path.length - 1];
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('Campo inválido.');
  (parent as Record<string | number, unknown>)[key] = text;
}

/** Writes a single textual field on the current row, never an old entity snapshot. */
@Injectable({ providedIn: 'root' })
export class EntityHistoryStore {
  private readonly injector = inject(Injector);
  private get db(): DbProvider { return this.injector.get(DbProvider); }
  private get dynamic(): DynamicFieldService { return this.injector.get(DynamicFieldService); }

  read(address: HistoryAddress): string {
    const { field, entity } = address;
    this.row(address);
    if (field.dynamicId) {
      this.template(address);
      return normalizeHistoryValue(this.dynamic.getEntityDynamicFieldsValues(entity.table, entity.id)
        .find(value => value.ParentDynamicField?.id === field.dynamicId)?.value, field);
    }
    const row = this.row(address);
    const raw = row[field.column];
    return normalizeHistoryValue(field.path?.length ? readHistoryPath(parseHistoryJson(raw, field.path), field.path) : raw, field);
  }

  write(address: HistoryAddress, value: string): void {
    const { field, entity } = address;
    this.row(address);
    if (field.dynamicId) {
      const template = this.template(address);
      const current = this.dynamic.getEntityDynamicFieldsValues(entity.table, entity.id)
        .find(item => item.ParentDynamicField?.id === field.dynamicId) ?? new DynamicFieldValue();
      current.ParentDynamicField = template;
      current.value = value;
      this.dynamic.saveEntityDynamicFieldsValues(entity.table, entity.id, [current]);
      return;
    }
    const target = field.target ?? entity;
    const row = this.row(address);
    let stored = value;
    if (field.path?.length) {
      const data = parseHistoryJson(row[field.column], field.path);
      writeHistoryPath(data, field.path, value);
      stored = JSON.stringify(data);
    }
    this.db.getCrudHelper().update(target.table, target.id, { [field.column]: stored });
  }

  flush(): Promise<void> { return this.db.flushPendingWrites(); }

  private row({ entity, field }: HistoryAddress): Record<string, unknown> {
    const target = field.target ?? entity;
    const table = schema.find(item => item.name === target.table);
    if (!table || (!field.dynamicId && !table.columns.some(column => column.name === field.column && column.name !== 'id'))) {
      throw new Error('Campo de histórico inválido.');
    }
    const row: Record<string, unknown> | null = this.db.getCrudHelper().findById(target.table, target.id);
    if (!row) throw new Error('A entidade do histórico não existe mais.');
    return row;
  }

  private template({ entity, field }: HistoryAddress): DynamicField {
    const template = this.dynamic.getDynamicFields(entity.table).find(item => item.id === field.dynamicId);
    if (!template) throw new Error('O campo personalizado não existe mais.');
    return template;
  }
}
