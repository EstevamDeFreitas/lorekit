import { NgStyle } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { UiConfigPayload, UiFieldCatalogItem, UiFieldLayoutItem } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';
import { DbProvider } from '../../../app.config';
import { schema } from '../../../database/schema';
import { ButtonComponent } from '../../../components/button/button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';

interface ParentScopeOption {
  parentEntityTable: string;
  parentEntityId: string;
  label: string;
}

interface ParentEntityItem {
  id: string;
  label: string;
}

interface SelectOptionItem {
  value: string;
  label: string;
}

@Component({
  selector: 'app-ui-field-config-editor',
  imports: [NgStyle, ButtonComponent, IconButtonComponent, ComboBoxComponent],
  template: `
    <div class="p-4 md:p-6 flex flex-col gap-4">
      <div class="flex flex-row items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 class="text-xl font-semibold text-white">Configurar Layout de Campos</h1>
          <p class="text-sm text-zinc-400">Arraste campos para o grid e redimensione pelas bordas.</p>
        </div>
        @if (isDialogMode) {
          <app-button label="Fechar" buttonType="secondary" size="xs" (click)="closeDialog()"></app-button>
        } @else {
          <app-button label="Voltar" buttonType="secondary" size="xs" [route]="backRoute"></app-button>
        }
      </div>

      <div class="flex flex-wrap gap-4 items-end bg-zinc-900 p-3 rounded-lg border border-zinc-800">
        <app-combo-box
          class="min-w-56"
          label="Escopo"
          [items]="scopeModeItems"
          compareProp="value"
          displayProp="label"
          [(comboValue)]="scopeMode">
        </app-combo-box>

        @if (scopeMode === 'parent' && parentScopeOptions.length > 0) {
          <app-combo-box
            class="min-w-72"
            label="Pai"
            [items]="parentScopeItems"
            compareProp="value"
            displayProp="label"
            [(comboValue)]="selectedParentScopeKey">
          </app-combo-box>
        }

        @if (scopeMode === 'parent' && allowParentSelection) {
          <app-combo-box
            class="min-w-48"
            label="Tabela Pai"
            [items]="parentSelectableTables"
            [comboValue]="selectedParentTable"
            (comboValueChange)="onParentTableChange($event)">
          </app-combo-box>

          <app-combo-box
            class="min-w-72"
            label="Entidade Pai"
            [items]="parentEntityItems"
            compareProp="id"
            displayProp="label"
            [(comboValue)]="selectedParentEntityId">
          </app-combo-box>
        }

        <div class="flex flex-col items-end gap-1 ms-auto">
          <div class="flex flex-row gap-2">
            <app-button label="Padrao do Sistema" buttonType="secondary" size="xs" (click)="confirmResetToDefault()"></app-button>
            <app-button label="Salvar Layout" buttonType="primary" size="xs" (click)="save()"></app-button>
          </div>

          @if (noticeMessage) {
            <span class="text-xs text-emerald-300">{{ noticeMessage }}</span>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div>
          <div class="text-sm mb-2 text-zinc-300">Grid de visualizacao</div>
          <div
            class="grid-surface"
            #gridSurface
            [ngStyle]="getGridStyle()"
            (dragover)="allowDrop($event)"
            (drop)="onGridDrop($event)">

            @for (item of layout.items; track item.token) {
              <div
                class="layout-item"
                [ngStyle]="getItemStyle(item)"
                (mousedown)="startMove($event, item)">
                <div class="layout-item-header">
                  <span>{{ getTokenLabel(item.token) }}</span>
                  <app-icon-button
                    class="layout-remove"
                    icon="fa-solid fa-xmark"
                    size="xss"
                    buttonType="danger"
                    title="Remover campo"
                    (mousedown)="$event.stopPropagation()"
                    (click)="removeItem(item.token); $event.stopPropagation()">
                  </app-icon-button>
                </div>
                <div class="layout-item-body">
                  <div class="text-[11px] text-zinc-400">{{ item.width }}x{{ item.height }}</div>
                </div>

                <div class="resize-handle-right" (mousedown)="startResize($event, item, 'right')"></div>
                <div class="resize-handle-bottom" (mousedown)="startResize($event, item, 'bottom')"></div>
                <div class="resize-handle-corner" (mousedown)="startResize($event, item, 'corner')"></div>
              </div>
            }
          </div>
        </div>

        <div class="bg-zinc-900 rounded-lg border border-zinc-800 p-3">
          <div class="text-sm text-zinc-300 mb-3">Campos disponiveis</div>
          <div class="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-dark">
            @for (field of catalog; track field.token) {
              <div
                class="catalog-item"
                [class.catalog-item--disabled]="isTokenPlaced(field.token)"
                [attr.draggable]="!isTokenPlaced(field.token)"
                (dragstart)="onCatalogDragStart($event, field.token)">
                <div class="flex flex-col">
                  <span class="text-sm">{{ field.label }}</span>
                  <span class="text-[11px] text-zinc-400">{{ field.source }}{{ field.isEditorField ? ' - editor' : '' }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './ui-field-config-editor.component.css',
})
export class UiFieldConfigEditorComponent {
  private dialogRef = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  private dialogData = inject<any>(DIALOG_DATA, { optional: true });
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dbProvider = inject(DbProvider);
  private uiFieldConfigService = inject(UiFieldConfigService);
  private confirmService = inject(ConfirmService);

  entityTable = '';
  entityId: string | null = null;
  backRoute = '/app/culture/list';

  catalog: UiFieldCatalogItem[] = [];
  layout: UiConfigPayload = getSystemDefaultConfig('');

  scopeMode: 'entity' | 'parent' | 'global' = 'global';
  parentScopeOptions: ParentScopeOption[] = [];
  selectedParentScopeKey = '';
  allowParentSelection = false;
  parentSelectableTables: string[] = [];
  selectedParentTable = '';
  parentEntityItems: ParentEntityItem[] = [];
  selectedParentEntityId = '';
  noticeMessage = '';
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  get scopeModeItems(): SelectOptionItem[] {
    const options: SelectOptionItem[] = [];

    if (this.entityId) {
      options.push({ value: 'entity', label: 'Exclusivo desta entidade' });
    }

    if (this.parentScopeOptions.length > 0 || this.allowParentSelection) {
      options.push({ value: 'parent', label: 'Por entidade pai' });
    }

    options.push({ value: 'global', label: 'Global da entidade' });
    return options;
  }

  get parentScopeItems(): SelectOptionItem[] {
    return this.parentScopeOptions.map((option) => ({
      value: `${option.parentEntityTable}:${option.parentEntityId}`,
      label: option.label,
    }));
  }

  private draggingToken = '';

  private activeMove?: {
    token: string;
    startX: number;
    startY: number;
    startCol: number;
    startRow: number;
  };

  private activeResize?: {
    token: string;
    direction: 'right' | 'bottom' | 'corner';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  };

  ngOnInit(): void {
    const queryMap = this.route.snapshot.queryParamMap;
    this.entityTable = this.dialogData?.entityTable ?? queryMap.get('entityTable') ?? '';
    this.entityId = this.dialogData?.entityId ?? queryMap.get('entityId');
    this.backRoute = this.dialogData?.backRoute ?? queryMap.get('backRoute') ?? '/app/culture/list';

    if (!this.entityTable) {
      this.router.navigate(['/app']);
      return;
    }

    this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
    this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);

    const parentTable = this.dialogData?.parentEntityTable ?? queryMap.get('parentEntityTable');
    const parentId = this.dialogData?.parentEntityId ?? queryMap.get('parentEntityId');
    const parentLabel = this.dialogData?.parentLabel ?? queryMap.get('parentLabel');
    this.allowParentSelection = !!this.dialogData?.allowParentSelection;

    if (this.allowParentSelection) {
      const ignored = new Set([
        'Personalization', 'Image', 'DynamicField', 'DynamicFieldValue', 'Document',
        'UiFieldConfig', 'LocationCategory', 'Relationship', 'GlobalParameter', 'OrganizationType', 'Link'
      ]);

      this.parentSelectableTables = schema
        .map((tableDef) => tableDef.name)
        .filter((name) => !ignored.has(name));

      this.selectedParentTable = parentTable || this.parentSelectableTables[0] || '';
      this.loadParentEntities(this.selectedParentTable);
    }

    if (parentTable && parentId) {
      this.parentScopeOptions = [{
        parentEntityTable: parentTable,
        parentEntityId: parentId,
        label: parentLabel ?? `${parentTable} (${parentId})`,
      }];
      this.selectedParentScopeKey = `${parentTable}:${parentId}`;
      this.selectedParentTable = parentTable;
      this.selectedParentEntityId = parentId;
    }

    const requestedScopeMode = this.dialogData?.scopeMode as 'entity' | 'parent' | 'global' | undefined;
    if (requestedScopeMode) {
      this.scopeMode = requestedScopeMode;
    } else if (this.entityId) {
      this.scopeMode = 'entity';
    } else {
      this.scopeMode = this.parentScopeOptions.length > 0 ? 'parent' : 'global';
    }

    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  get isDialogMode(): boolean {
    return !!this.dialogRef;
  }

  closeDialog(): void {
    this.dialogRef?.close();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);

    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  onParentTableChange(tableName: string): void {
    this.selectedParentTable = tableName;
    this.loadParentEntities(tableName);
  }

  onCatalogDragStart(event: DragEvent, token: string): void {
    this.draggingToken = token;
    event.dataTransfer?.setData('text/plain', token);
  }

  onGridDrop(event: DragEvent): void {
    event.preventDefault();

    const token = event.dataTransfer?.getData('text/plain') || this.draggingToken;
    if (!token || this.isTokenPlaced(token)) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const colWidth = rect.width / this.layout.columns;
    const col = clamp(Math.floor(x / colWidth) + 1, 1, this.layout.columns);
    const row = Math.max(1, Math.floor(y / this.layout.rowHeight) + 1);

    this.layout.items = [
      ...this.layout.items,
      {
        token,
        col,
        row,
        width: this.getDefaultWidth(token),
        height: this.getDefaultHeight(token),
      },
    ];
  }

  startMove(event: MouseEvent, item: UiFieldLayoutItem): void {
    const target = event.target as HTMLElement;
    if (target.closest('.resize-handle-right') ||
      target.closest('.resize-handle-bottom') ||
      target.closest('.resize-handle-corner') ||
      target.closest('.layout-remove')) {
      return;
    }

    event.preventDefault();
    this.activeMove = {
      token: item.token,
      startX: event.clientX,
      startY: event.clientY,
      startCol: item.col,
      startRow: item.row,
    };
  }

  startResize(event: MouseEvent, item: UiFieldLayoutItem, direction: 'right' | 'bottom' | 'corner'): void {
    event.preventDefault();
    event.stopPropagation();

    this.activeResize = {
      token: item.token,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: item.width,
      startHeight: item.height,
    };
  }

  private onDocumentMouseMove = (event: MouseEvent): void => {
    if (this.activeMove) {
      const current = this.layout.items.find((item) => item.token === this.activeMove?.token);
      if (!current) {
        return;
      }

      const gridElement = document.querySelector('.grid-surface') as HTMLElement | null;
      if (!gridElement) {
        return;
      }

      const rect = gridElement.getBoundingClientRect();
      const colWidth = rect.width / this.layout.columns;
      const deltaX = event.clientX - this.activeMove.startX;
      const deltaY = event.clientY - this.activeMove.startY;

      const deltaCols = Math.round(deltaX / colWidth);
      const deltaRows = Math.round(deltaY / this.layout.rowHeight);

      current.col = clamp(this.activeMove.startCol + deltaCols, 1, this.layout.columns - current.width + 1);
      current.row = Math.max(1, this.activeMove.startRow + deltaRows);
      return;
    }

    if (this.activeResize) {
      const current = this.layout.items.find((item) => item.token === this.activeResize?.token);
      if (!current) {
        return;
      }

      const gridElement = document.querySelector('.grid-surface') as HTMLElement | null;
      if (!gridElement) {
        return;
      }

      const rect = gridElement.getBoundingClientRect();
      const colWidth = rect.width / this.layout.columns;
      const deltaX = event.clientX - this.activeResize.startX;
      const deltaY = event.clientY - this.activeResize.startY;

      if (this.activeResize.direction === 'right' || this.activeResize.direction === 'corner') {
        const deltaCols = Math.round(deltaX / colWidth);
        current.width = clamp(this.activeResize.startWidth + deltaCols, 1, this.layout.columns - current.col + 1);
      }

      if (this.activeResize.direction === 'bottom' || this.activeResize.direction === 'corner') {
        const deltaRows = Math.round(deltaY / this.layout.rowHeight);
        current.height = Math.max(1, this.activeResize.startHeight + deltaRows);
      }
    }
  };

  private onDocumentMouseUp = (): void => {
    this.activeMove = undefined;
    this.activeResize = undefined;
  };

  removeItem(token: string): void {
    this.layout.items = this.layout.items.filter((item) => item.token !== token);
  }

  isTokenPlaced(token: string): boolean {
    return this.layout.items.some((item) => item.token === token);
  }

  getTokenLabel(token: string): string {
    return this.catalog.find((field) => field.token === token)?.label ?? token;
  }

  getGridStyle(): Record<string, string> {
    const maxRow = this.layout.items.reduce((acc, item) => Math.max(acc, item.row + item.height), 10);
    const minHeight = Math.max(480, maxRow * this.layout.rowHeight);
    return {
      minHeight: `${minHeight}px`,
      backgroundSize: `${100 / this.layout.columns}% ${this.layout.rowHeight}px`,
    };
  }

  getItemStyle(item: UiFieldLayoutItem): Record<string, string> {
    return {
      left: `calc(${((item.col - 1) / this.layout.columns) * 100}% + 4px)`,
      top: `${(item.row - 1) * this.layout.rowHeight + 4}px`,
      width: `calc(${(item.width / this.layout.columns) * 100}% - 8px)`,
      height: `${item.height * this.layout.rowHeight - 8}px`,
    };
  }

  resetToDefault(): void {
    if (this.scopeMode === 'entity' && this.entityId) {
      this.uiFieldConfigService.deleteConfig({
        entityTable: this.entityTable,
        entityId: this.entityId,
        scopeMode: 'entity',
      });
    }

    if (this.scopeMode === 'parent') {
      const selected = this.getSelectedParentScope();
      if (selected) {
        this.uiFieldConfigService.deleteConfig({
          entityTable: this.entityTable,
          scopeMode: 'parent',
          parentEntityTable: selected.parentEntityTable,
          parentEntityId: selected.parentEntityId,
        });
      }
    }

    if (this.scopeMode === 'global') {
      this.uiFieldConfigService.deleteConfig({
        entityTable: this.entityTable,
        scopeMode: 'global',
      });
    }

    this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);
  }

  async confirmResetToDefault(): Promise<void> {
    const confirmed = await this.confirmService.ask('a configuracao sera perdida, deseja prosseguir?');
    if (!confirmed) {
      return;
    }

    this.resetToDefault();
    this.showNotice('Configuracao restaurada para o padrao do sistema.');
  }

  save(): void {
    const cleanedLayout: UiConfigPayload = {
      version: 1,
      columns: this.layout.columns,
      rowHeight: this.layout.rowHeight,
      items: this.layout.items.map((item) => ({
        token: item.token,
        col: item.col,
        row: item.row,
        width: item.width,
        height: item.height,
      })),
    };

    if (this.scopeMode === 'entity') {
      this.uiFieldConfigService.saveConfig({
        entityTable: this.entityTable,
        entityId: this.entityId,
        scopeMode: 'entity',
        uiConfig: cleanedLayout,
      });
      this.showNotice('Configuracao salva.');
      return;
    }

    if (this.scopeMode === 'parent') {
      const selected = this.getSelectedParentScope();

      if (!selected) {
        return;
      }

      this.uiFieldConfigService.saveConfig({
        entityTable: this.entityTable,
        scopeMode: 'parent',
        parentEntityTable: selected.parentEntityTable,
        parentEntityId: selected.parentEntityId,
        uiConfig: cleanedLayout,
      });
      this.showNotice('Configuracao salva.');
      return;
    }

    this.uiFieldConfigService.saveConfig({
      entityTable: this.entityTable,
      scopeMode: 'global',
      uiConfig: cleanedLayout,
    });
    this.showNotice('Configuracao salva.');
  }

  private showNotice(message: string): void {
    this.noticeMessage = message;

    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }

    this.noticeTimer = setTimeout(() => {
      this.noticeMessage = '';
      this.noticeTimer = null;
    }, 2400);
  }

  private getDefaultWidth(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    return catalogItem?.isEditorField ? 6 : 4;
  }

  private getDefaultHeight(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    return catalogItem?.isEditorField ? 6 : 1;
  }

  private getSelectedParentScope(): ParentScopeOption | null {
    let selected = this.parentScopeOptions.find((option) => (
      `${option.parentEntityTable}:${option.parentEntityId}` === this.selectedParentScopeKey
    ));

    if (!selected && this.allowParentSelection && this.selectedParentTable && this.selectedParentEntityId) {
      const parentItem = this.parentEntityItems.find((item) => item.id === this.selectedParentEntityId);
      selected = {
        parentEntityTable: this.selectedParentTable,
        parentEntityId: this.selectedParentEntityId,
        label: parentItem?.label || `${this.selectedParentTable} (${this.selectedParentEntityId})`,
      };
    }

    return selected ?? null;
  }

  private loadParentEntities(tableName: string): void {
    if (!tableName) {
      this.parentEntityItems = [];
      this.selectedParentEntityId = '';
      return;
    }

    const db = this.dbProvider.getDb<any>();
    const labelColumn = this.getPreferredLabelColumn(tableName);

    let sql = '';
    if (labelColumn) {
      sql = `SELECT id, "${labelColumn}" as label FROM "${tableName}" ORDER BY "${labelColumn}" COLLATE NOCASE`;
    } else {
      sql = `SELECT id FROM "${tableName}" ORDER BY id`;
    }

    const result = db.exec(sql);
    if (!result.length) {
      this.parentEntityItems = [];
      this.selectedParentEntityId = '';
      return;
    }

    const columns = result[0].columns;
    this.parentEntityItems = result[0].values.map((row: unknown[]) => {
      const id = String(row[columns.indexOf('id')]);
      const labelRaw = columns.includes('label') ? row[columns.indexOf('label')] : null;
      return {
        id,
        label: labelRaw ? String(labelRaw) : id,
      };
    });

    const previousSelected = this.selectedParentEntityId;
    this.selectedParentEntityId = this.parentEntityItems.some((item) => item.id === previousSelected)
      ? previousSelected
      : (this.parentEntityItems[0]?.id || '');
  }

  private getPreferredLabelColumn(tableName: string): string | null {
    const db = this.dbProvider.getDb<any>();
    const pragma = db.exec(`PRAGMA table_info("${tableName}")`);
    if (!pragma.length) {
      return null;
    }

    const nameIndex = pragma[0].columns.indexOf('name');
    const cols = pragma[0].values.map((row: unknown[]) => String(row[nameIndex]));

    if (cols.includes('name')) {
      return 'name';
    }

    if (cols.includes('title')) {
      return 'title';
    }

    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
