import { ChangeDetectionStrategy, Component, inject, input, OnChanges, output, SimpleChanges } from '@angular/core';
import { CdkOverlayOrigin, ConnectedPosition, Overlay, OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { ListColumn, ListColumnType, ListFieldOptions, ListFieldValue, parseListValue, serializeListValue } from '../../models/dynamicfields.model';

type ListRow = Record<string, string | number | boolean>;

@Component({
  selector: 'app-dynamic-list-field',
  imports: [FormsModule, OverlayModule, A11yModule],
  templateUrl: './dynamic-list-field.component.html',
  styleUrl: './dynamic-list-field.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicListFieldComponent implements OnChanges {
  readonly editorScrollStrategy = inject(Overlay).scrollStrategies.reposition();
  readonly editorPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  ];
  editorOrigin!: CdkOverlayOrigin;
  readonly label = input.required<string>();
  readonly labelColor = input<string | null>(null);
  readonly config = input.required<ListFieldOptions>();
  readonly value = input<string>('');
  readonly valueChange = output<string>();

  tableRows: ListRow[] = [];
  headlessItems: string[] = [];
  editingIndex: number | null = null;
  draftRow: ListRow | null = null;
  draftItem = '';
  errorMessage = '';

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.editingIndex !== null) return;
    this.syncFromValue();
  }

  mode(): 'table' | 'headless' { return this.config().mode; }
  columns(): ListColumn[] { return this.config().columns; }

  startNewRow(origin: CdkOverlayOrigin): void {
    this.editorOrigin = origin;
    this.editingIndex = -1;
    this.draftRow = Object.fromEntries(this.columns().map(column => [column.id, this.emptyValue(column.type)]));
    this.errorMessage = '';
  }

  editRow(index: number, origin: CdkOverlayOrigin): void {
    this.editorOrigin = origin;
    this.editingIndex = index;
    this.draftRow = { ...this.tableRows[index] };
    this.errorMessage = '';
  }

  startNewHeadlessItem(): void {
    this.editingIndex = -1;
    this.draftItem = '';
    this.errorMessage = '';
  }

  editHeadlessItem(index: number): void {
    this.editingIndex = index;
    this.draftItem = this.headlessItems[index] ?? '';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    this.editingIndex = null;
    this.draftRow = null;
    this.draftItem = '';
    this.errorMessage = '';
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.cancelEdit();
  }

  saveRow(): void {
    if (!this.draftRow || !this.isValidRow(this.draftRow)) return;
    const row = this.normalizeRow(this.draftRow);
    if (this.editingIndex === -1) this.tableRows = [...this.tableRows, row];
    else if (this.editingIndex !== null) this.tableRows = this.tableRows.map((item, index) => index === this.editingIndex ? row : item);
    this.emitTableValue();
    this.cancelEdit();
  }

  saveHeadlessItem(): void {
    const item = this.draftItem.trim();
    if (!item) {
      this.errorMessage = 'Informe um item.';
      return;
    }
    if (this.editingIndex === -1) this.headlessItems = [...this.headlessItems, item];
    else if (this.editingIndex !== null) this.headlessItems = this.headlessItems.map((current, index) => index === this.editingIndex ? item : current);
    this.emitHeadlessValue();
    this.cancelEdit();
  }

  setDraftValue(column: ListColumn, value: unknown): void {
    if (!this.draftRow) return;
    this.draftRow = { ...this.draftRow, [column.id]: value as string | number | boolean };
    this.errorMessage = '';
  }

  draftInputValue(column: ListColumn): string | number { return String(this.draftRow?.[column.id] ?? ''); }
  draftBooleanValue(column: ListColumn): boolean { return this.draftRow?.[column.id] === true; }
  inputType(type: ListColumnType): string { return type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'; }

  displayValue(value: string | number | boolean, type: ListColumnType): string {
    if (type === 'boolean') return value ? 'Sim' : 'Não';
    return String(value ?? '');
  }

  moveRow(index: number, direction: -1 | 1): void {
    const items = this.mode() === 'table' ? [...this.tableRows] : [...this.headlessItems];
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    if (this.mode() === 'table') {
      this.tableRows = items as ListRow[];
      this.emitTableValue();
    } else {
      this.headlessItems = items as string[];
      this.emitHeadlessValue();
    }
  }

  removeRow(index: number): void {
    if (this.mode() === 'table') {
      this.tableRows = this.tableRows.filter((_item, currentIndex) => currentIndex !== index);
      this.emitTableValue();
    } else {
      this.headlessItems = this.headlessItems.filter((_item, currentIndex) => currentIndex !== index);
      this.emitHeadlessValue();
    }
    this.cancelEdit();
  }

  private syncFromValue(): void {
    const parsed = parseListValue(this.value(), this.config());
    if (this.mode() === 'table') {
      this.tableRows = parsed.items as ListRow[];
      this.headlessItems = [];
    } else {
      this.headlessItems = parsed.items as string[];
      this.tableRows = [];
    }
  }

  private emptyValue(type: ListColumnType): string | number | boolean { return type === 'number' ? 0 : type === 'boolean' ? false : ''; }

  private normalizeRow(row: ListRow): ListRow {
    return Object.fromEntries(this.columns().map(column => {
      const raw = row[column.id];
      if (column.type === 'number') return [column.id, Number(raw)];
      if (column.type === 'boolean') return [column.id, raw === true || raw === 'true'];
      return [column.id, String(raw ?? '')];
    }));
  }

  private isValidRow(row: ListRow): boolean {
    for (const column of this.columns()) {
      if (column.type === 'number' && !Number.isFinite(Number(row[column.id]))) {
        this.errorMessage = `O campo "${column.label}" precisa ser numerico.`;
        return false;
      }
      if (column.type === 'date' && row[column.id] && !/^\d{4}-\d{2}-\d{2}$/.test(String(row[column.id]))) {
        this.errorMessage = `A data de "${column.label}" e invalida.`;
        return false;
      }
    }
    this.errorMessage = '';
    return true;
  }

  private emitTableValue(): void { this.valueChange.emit(serializeListValue({ items: this.tableRows } satisfies ListFieldValue)); }
  private emitHeadlessValue(): void { this.valueChange.emit(serializeListValue({ items: this.headlessItems } satisfies ListFieldValue)); }
}
