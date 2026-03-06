import { NgStyle } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiConfigPayload, UiFieldCatalogItem, UiFieldLayoutItem } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';

interface ParentScopeOption {
  parentEntityTable: string;
  parentEntityId: string;
  label: string;
}

@Component({
  selector: 'app-ui-field-config-editor',
  imports: [NgStyle, FormsModule, RouterLink],
  template: `
    <div class="p-4 md:p-6 flex flex-col gap-4">
      <div class="flex flex-row items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 class="text-xl font-semibold text-white">Configurar Layout de Campos</h1>
          <p class="text-sm text-zinc-400">Arraste campos para o grid e redimensione pelas bordas.</p>
        </div>
        <a [routerLink]="backRoute" class="text-sm px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white">Voltar</a>
      </div>

      <div class="flex flex-wrap gap-4 items-end bg-zinc-900 p-3 rounded-lg border border-zinc-800">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-zinc-400">Escopo</label>
          <select class="bg-zinc-800 text-white rounded-md px-2 py-1 text-sm" [(ngModel)]="scopeMode">
            @if (entityId) {
              <option value="entity">Exclusivo desta entidade</option>
            }
            @if (parentScopeOptions.length > 0) {
              <option value="parent">Por entidade pai</option>
            }
            <option value="global">Global da entidade</option>
          </select>
        </div>

        @if (scopeMode === 'parent' && parentScopeOptions.length > 0) {
          <div class="flex flex-col gap-1">
            <label class="text-xs text-zinc-400">Pai</label>
            <select class="bg-zinc-800 text-white rounded-md px-2 py-1 text-sm" [(ngModel)]="selectedParentScopeKey">
              @for (option of parentScopeOptions; track option.parentEntityTable + ':' + option.parentEntityId) {
                <option [value]="option.parentEntityTable + ':' + option.parentEntityId">{{ option.label }}</option>
              }
            </select>
          </div>
        }

        <div class="flex flex-row gap-2 ms-auto">
          <button class="text-xs px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white" (click)="resetToDefault()">Padrao do Sistema</button>
          <button class="text-xs px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white" (click)="save()">Salvar Layout</button>
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
                  <button class="layout-remove" (click)="removeItem(item.token); $event.stopPropagation()">x</button>
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private uiFieldConfigService = inject(UiFieldConfigService);

  entityTable = '';
  entityId: string | null = null;
  backRoute = '/app/culture/list';

  catalog: UiFieldCatalogItem[] = [];
  layout: UiConfigPayload = getSystemDefaultConfig('');

  scopeMode: 'entity' | 'parent' | 'global' = 'global';
  parentScopeOptions: ParentScopeOption[] = [];
  selectedParentScopeKey = '';

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
    this.entityTable = queryMap.get('entityTable') ?? '';
    this.entityId = queryMap.get('entityId');
    this.backRoute = queryMap.get('backRoute') ?? '/app/culture/list';

    if (!this.entityTable) {
      this.router.navigate(['/app']);
      return;
    }

    this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
    this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);

    const parentTable = queryMap.get('parentEntityTable');
    const parentId = queryMap.get('parentEntityId');
    const parentLabel = queryMap.get('parentLabel');

    if (parentTable && parentId) {
      this.parentScopeOptions = [{
        parentEntityTable: parentTable,
        parentEntityId: parentId,
        label: parentLabel ?? `${parentTable} (${parentId})`,
      }];
      this.selectedParentScopeKey = `${parentTable}:${parentId}`;
    }

    if (this.entityId) {
      this.scopeMode = 'entity';
    } else {
      this.scopeMode = this.parentScopeOptions.length > 0 ? 'parent' : 'global';
    }

    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
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
    if ((event.target as HTMLElement).classList.contains('resize-handle-right') ||
      (event.target as HTMLElement).classList.contains('resize-handle-bottom') ||
      (event.target as HTMLElement).classList.contains('resize-handle-corner') ||
      (event.target as HTMLElement).classList.contains('layout-remove')) {
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
    this.layout = getSystemDefaultConfig(this.entityTable);
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
      return;
    }

    if (this.scopeMode === 'parent') {
      const selected = this.parentScopeOptions.find((option) => (
        `${option.parentEntityTable}:${option.parentEntityId}` === this.selectedParentScopeKey
      ));

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
      return;
    }

    this.uiFieldConfigService.saveConfig({
      entityTable: this.entityTable,
      scopeMode: 'global',
      uiConfig: cleanedLayout,
    });
  }

  private getDefaultWidth(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    return catalogItem?.isEditorField ? 6 : 4;
  }

  private getDefaultHeight(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    return catalogItem?.isEditorField ? 6 : 1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
