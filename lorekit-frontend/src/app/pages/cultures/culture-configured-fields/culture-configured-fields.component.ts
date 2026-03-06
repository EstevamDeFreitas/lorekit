import { NgStyle } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { EditorComponent } from '../../../components/editor/editor.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { Culture } from '../../../models/culture.model';
import { DynamicField, DynamicFieldValue } from '../../../models/dynamicfields.model';
import { UiFieldCatalogItem, UiFieldLayoutItem } from '../../../models/ui-field-config.model';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { UiFieldConfigService } from '../../../services/ui-field-config.service';

@Component({
  selector: 'app-culture-configured-fields',
  imports: [NgStyle, FormsModule, InputComponent, EditorComponent, TextAreaComponent, ComboBoxComponent],
  template: `
    <div class="w-full p-1">
      <div class="config-grid" [ngStyle]="gridStyle()">
        @for (item of visibleItems; track item.token) {
          <div class="config-grid-item" [ngStyle]="itemStyle(item)">
            @let metadata = getTokenMetadata(item.token);
            @if (metadata) {
              @if (metadata.source === 'schema') {
                @switch (metadata.key) {
                  @case ('values') {
                    <app-input [label]="metadata.label" [(value)]="culture().values" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('technologyLevel') {
                    <app-input [label]="metadata.label" [(value)]="culture().technologyLevel" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('language') {
                    <app-input [label]="metadata.label" [(value)]="culture().language" (valueChange)="requestSave.emit()"></app-input>
                  }
                  @case ('concept') {
                    <app-text-area [label]="metadata.label" [(value)]="culture().concept" (valueChange)="requestSave.emit()"></app-text-area>
                  }
                  @case ('traditions') {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ metadata.label }}</label>
                      <app-editor [entityId]="culture().id" [docTitle]="metadata.label" entityTable="Culture" [entityName]="culture().name" [document]="culture().traditions || ''" (saveDocument)="onSchemaEditorSave($event, 'traditions')" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
                    </div>
                  }
                  @case ('socialStructure') {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ metadata.label }}</label>
                      <app-editor [entityId]="culture().id" [docTitle]="metadata.label" entityTable="Culture" [entityName]="culture().name" [document]="culture().socialStructure || ''" (saveDocument)="onSchemaEditorSave($event, 'socialStructure')" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
                    </div>
                  }
                  @case ('beliefSystems') {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ metadata.label }}</label>
                      <app-editor [entityId]="culture().id" [docTitle]="metadata.label" entityTable="Culture" [entityName]="culture().name" [document]="culture().beliefSystems || ''" (saveDocument)="onSchemaEditorSave($event, 'beliefSystems')" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
                    </div>
                  }
                  @case ('culinaryPractices') {
                    <div class="editor-wrapper">
                      <label class="mb-1 text-xs text-white">{{ metadata.label }}</label>
                      <app-editor [entityId]="culture().id" [docTitle]="metadata.label" entityTable="Culture" [entityName]="culture().name" [document]="culture().culinaryPractices || ''" (saveDocument)="onSchemaEditorSave($event, 'culinaryPractices')" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
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
                      <app-editor [entityId]="getDynamicFieldValue(dynamicTemplate.id).id" [docTitle]="dynamicTemplate.name" entityTable="Culture" [entityName]="culture().name" [document]="getDynamicFieldValue(dynamicTemplate.id).value || ''" (saveDocument)="onDynamicEditorSave($event, dynamicTemplate.id)" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
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
  styleUrl: './culture-configured-fields.component.css',
})
export class CultureConfiguredFieldsComponent {
  culture = input.required<Culture>();
  requestSave = output<void>();

  private uiFieldConfigService = inject(UiFieldConfigService);
  private dynamicFieldService = inject(DynamicFieldService);

  catalogByToken: Record<string, UiFieldCatalogItem> = {};
  visibleItems: UiFieldLayoutItem[] = [];
  activeLayout = this.uiFieldConfigService.getResolvedConfig('Culture', null);

  dynamicTemplatesById: Record<string, DynamicField> = {};
  dynamicValuesByFieldId: Record<string, DynamicFieldValue> = {};

  private dynamicSaveTimeout!: ReturnType<typeof setTimeout>;
  private lastCultureId = '';

  ngDoCheck(): void {
    const currentCultureId = this.culture().id ?? '';
    if (currentCultureId !== this.lastCultureId) {
      this.lastCultureId = currentCultureId;
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

  onSchemaEditorSave(value: unknown, key: 'traditions' | 'socialStructure' | 'beliefSystems' | 'culinaryPractices'): void {
    this.culture()[key] = JSON.stringify(value) as string;
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
      const cultureId = this.culture().id;
      if (!cultureId) {
        return;
      }

      const values = Object.keys(this.dynamicTemplatesById).map((fieldId) => {
        const current = this.getDynamicFieldValue(fieldId);
        current.ParentDynamicField = this.dynamicTemplatesById[fieldId];
        return current;
      });

      this.dynamicFieldService.saveEntityDynamicFieldsValues('Culture', cultureId, values);
    }, 220);
  }

  private loadLayout(): void {
    const layout = this.uiFieldConfigService.getResolvedConfig('Culture', this.culture().id || null);
    const catalog = this.uiFieldConfigService.getCatalog('Culture');

    this.activeLayout = layout;
    this.catalogByToken = Object.fromEntries(catalog.map((item) => [item.token, item]));
    this.visibleItems = layout.items.filter((item) => !!this.catalogByToken[item.token]);

    if (!this.visibleItems.length) {
      const fallback = this.uiFieldConfigService.getResolvedConfig('Culture', null);
      this.activeLayout = fallback;
      this.visibleItems = fallback.items.filter((item) => !!this.catalogByToken[item.token]);
    }
  }

  private loadDynamicState(): void {
    this.dynamicTemplatesById = {};

    const templates = this.dynamicFieldService.getDynamicFields('Culture');
    templates.forEach((template) => {
      this.dynamicTemplatesById[template.id] = template;
    });

    this.dynamicValuesByFieldId = {};
    const cultureId = this.culture().id;
    if (!cultureId) {
      return;
    }

    const values = this.dynamicFieldService.getEntityDynamicFieldsValues('Culture', cultureId);
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
