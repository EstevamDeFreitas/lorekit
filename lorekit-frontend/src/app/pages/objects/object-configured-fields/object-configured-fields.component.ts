import { NgStyle } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { EditorComponent } from '../../../components/editor/editor.component';
import { InputComponent } from '../../../components/input/input.component';
import { DynamicField, DynamicFieldValue } from '../../../models/dynamicfields.model';
import { buildImageUrl } from '../../../models/image.model';
import { WorldObject } from '../../../models/object.model';
import { UiFieldCatalogItem, UiFieldLayoutItem } from '../../../models/ui-field-config.model';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { UiFieldConfigService } from '../../../services/ui-field-config.service';
import { ElectronSafeAPI } from '../../../database/database.helper';

@Component({
  selector: 'app-object-configured-fields',
  imports: [NgStyle, InputComponent, EditorComponent, ComboBoxComponent],
  template: `
    <div class="w-full p-1">
      @if (!visibleItems.length) {
        <div class="text-sm text-zinc-400">Nenhum campo configurado para exibir.</div>
      }

      <div class="config-grid" [ngStyle]="gridStyle()">
        @for (item of visibleItems; track item.token) {
          <div class="config-grid-item" [ngStyle]="itemStyle(item)">
            @let dynamicTemplate = dynamicTemplateByToken(item.token);
            @if (dynamicTemplate) {
              @if (dynamicTemplate.fieldType === 'image') {
                <div class="flex flex-col h-full rounded-lg border border-zinc-800 overflow-hidden">
                  <div class="flex items-center justify-between px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
                    <span class="text-xs text-zinc-300 truncate">{{ dynamicTemplate.name }}</span>
                    <label class="cursor-pointer text-zinc-400 hover:text-white transition-colors" title="Enviar imagem">
                      <i class="fa-solid fa-upload text-xs"></i>
                      <input type="file" class="hidden" accept="image/*" (change)="onDynamicImageUpload($event, dynamicTemplate.id)" />
                    </label>
                  </div>
                  <div class="flex-1 overflow-hidden min-h-0">
                    @if (getDynamicFieldValue(dynamicTemplate.id).value) {
                      <img [src]="getImageUrl(getDynamicFieldValue(dynamicTemplate.id).value)" alt="" class="w-full h-full object-cover" />
                    } @else {
                      <div class="flex items-center justify-center h-full text-zinc-500 text-xs">Nenhuma imagem</div>
                    }
                  </div>
                </div>
              }
              @else if (dynamicTemplate.fieldType === 'entity') {
                <app-combo-box
                  [label]="dynamicTemplate.name"
                  [items]="entityOptionsByFieldId[dynamicTemplate.id] || []"
                  compareProp="value"
                  displayProp="label"
                  [clearable]="true"
                  [comboValue]="getDynamicFieldValue(dynamicTemplate.id).value"
                  (comboValueChange)="onDynamicComboChange(dynamicTemplate.id, $event)">
                </app-combo-box>
              }
              @else if (dynamicTemplate.isEditorField) {
                <div class="editor-wrapper">
                  <label class="mb-1 text-xs text-white">{{ dynamicTemplate.name }}</label>
                  <app-editor [entityId]="getDynamicFieldValue(dynamicTemplate.id).id" [docTitle]="dynamicTemplate.name" entityTable="Object" [entityName]="object().name" [document]="getDynamicFieldValue(dynamicTemplate.id).value || ''" (saveDocument)="onDynamicEditorSave($event, dynamicTemplate.id)" class="rounded-lg border border-zinc-800 bg-zinc-925 h-full overflow-y-auto scrollbar-dark"></app-editor>
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
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './object-configured-fields.component.css',
})
export class ObjectConfiguredFieldsComponent {
  object = input.required<WorldObject>();

  private uiFieldConfigService = inject(UiFieldConfigService);
  private dynamicFieldService = inject(DynamicFieldService);

  catalogByToken: Record<string, UiFieldCatalogItem> = {};
  visibleItems: UiFieldLayoutItem[] = [];
  activeLayout = this.uiFieldConfigService.getResolvedConfig('Object', null);

  dynamicTemplatesById: Record<string, DynamicField> = {};
  dynamicValuesByFieldId: Record<string, DynamicFieldValue> = {};
  entityOptionsByFieldId: Record<string, { value: string; label: string }[]> = {};

  private dynamicSaveTimeout!: ReturnType<typeof setTimeout>;
  private lastObjectId = '';

  ngDoCheck(): void {
    const currentObjectId = this.object().id ?? '';
    if (currentObjectId !== this.lastObjectId) {
      this.lastObjectId = currentObjectId;
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
    const minHeight = Math.max(240, rows * rowHeight);

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

  dynamicTemplateByToken(token: string): DynamicField | null {
    const metadata = this.catalogByToken[token];
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

  onDynamicEditorSave(value: unknown, fieldId: string): void {
    const fieldValue = this.getDynamicFieldValue(fieldId);
    fieldValue.value = JSON.stringify(value);
    this.saveDynamicValues();
  }

  saveDynamicValues(): void {
    clearTimeout(this.dynamicSaveTimeout);
    this.dynamicSaveTimeout = setTimeout(() => {
      const objectId = this.object().id;
      if (!objectId) {
        return;
      }

      const values = Object.keys(this.dynamicTemplatesById).map((fieldId) => {
        const current = this.getDynamicFieldValue(fieldId);
        current.ParentDynamicField = this.dynamicTemplatesById[fieldId];
        return current;
      });

      this.dynamicFieldService.saveEntityDynamicFieldsValues('Object', objectId, values);
    }, 220);
  }

  private loadLayout(): void {
    const layout = this.uiFieldConfigService.getResolvedConfig('Object', this.object().id || null);
    const catalog = this.uiFieldConfigService.getCatalog('Object');

    this.activeLayout = layout;
    this.catalogByToken = Object.fromEntries(catalog.map((item) => [item.token, item]));
    this.visibleItems = layout.items.filter((item) => !!this.catalogByToken[item.token]);

    if (!this.visibleItems.length) {
      const fallback = this.uiFieldConfigService.getResolvedConfig('Object', null);
      this.activeLayout = fallback;
      this.visibleItems = fallback.items.filter((item) => !!this.catalogByToken[item.token]);
    }
  }

  private loadDynamicState(): void {
    this.dynamicTemplatesById = {};

    const templates = this.dynamicFieldService.getDynamicFields('Object');
    templates.forEach((template) => {
      this.dynamicTemplatesById[template.id] = template;
    });

    this.entityOptionsByFieldId = {};
    Object.values(this.dynamicTemplatesById).forEach((template) => {
      if (template.fieldType === 'entity' && template.targetEntityTable) {
        this.entityOptionsByFieldId[template.id] = this.uiFieldConfigService.getEntityItemsForTable(template.targetEntityTable);
      }
    });

    this.dynamicValuesByFieldId = {};
    const objectId = this.object().id;
    if (!objectId) {
      return;
    }

    const values = this.dynamicFieldService.getEntityDynamicFieldsValues('Object', objectId);
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

  getImageUrl(filePath: string): string {
    return buildImageUrl(filePath);
  }

  async onDynamicImageUpload(event: Event, fieldId: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const imagesDir = await ElectronSafeAPI.electron.getImagePath();
    const guid = crypto.randomUUID();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${Date.now()}-${guid}.${ext}`;
    const fullPath = `${imagesDir}/dynamic/${filename}`;

    const buffer = await file.arrayBuffer();
    await ElectronSafeAPI.electron.writeFile(fullPath, new Uint8Array(buffer));

    const fieldValue = this.getDynamicFieldValue(fieldId);
    fieldValue.value = fullPath;
    this.saveDynamicValues();
    input.value = '';
  }
}
