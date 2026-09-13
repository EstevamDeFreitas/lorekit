export interface HistoryEntity {
  table: string;
  id: string;
}

export interface HistoryField {
  column: string;
  label?: string;
  dynamicId?: string;
  path?: readonly (string | number)[];
  target?: HistoryEntity;
  rich?: boolean;
  trim?: boolean;
}

export interface HistoryAddress {
  entity: HistoryEntity;
  field: HistoryField;
}

export type HistoryEditKind = 'typing' | 'paste' | 'format' | 'composition' | 'change';

export interface HistoryStep extends HistoryAddress {
  before: string;
  after: string;
  kind: HistoryEditKind;
  time: number;
  group: number;
}

export function historyEntityKey(entity: HistoryEntity): string {
  return JSON.stringify([entity.table, entity.id]);
}

export function historyFieldKey(field: HistoryField): string {
  return JSON.stringify([field.target?.table, field.target?.id, field.column, field.dynamicId, field.path]);
}
