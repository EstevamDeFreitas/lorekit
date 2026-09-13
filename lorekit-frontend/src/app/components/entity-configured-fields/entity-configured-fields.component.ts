import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, input, output } from '@angular/core';
import { EntityHistoryService } from '../../services/entity-history.service';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../combo-box/combo-box.component';
import { DynamicImageFieldComponent } from '../dynamic-image-field/dynamic-image-field.component';
import { EditorComponent } from '../editor/editor.component';
import { InputComponent } from '../input/input.component';
import { TextAreaComponent } from '../text-area/text-area.component';
import { MobilePinchZoomDirective } from '../../directives/mobile-pinch-zoom.directive';
import { DynamicField, DynamicFieldValue } from '../../models/dynamicfields.model';
import { UiConfigPayload, UiFieldCatalogItem, UiFieldLayoutFieldItem, UiFieldLayoutItem } from '../../models/ui-field-config.model';
import { DynamicFieldService } from '../../services/dynamic-field.service';
import { UiFieldConfigService } from '../../services/ui-field-config.service';
import { FlushableDebounce } from '../../utils/flushable-debounce';

export interface ConfigurableEntity {
  id: string;
  name: string;
}

export interface NativeFieldChange {
  key: string;
  value: string;
}

@Component({
  selector: 'app-entity-configured-fields',
  imports: [FormsModule, MobilePinchZoomDirective, InputComponent, TextAreaComponent, EditorComponent, ComboBoxComponent, DynamicImageFieldComponent],
  templateUrl: './entity-configured-fields.component.html',
  styleUrl: './entity-configured-fields.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityConfiguredFieldsComponent {
  constructor() {
    const cdr = inject(ChangeDetectorRef);
    inject(DestroyRef).onDestroy(inject(EntityHistoryService).onRestore(({ entity, field }, value) => {
      if (entity.table !== this.entityTable() || entity.id !== this.entity().id || !field.dynamicId) return;
      this.getDynamicFieldValue(field.dynamicId).value = value;
      cdr.markForCheck();
    }));
  }
  readonly entityTable = input.required<string>();
  readonly entity = input.required<ConfigurableEntity>();
  readonly layout = input.required<UiConfigPayload>();
  readonly activeTabId = input.required<string>();
  readonly nativeFieldChange = output<NativeFieldChange>();
  readonly requestSave = output<void>();

  private readonly configs = inject(UiFieldConfigService);
  private readonly dynamicFields = inject(DynamicFieldService);
  private readonly dynamicSaveTask = new FlushableDebounce(inject(DestroyRef), 220);

  catalogByToken: Record<string, UiFieldCatalogItem> = {};
  dynamicTemplatesById: Record<string, DynamicField> = {};
  dynamicValuesByFieldId: Record<string, DynamicFieldValue> = {};
  entityOptionsByFieldId: Record<string, { value: string; label: string }[]> = {};
  private stateKey = '';

  ngDoCheck(): void {
    const nextKey = `${this.entityTable()}:${this.entity().id}`;
    if (nextKey !== this.stateKey) {
      this.stateKey = nextKey;
      this.loadState();
    }
  }

  visibleItems(): UiFieldLayoutItem[] {
    const tab = this.layout().tabs.find(candidate => candidate.id === this.activeTabId()) ?? this.layout().tabs[0];
    return (tab?.items ?? []).filter(item => item.kind === 'separator' || !!this.catalogByToken[item.token]);
  }

  gridColumns(): string { return `repeat(${this.layout().columns}, minmax(0, 1fr))`; }
  gridRows(): string { return `${this.layout().rowHeight}px`; }
  gridMinHeight(): string {
    const rows = this.visibleItems().reduce((maximum, item) => Math.max(maximum, item.row + item.height), 8);
    return `${Math.max(420, rows * this.layout().rowHeight)}px`;
  }
  gridColumn(item: UiFieldLayoutItem): string { return `${item.col} / span ${item.width}`; }
  gridRow(item: UiFieldLayoutItem): string { return `${item.row} / span ${item.height}`; }
  getTokenMetadata(token: string): UiFieldCatalogItem | null { return this.catalogByToken[token] ?? null; }

  schemaValue(key: string): string {
    const value = (this.entity() as unknown as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  setSchemaValue(key: string, value: string): void {
    if (!this.isSchemaKey(key)) return;
    (this.entity() as unknown as Record<string, unknown>)[key] = value;
    this.nativeFieldChange.emit({ key, value });
    this.requestSave.emit();
  }

  setSchemaEditorValue(key: string, value: unknown): void {
    this.setSchemaValue(key, JSON.stringify(value));
  }

  dynamicTemplateByItem(item: UiFieldLayoutFieldItem): DynamicField | null {
    const metadata = this.getTokenMetadata(item.token);
    return metadata?.source === 'dynamic' ? this.dynamicTemplatesById[metadata.key] ?? null : null;
  }

  dynamicOptions(field: DynamicField): string[] {
    return (field.options ?? '').split(';').map(option => option.trim()).filter(Boolean);
  }

  getDynamicFieldValue(fieldId: string): DynamicFieldValue {
    if (!this.dynamicValuesByFieldId[fieldId]) {
      const value = new DynamicFieldValue('', '');
      value.ParentDynamicField = this.dynamicTemplatesById[fieldId];
      this.dynamicValuesByFieldId[fieldId] = value;
    }
    return this.dynamicValuesByFieldId[fieldId];
  }

  onDynamicValueChange(fieldId: string, value: string): void {
    this.getDynamicFieldValue(fieldId).value = value;
    this.saveDynamicValues();
  }

  onDynamicEditorSave(value: unknown, fieldId: string): void {
    this.getDynamicFieldValue(fieldId).value = JSON.stringify(value);
    this.saveDynamicValues();
  }

  onDynamicImageValueChange(fieldId: string, value: string): void {
    this.onDynamicValueChange(fieldId, value);
    this.dynamicSaveTask.flush();
  }

  private isSchemaKey(key: string): boolean {
    return Object.values(this.catalogByToken).some(item => item.source === 'schema' && item.key === key);
  }

  private loadState(): void {
    const table = this.entityTable();
    this.catalogByToken = Object.fromEntries(this.configs.getCatalog(table).map(item => [item.token, item]));
    this.dynamicTemplatesById = Object.fromEntries(this.dynamicFields.getDynamicFields(table).map(field => [field.id, field]));
    this.entityOptionsByFieldId = {};
    Object.values(this.dynamicTemplatesById).forEach(field => {
      if (field.fieldType === 'entity' && field.targetEntityTable) this.entityOptionsByFieldId[field.id] = this.configs.getEntityItemsForTable(field.targetEntityTable);
    });
    this.dynamicValuesByFieldId = {};
    if (!this.entity().id) return;
    this.dynamicFields.getEntityDynamicFieldsValues(table, this.entity().id).forEach(value => {
      const fieldId = value.ParentDynamicField?.id;
      if (fieldId) this.dynamicValuesByFieldId[fieldId] = value;
    });
  }

  private saveDynamicValues(): void {
    this.dynamicSaveTask.schedule(() => {
      if (!this.entity().id) return;
      const values = Object.keys(this.dynamicTemplatesById).map(fieldId => {
        const value = this.getDynamicFieldValue(fieldId);
        value.ParentDynamicField = this.dynamicTemplatesById[fieldId];
        return value;
      });
      this.dynamicFields.saveEntityDynamicFieldsValues(this.entityTable(), this.entity().id, values);
    });
  }
}
