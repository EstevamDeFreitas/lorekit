import { NgStyle } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { EditorComponent } from '../../../components/editor/editor.component';
import { InputComponent } from '../../../components/input/input.component';
import { DynamicField, DynamicFieldValue } from '../../../models/dynamicfields.model';
import { Specie } from '../../../models/specie.model';
import { UiFieldCatalogItem, UiFieldLayoutItem } from '../../../models/ui-field-config.model';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { UiFieldConfigService } from '../../../services/ui-field-config.service';

@Component({
  selector: 'app-specie-configured-fields',
  imports: [NgStyle, FormsModule, InputComponent, EditorComponent, ComboBoxComponent],
  template: `
    <div class="w-full p-1">
      <div class="config-grid" [ngStyle]="gridStyle()">
        @for (item of visibleItems; track item.token) {
          <div class="config-grid-item" [ngStyle]="itemStyle(item)">
            @let metadata = getTokenMetadata(item.token);
            @if (metadata) {
              @if (metadata.source === 'schema') {
                @switch (metadata.key) {
                  @case ('classification') {
                    <app-input [label]="metadata.label" [(value)]="specie().classification" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('diet') {
                    <app-input [label]="metadata.label" [(value)]="specie().diet" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('averageLifespan') {
                    <app-input [label]="metadata.label" [(value)]="specie().averageLifespan" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('averageHeight') {
                    <app-input [label]="metadata.label" [(value)]="specie().averageHeight" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('averageWeight') {
                    <app-input [label]="metadata.label" [(value)]="specie().averageWeight" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('physicalCharacteristics') {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ metadata.label }}</label>
                      <app-editor [entityId]="specie().id" [docTitle]="metadata.label" entityTable="Species" [entityName]="specie().name" [document]="specie().physicalCharacteristics || ''" (saveDocument)="onSchemaEditorSave($event, 'physicalCharacteristics')" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
                    </div>
                  }
                  @case ('behavioralCharacteristics') {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ metadata.label }}</label>
                      <app-editor [entityId]="specie().id" [docTitle]="metadata.label" entityTable="Species" [entityName]="specie().name" [document]="specie().behavioralCharacteristics || ''" (saveDocument)="onSchemaEditorSave($event, 'behavioralCharacteristics')" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
                    </div>
                  }
                }
              }
              @else {
                @let dynamicTemplate = dynamicTemplateByToken(item.token);
                @if (dynamicTemplate) {
                  @if (dynamicTemplate.isEditorField) {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ dynamicTemplate.name }}</label>
                      <app-editor [entityId]="getDynamicFieldValue(dynamicTemplate.id).id" [docTitle]="dynamicTemplate.name" entityTable="Species" [entityName]="specie().name" [document]="getDynamicFieldValue(dynamicTemplate.id).value || ''" (saveDocument)="onDynamicEditorSave($event, dynamicTemplate.id)" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
                    </div>
                  }
                  @else if (dynamicTemplate.options) {
                    <app-combo-box
                      [label]="dynamicTemplate.name"
                      [items]="dynamicOptions(dynamicTemplate)"
                      [clearable]="true"
                      [comboValue]="getDynamicFieldValue(dynamicTemplate.id).value"
                      (comboValueChange)="onDynamicComboChange(dynamicTemplate.id, $event)">
                    </app-combo-box>
                  }
                  @else {
                    <app-input
                      [label]="dynamicTemplate.name"
                      [value]="getDynamicFieldValue(dynamicTemplate.id).value"
                      (valueChange)="onDynamicTextChange(dynamicTemplate.id, $event)">
                    </app-input>
                  }
                }
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './specie-configured-fields.component.css',
})
export class SpecieConfiguredFieldsComponent {
  specie = input.required<Specie>();
  requestSave = output<void>();

  private uiFieldConfigService = inject(UiFieldConfigService);
  private dynamicFieldService = inject(DynamicFieldService);

  catalogByToken: Record<string, UiFieldCatalogItem> = {};
  visibleItems: UiFieldLayoutItem[] = [];
  activeLayout = this.uiFieldConfigService.getResolvedConfig('Species', null);

  dynamicTemplatesById: Record<string, DynamicField> = {};
  dynamicValuesByFieldId: Record<string, DynamicFieldValue> = {};

  private dynamicSaveTimeout!: ReturnType<typeof setTimeout>;
  private lastSpecieId = '';

  ngDoCheck(): void {
    const currentSpecieId = this.specie().id ?? '';
    if (currentSpecieId !== this.lastSpecieId) {
      this.lastSpecieId = currentSpecieId;
      this.loadLayout();
      this.loadDynamicState();
      return;
    }

    if (!Object.keys(this.catalogByToken).length) {
      this.loadLayout();
    }
  }

  gridStyle(): Record<string, string> {
    const rowHeight = this.activeLayout.rowHeight;
    const rows = this.visibleItems.reduce((acc, item) => Math.max(acc, item.row + item.height), 8);
    const minHeight = Math.max(420, rows * rowHeight);

    return {
      gridTemplateColumns: `repeat(${this.activeLayout.columns}, minmax(0, 1fr))`,
      gridAutoRows: `${rowHeight}px`,
      minHeight: `${minHeight}px`,
    };
  }

  itemStyle(item: UiFieldLayoutItem): Record<string, string> {
    return {
      gridColumn: `${item.col} / span ${item.width}`,
      gridRow: `${item.row} / span ${item.height}`,
    };
  }

  getTokenMetadata(token: string): UiFieldCatalogItem | null {
    return this.catalogByToken[token] ?? null;
  }

  dynamicTemplateByToken(token: string): DynamicField | null {
    const metadata = this.getTokenMetadata(token);
    if (!metadata || metadata.source !== 'dynamic') {
      return null;
    }

    return this.dynamicTemplatesById[metadata.key] ?? null;
  }

  dynamicOptions(field: DynamicField): string[] {
    const options = field.options ?? '';
    if (!options) {
      return [];
    }

    return options.split(';').map((option) => option.trim()).filter((option) => option.length > 0);
  }

  getDynamicFieldValue(fieldId: string): DynamicFieldValue {
    if (!this.dynamicValuesByFieldId[fieldId]) {
      this.dynamicValuesByFieldId[fieldId] = new DynamicFieldValue('', '');
      this.dynamicValuesByFieldId[fieldId].ParentDynamicField = this.dynamicTemplatesById[fieldId];
    }

    return this.dynamicValuesByFieldId[fieldId];
  }

  onSchemaEditorSave(value: unknown, key: 'physicalCharacteristics' | 'behavioralCharacteristics'): void {
    this.specie()[key] = JSON.stringify(value) as never;
    this.requestSave.emit();
  }

  onDynamicEditorSave(value: unknown, fieldId: string): void {
    const fieldValue = this.getDynamicFieldValue(fieldId);
    fieldValue.value = JSON.stringify(value);
    this.saveDynamicValues();
  }

  saveDynamicValues(): void {
    clearTimeout(this.dynamicSaveTimeout);
    this.dynamicSaveTimeout = setTimeout(() => {
      const specieId = this.specie().id;
      if (!specieId) {
        return;
      }

      const values = Object.keys(this.dynamicTemplatesById).map((fieldId) => {
        const current = this.getDynamicFieldValue(fieldId);
        current.ParentDynamicField = this.dynamicTemplatesById[fieldId];
        return current;
      });

      this.dynamicFieldService.saveEntityDynamicFieldsValues('Species', specieId, values);
    }, 220);
  }

  private loadLayout(): void {
    const layout = this.uiFieldConfigService.getResolvedConfig('Species', this.specie().id || null);
    const catalog = this.uiFieldConfigService.getCatalog('Species');

    this.activeLayout = layout;
    this.catalogByToken = Object.fromEntries(catalog.map((item) => [item.token, item]));
    this.visibleItems = layout.items.filter((item) => !!this.catalogByToken[item.token]);

    if (!this.visibleItems.length) {
      const fallback = this.uiFieldConfigService.getResolvedConfig('Species', null);
      this.activeLayout = fallback;
      this.visibleItems = fallback.items.filter((item) => !!this.catalogByToken[item.token]);
    }
  }

  private loadDynamicState(): void {
    this.dynamicTemplatesById = {};

    const templates = this.dynamicFieldService.getDynamicFields('Species');
    templates.forEach((template) => {
      this.dynamicTemplatesById[template.id] = template;
    });

    this.dynamicValuesByFieldId = {};
    const specieId = this.specie().id;
    if (!specieId) {
      return;
    }

    const values = this.dynamicFieldService.getEntityDynamicFieldsValues('Species', specieId);
    values.forEach((value) => {
      const fieldId = value.ParentDynamicField?.id;
      if (!fieldId) {
        return;
      }
      this.dynamicValuesByFieldId[fieldId] = value;
    });
  }

  onDynamicTextChange(fieldId: string, value: string): void {
    const current = this.getDynamicFieldValue(fieldId);
    current.value = value;
    this.saveDynamicValues();
  }

  onDynamicComboChange(fieldId: string, value: string): void {
    const current = this.getDynamicFieldValue(fieldId);
    current.value = value;
    this.saveDynamicValues();
  }
}
