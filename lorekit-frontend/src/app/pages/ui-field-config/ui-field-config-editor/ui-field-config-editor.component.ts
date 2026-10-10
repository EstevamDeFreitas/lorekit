import { NgStyle } from '@angular/common';
import { Component, ElementRef, inject, input, output, ViewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { createFieldLayoutItem, UiConfigPayload, UiFieldCatalogItem, UiFieldLayoutItem, UiFieldLayoutTab, UiFieldTemplate, validateUiConfigPayload } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';
import { UiFieldLayoutPortabilityService } from '../../../services/ui-field-layout-portability.service';
import { CHART_SERIES_COLORS, ChartFieldOptions, ChartType, defaultChartFieldOptions, defaultListFieldOptions, defaultSliderFieldOptions, DynamicField, DynamicFieldType, ListColumn, ListColumnType, ListFieldOptions, parseDynamicFieldOptions, serializeDynamicFieldOptions, SliderFieldOptions } from '../../../models/dynamicfields.model';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DbProvider } from '../../../database/db-provider.service';
import { schema } from '../../../database/schema';
import { ButtonComponent } from '../../../components/button/button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../components/input/input.component';
import { HexColorPickerComponent } from '../../../components/hex-color-picker/hex-color-picker.component';

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
  imports: [NgStyle, ButtonComponent, IconButtonComponent, ComboBoxComponent, InputComponent, HexColorPickerComponent],
  templateUrl: './ui-field-config-editor.component.html',
  styleUrl: './ui-field-config-editor.component.css',
})
export class UiFieldConfigEditorComponent {
  readonly entityTableInput = input<string | null>(null, { alias: 'entityTable' });
  readonly templateIdInput = input<string | null>(null, { alias: 'templateId' });
  readonly scopeModeInput = input<'entity' | 'parent' | 'global' | 'template' | null>(null, { alias: 'scopeMode' });
  readonly embeddedMode = input(false);
  readonly templatesChanged = output<void>();

  private dialogRef = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  private dialogData = inject<any>(DIALOG_DATA, { optional: true });
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dbProvider = inject(DbProvider);
  private uiFieldConfigService = inject(UiFieldConfigService);
  private dynamicFieldService = inject(DynamicFieldService);
  private uiFieldLayoutPortabilityService = inject(UiFieldLayoutPortabilityService);
  private confirmService = inject(ConfirmService);

  entityTable = '';
  entityId: string | null = null;
  backRoute = '/app/culture/list';

  catalog: UiFieldCatalogItem[] = [];
  dynamicFields: DynamicField[] = [];
  editingDynamicFieldId = '';
  layout: UiConfigPayload = getSystemDefaultConfig('');
  activeTabId = 'tab:properties';

  get activeTab(): UiFieldLayoutTab {
    return this.layout.tabs.find(tab => tab.id === this.activeTabId) ?? this.layout.tabs[0];
  }

  scopeMode: 'entity' | 'parent' | 'global' | 'template' = 'global';
  parentScopeOptions: ParentScopeOption[] = [];
  selectedParentScopeKey = '';
  allowParentSelection = false;
  parentSelectableTables: string[] = [];
  selectedParentTable = '';
  parentEntityItems: ParentEntityItem[] = [];
  selectedParentEntityId = '';

  newFieldName = '';
  newFieldOptions = '';
  newFieldIsEditorField = false;
  newFieldType: DynamicFieldType = 'text';
  newFieldTargetEntityTable = '';
  newFieldImageAspectRatio = '1';
  newSliderMin = '0';
  newSliderMax = '100';
  newSliderStep = '1';
  newSliderUnit = '';
  newListMode: 'table' | 'headless' = 'table';
  newListColumns = 'Item';
  newChartType: ChartType = 'radar';
  newChartTitle = '';
  newChartLegend = '';
  newChartColor = '#facc15';
  newChartSeries = 'Serie 1';
  newChartCategories = 'Categoria 1; Categoria 2; Categoria 3';
  private chartCategoryDrafts = new WeakMap<DynamicField, string>();
  newListColumnSuggestionsOpen = false;
  activeListColumnSuggestionFieldId = '';
  private listColumnDrafts: Record<string, string> = {};
  creatingDynamicField = false;

  readonly fieldTypeItems = [
    { value: 'text', label: 'Texto' },
    { value: 'options', label: 'Opcoes (combobox)' },
    { value: 'editor', label: 'Editor de texto' },
    { value: 'entity', label: 'Entidade relacionada' },
    { value: 'image', label: 'Imagem' },
    { value: 'slider', label: 'Slider numerico' },
    { value: 'list', label: 'Listagem' },
    { value: 'chart', label: 'Grafico' },
  ];
  readonly imageAspectRatioItems = [
    { value: '1', label: 'Quadrada (1:1)' },
    { value: '0.8', label: 'Retrato (4:5)' },
    { value: '0.6666666667', label: 'Retrato (2:3)' },
    { value: '1.3333333333', label: 'Paisagem (4:3)' },
    { value: '1.7777777778', label: 'Paisagem (16:9)' },
    { value: '5', label: 'Banner (5:1)' },
  ];
  readonly listModeItems = [
    { value: 'table', label: 'Tabela com colunas' },
    { value: 'headless', label: 'Lista simples (headless)' },
  ];
  readonly listColumnTypeItems = [
    { value: 'text', label: 'Texto' },
    { value: 'number', label: 'Numero' },
    { value: 'boolean', label: 'Booleano' },
    { value: 'date', label: 'Data' },
  ];
  readonly chartTypeItems = [
    { value: 'radar', label: 'Radar' },
    { value: 'bar', label: 'Barra' },
    { value: 'line', label: 'Linha' },
  ];


  get entityTableOptions(): string[] {
    const ignored = new Set([
      'Personalization', 'Image', 'DynamicField', 'DynamicFieldValue', 'Document',
      'UiFieldConfig', 'UiFieldTemplate', 'LocationCategory', 'Relationship',
      'GlobalParameter', 'OrganizationType', 'Link',
    ]);
    return schema.map((t) => t.name).filter((name) => !ignored.has(name));
  }

  get systemCatalog(): UiFieldCatalogItem[] {
    return this.catalog.filter((field) => field.source === 'schema');
  }

  // Template
  activeTemplateId = '';
  activeTemplateName = '';
  availableTemplates: { value: string; label: string }[] = [];
  selectedTemplateId = '';
  showCreateTemplateForm = false;
  newTemplateName = '';

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
    if (this.availableTemplates.length > 0) {
      options.push({ value: 'template', label: 'Template' });
    }
    return options;
  }

  get parentScopeItems(): SelectOptionItem[] {
    return this.parentScopeOptions.map((option) => ({
      value: `${option.parentEntityTable}:${option.parentEntityId}`,
      label: option.label,
    }));
  }

  private draggingToken = '';
  private draggingSeparatorOrientation: 'horizontal' | 'vertical' | null = null;
  contextMenu: { itemId: string; x: number; y: number } | null = null;
  @ViewChild('contextMenuElement') private contextMenuElement?: ElementRef<HTMLElement>;
  private contextMenuPositionFrame: number | null = null;
  private suppressNextItemMenuId: string | null = null;

  get contextMenuItem(): UiFieldLayoutItem | null {
    if (!this.contextMenu) return null;
    return this.activeTab.items.find(item => item.id === this.contextMenu?.itemId) ?? null;
  }

  private activeMove?: {
    id: string;
    startX: number;
    startY: number;
    startCol: number;
    startRow: number;
    moved: boolean;
  };

  private activeResize?: {
    id: string;
    direction: 'right' | 'bottom' | 'corner';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  };

  ngOnInit(): void {
    const queryMap = this.route.snapshot.queryParamMap;
    this.entityTable = this.entityTableInput() ?? this.dialogData?.entityTable ?? queryMap.get('entityTable') ?? '';
    this.entityId = this.dialogData?.entityId ?? queryMap.get('entityId');
    this.backRoute = this.dialogData?.backRoute ?? queryMap.get('backRoute') ?? '/app/culture/list';

    // if (!this.entityTable) {
    //   this.router.navigate(['/app']);
    //   return;
    // }

    this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
    this.loadDynamicFields();
    this.refreshTemplates();

    const incomingTemplateId = this.templateIdInput() ?? (this.dialogData?.templateId as string | undefined);
    if (incomingTemplateId) {
      const tpl = this.uiFieldConfigService.getTemplates(this.entityTable)
        .find((t) => t.id === incomingTemplateId);
      if (tpl) {
        this.layout = this.uiFieldConfigService.parseTemplateConfig(tpl);
        this.activeTemplateId = tpl.id;
        this.activeTemplateName = tpl.name;
        this.selectedTemplateId = tpl.id;
      }
      this.scopeMode = 'template';
    } else {
      this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);
    }

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

    const requestedScopeMode = this.scopeModeInput() ?? (this.dialogData?.scopeMode as 'entity' | 'parent' | 'global' | 'template' | undefined);
    if (!incomingTemplateId && requestedScopeMode) {
      this.scopeMode = requestedScopeMode;
    } else if (!incomingTemplateId && this.entityId) {
      this.scopeMode = 'entity';
    } else if (!incomingTemplateId) {
      this.scopeMode = this.parentScopeOptions.length > 0 ? 'parent' : 'global';
    }

    this.ensureActiveTab();
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
    window.addEventListener('resize', this.onWindowResize);
  }

  get isDialogMode(): boolean {
    return !!this.dialogRef;
  }

  closeDialog(): void {
    this.dialogRef?.close();
  }

  setEntityTable(entityTable: string): void {
    if (!entityTable) return;

    this.entityTable = entityTable;
    this.entityId = null;
    this.scopeMode = 'global';
    this.activeTemplateId = '';
    this.activeTemplateName = '';
    this.selectedTemplateId = '';
    this.catalog = this.uiFieldConfigService.getCatalog(entityTable);
    this.loadDynamicFields();
    this.refreshTemplates();
    this.layout = this.uiFieldConfigService.getResolvedConfig(entityTable, null);
    this.ensureActiveTab();
    this.editingDynamicFieldId = '';
  }

  useGlobalLayout(): void {
    this.scopeMode = 'global';
    this.activeTemplateId = '';
    this.activeTemplateName = '';
    this.selectedTemplateId = '';
    this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);
    this.ensureActiveTab();
  }
  async onScopeModeChange(nextScope: string): Promise<void> {
    if (!this.isScopeMode(nextScope) || nextScope === this.scopeMode) return;

    const isLeavingExclusiveEntityScope = this.scopeMode === 'entity' &&
      nextScope !== 'entity' &&
      !!this.entityId &&
      this.uiFieldConfigService.hasEntityConfig(this.entityTable, this.entityId);

    if (isLeavingExclusiveEntityScope) {
      const confirmed = await this.confirmService.ask(
        'Ao trocar o escopo, o layout exclusivo desta entidade sera removido e a tela sera recarregada com o layout do novo escopo. Alteracoes nao salvas nesta tela serao perdidas. Deseja continuar?'
      );
      if (!confirmed) return;

      this.uiFieldConfigService.deleteConfig({
        entityTable: this.entityTable,
        entityId: this.entityId,
        scopeMode: 'entity',
      });
      this.scopeMode = nextScope;
      this.reloadAfterScopeChange();
      return;
    }

    this.scopeMode = nextScope;
    this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);
    this.ensureActiveTab();
  }

  private isScopeMode(value: string): value is 'entity' | 'parent' | 'global' | 'template' {
    return value === 'entity' || value === 'parent' || value === 'global' || value === 'template';
  }

  private reloadAfterScopeChange(): void {
    if (this.isDialogMode) {
      this.dialogRef?.close({ reload: true });
      return;
    }

    window.location.reload();
  }


  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    window.removeEventListener('resize', this.onWindowResize);
    if (this.contextMenuPositionFrame !== null) {
      cancelAnimationFrame(this.contextMenuPositionFrame);
      this.contextMenuPositionFrame = null;
    }

    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  selectLayoutTab(tabId: string): void {
    if (this.layout.tabs.some(tab => tab.id === tabId)) this.activeTabId = tabId;
  }

  addLayoutTab(): void {
    let index = this.layout.tabs.length + 1;
    let name = `Nova aba ${index}`;
    const names = new Set(this.layout.tabs.map(tab => tab.name.toLocaleLowerCase()));
    while (names.has(name.toLocaleLowerCase())) name = `Nova aba ${++index}`;
    const tab = { id: `tab:${crypto.randomUUID()}`, name, items: [] };
    this.layout.tabs = [...this.layout.tabs, tab];
    this.activeTabId = tab.id;
  }

  moveLayoutTab(offset: number): void {
    const index = this.layout.tabs.findIndex(tab => tab.id === this.activeTabId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= this.layout.tabs.length) return;
    const tabs = [...this.layout.tabs];
    [tabs[index], tabs[target]] = [tabs[target], tabs[index]];
    this.layout.tabs = tabs;
  }

  async removeLayoutTab(): Promise<void> {
    if (this.layout.tabs.length === 1) {
      this.showNotice('O layout precisa conter ao menos uma aba.');
      return;
    }
    if (!await this.confirmService.ask('remover esta aba e todos os itens posicionados nela?')) return;
    const index = this.layout.tabs.findIndex(tab => tab.id === this.activeTabId);
    this.layout.tabs = this.layout.tabs.filter(tab => tab.id !== this.activeTabId);
    this.activeTabId = this.layout.tabs[Math.min(Math.max(index, 0), this.layout.tabs.length - 1)].id;
  }

  private addSeparatorAt(orientation: 'horizontal' | 'vertical', col: number, row: number): void {
    this.activeTab.items = [...this.activeTab.items, {
      id: `separator:${crypto.randomUUID()}`,
      kind: 'separator',
      orientation,
      col,
      row,
      width: orientation === 'horizontal' ? this.layout.columns - col + 1 : 1,
      height: orientation === 'horizontal' ? 1 : 4,
    }];
  }

  private ensureActiveTab(): void {
    if (!this.layout.tabs.some(tab => tab.id === this.activeTabId)) this.activeTabId = this.layout.tabs[0]?.id ?? '';
  }

  onParentTableChange(tableName: string): void {
    this.selectedParentTable = tableName;
    this.loadParentEntities(tableName);
  }

  onCatalogDragStart(event: DragEvent, token: string): void {
    this.draggingToken = token;
    this.draggingSeparatorOrientation = null;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer?.setData('text/plain', token);
  }

  onSeparatorDragStart(event: DragEvent, orientation: 'horizontal' | 'vertical'): void {
    this.draggingToken = '';
    this.draggingSeparatorOrientation = orientation;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer?.setData('application/x-lorekit-separator', orientation);
    event.dataTransfer?.setData('text/plain', `separator:${orientation}`);
  }

  clearDragState(): void {
    this.draggingToken = '';
    this.draggingSeparatorOrientation = null;
  }

  onGridDrop(event: DragEvent): void {
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const { col, row } = this.getDropPosition(event, target);
    const rawValue = event.dataTransfer?.getData('text/plain') || '';
    const separator = event.dataTransfer?.getData('application/x-lorekit-separator') ||
      (rawValue === 'separator:horizontal' ? 'horizontal' : rawValue === 'separator:vertical' ? 'vertical' : null) ||
      this.draggingSeparatorOrientation;
    if (separator === 'horizontal' || separator === 'vertical') {
      this.addSeparatorAt(separator, col, row);
      this.draggingSeparatorOrientation = null;
      return;
    }

    const token = rawValue || this.draggingToken;
    if (!token || this.isTokenPlaced(token)) {
      return;
    }
    const width = this.getDefaultWidth(token);
    this.activeTab.items = [...this.activeTab.items, createFieldLayoutItem(token, clamp(col, 1, this.layout.columns - width + 1), row, width, this.getDefaultHeight(token))];
    this.draggingToken = '';
  }

  private getDropPosition(event: DragEvent, target: HTMLElement): { col: number; row: number } {
    const rect = target.getBoundingClientRect();
    const colWidth = rect.width / this.layout.columns;
    return {
      col: clamp(Math.floor((event.clientX - rect.left) / colWidth) + 1, 1, this.layout.columns),
      row: Math.max(1, Math.floor((event.clientY - rect.top) / this.layout.rowHeight) + 1),
    };
  }

  openItemMenu(event: MouseEvent, item: UiFieldLayoutItem): void {
    if (this.isResizeHandleTarget(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressNextItemMenuId = null;
      return;
    }
    if (this.suppressNextItemMenuId === item.id) {
      this.suppressNextItemMenuId = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.suppressNextItemMenuId = null;
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu = { itemId: item.id, x: event.clientX, y: event.clientY };
    this.scheduleContextMenuPosition();
  }
  closeContextMenu(): void {
    this.contextMenu = null;
  }
  private isResizeHandleTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && !!target.closest('.resize-handle-right, .resize-handle-bottom, .resize-handle-corner, .separator-resize-handle');
  }
  private scheduleContextMenuPosition(): void {
    if (this.contextMenuPositionFrame !== null) {
      cancelAnimationFrame(this.contextMenuPositionFrame);
    }
    this.contextMenuPositionFrame = requestAnimationFrame(() => {
      this.contextMenuPositionFrame = null;
      this.constrainContextMenuToViewport();
    });
  }
  private constrainContextMenuToViewport(): void {
    const contextMenu = this.contextMenu;
    const menuElement = this.contextMenuElement?.nativeElement;
    if (!contextMenu || !menuElement) {
      return;
    }
    const viewportPadding = 12;
    const menuRect = menuElement.getBoundingClientRect();
    const maxX = Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding);
    const maxY = Math.max(viewportPadding, window.innerHeight - menuRect.height - viewportPadding);
    const x = clamp(contextMenu.x, viewportPadding, maxX);
    const y = clamp(contextMenu.y, viewportPadding, maxY);
    if (x === contextMenu.x && y === contextMenu.y) {
      return;
    }
    this.contextMenu = { ...contextMenu, x, y };
  }
  private onWindowResize = (): void => {
    if (this.contextMenu) {
      this.scheduleContextMenuPosition();
    }
  };

  startMove(event: MouseEvent, item: UiFieldLayoutItem): void {
    const target = event.target as HTMLElement;
    if (target.closest('.resize-handle-right') ||
      target.closest('.resize-handle-bottom') ||
      target.closest('.resize-handle-corner') ||
      target.closest('.layout-remove')) {
      return;
    }
    this.suppressNextItemMenuId = null;
    event.preventDefault();
    this.activeMove = {
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      startCol: item.col,
      startRow: item.row,
      moved: false,
    };
  }

  startResize(event: MouseEvent, item: UiFieldLayoutItem, direction: 'right' | 'bottom' | 'corner'): void {
    event.preventDefault();
    event.stopPropagation();

    this.activeResize = {
      id: item.id,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: item.width,
      startHeight: item.height,
    };
  }

  private onDocumentMouseMove = (event: MouseEvent): void => {
    if (this.activeMove) {
      const current = this.activeTab.items.find((item) => item.id === this.activeMove?.id);
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
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        this.activeMove.moved = true;
        this.closeContextMenu();
      }

      const deltaCols = Math.round(deltaX / colWidth);
      const deltaRows = Math.round(deltaY / this.layout.rowHeight);

      current.col = clamp(this.activeMove.startCol + deltaCols, 1, this.layout.columns - current.width + 1);
      current.row = Math.max(1, this.activeMove.startRow + deltaRows);
      return;
    }

    if (this.activeResize) {
      const current = this.activeTab.items.find((item) => item.id === this.activeResize?.id);
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
    if (this.activeMove?.moved) {
      this.suppressNextItemMenuId = this.activeMove.id;
    }
    this.activeMove = undefined;
    this.activeResize = undefined;
  };

  removeItem(id: string): void {
    this.activeTab.items = this.activeTab.items.filter((item) => item.id !== id);
    if (this.contextMenu?.itemId === id) this.closeContextMenu();
  }

  isTokenPlaced(token: string): boolean {
    return this.layout.tabs.some(tab => tab.items.some(item => item.kind === 'field' && item.token === token));
  }

  getTokenLabel(token: string): string {
    return this.catalog.find((field) => field.token === token)?.label ?? token;
  }

  getItemLabel(item: UiFieldLayoutItem): string {
    return item.kind === 'field'
      ? this.getTokenLabel(item.token)
      : item.label || (item.orientation === 'horizontal' ? 'Separador horizontal' : 'Separador vertical');
  }

  getGridStyle(): Record<string, string> {
    const maxRow = this.activeTab.items.reduce((acc, item) => Math.max(acc, item.row + item.height), 10);
    const minHeight = Math.max(480, maxRow * this.layout.rowHeight);
    return {
      minHeight: `${minHeight}px`,
      backgroundSize: `${100 / this.layout.columns}% ${this.layout.rowHeight}px`,
    };
  }

  getItemStyle(item: UiFieldLayoutItem): Record<string, string> {
    const fieldInset = 12;
    const separatorInset = 10;
    if (item.kind === 'separator') {
      if (item.orientation === 'horizontal') {
        return {
          left: `calc(${((item.col - 1) / this.layout.columns) * 100}% + ${separatorInset}px)`,
          top: `${(item.row - 1) * this.layout.rowHeight}px`,
          width: `max(1px, calc(${(item.width / this.layout.columns) * 100}% - ${separatorInset * 2}px))`,
          height: '1px',
        };
      }
      return {
        left: `calc(${((item.col - 1) / this.layout.columns) * 100}%)`,
        top: `${(item.row - 1) * this.layout.rowHeight + separatorInset}px`,
        width: '1px',
        height: `max(1px, calc(${item.height * this.layout.rowHeight}px - ${separatorInset * 2}px))`,
      };
    }
    return {
      left: `calc(${((item.col - 1) / this.layout.columns) * 100}% + ${fieldInset}px)`,
      top: `${(item.row - 1) * this.layout.rowHeight + fieldInset}px`,
      width: `max(1px, calc(${(item.width / this.layout.columns) * 100}% - ${fieldInset * 2}px))`,
      height: `max(1px, calc(${item.height * this.layout.rowHeight}px - ${fieldInset * 2}px))`,
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
    this.ensureActiveTab();
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
    const cleanedLayout = this.tryBuildCleanedLayout();
    if (!cleanedLayout) return;

    if (this.scopeMode === 'template') {
      if (!this.activeTemplateId) {
        this.showNotice('Selecione um template para salvar.');
        return;
      }
      const name = this.activeTemplateName.trim();
      if (!name) {
        this.showNotice('Informe um nome para o layout.');
        return;
      }
      const duplicateName = this.uiFieldConfigService.getTemplates(this.entityTable).some((template) => (
        template.id !== this.activeTemplateId && template.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
      ));
      if (duplicateName) {
        this.showNotice('Já existe um layout com esse nome para esta entidade.');
        return;
      }
      this.activeTemplateName = name;
      this.uiFieldConfigService.updateTemplate(this.activeTemplateId, name, cleanedLayout);
      this.templatesChanged.emit();

      // Link the template to the appropriate scope so getResolvedConfig can find it
      if (this.entityId) {
        this.uiFieldConfigService.saveConfig({
          entityTable: this.entityTable,
          scopeMode: 'entity',
          entityId: this.entityId,
          uiConfig: cleanedLayout,
          templateId: this.activeTemplateId,
        });
      } else {
        this.uiFieldConfigService.saveConfig({
          entityTable: this.entityTable,
          scopeMode: 'global',
          uiConfig: cleanedLayout,
          templateId: this.activeTemplateId,
        });
      }

      this.showNotice('Template salvo.');
      return;
    }

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

  private buildCleanedLayout(): UiConfigPayload {
    return validateUiConfigPayload({
      version: 2,
      columns: this.layout.columns,
      rowHeight: this.layout.rowHeight,
      tabs: this.layout.tabs.map(tab => ({
        id: tab.id,
        name: tab.name.trim(),
        items: tab.items.map(item => item.kind === 'field'
          ? { ...item, color: item.color || undefined }
          : { ...item, label: item.label?.trim() || undefined, color: item.color || undefined }),
      })),
    });
  }

  private tryBuildCleanedLayout(): UiConfigPayload | null {
    try {
      return this.buildCleanedLayout();
    } catch (error) {
      this.showNotice(error instanceof Error ? error.message : 'O layout e invalido.');
      return null;
    }
  }

  refreshTemplates(): void {
    const templates = this.uiFieldConfigService.getTemplates(this.entityTable);
    this.availableTemplates = templates.map((t) => ({ value: t.id, label: t.name }));
  }

  onTemplateSelected(templateId: string): void {
    if (!templateId) { return; }
    const tpl = this.uiFieldConfigService.getTemplates(this.entityTable)
      .find((t) => t.id === templateId);
    if (tpl) {
      this.layout = this.uiFieldConfigService.parseTemplateConfig(tpl);
      this.ensureActiveTab();
      this.selectedTemplateId = tpl.id;
      this.activeTemplateId = tpl.id;
      this.activeTemplateName = tpl.name;
      this.scopeMode = 'template';
    }
  }

  toggleCreateTemplateForm(): void {
    this.showCreateTemplateForm = !this.showCreateTemplateForm;
    if (!this.showCreateTemplateForm) {
      this.newTemplateName = '';
    }
  }

  confirmCreateTemplate(): void {
    const name = this.newTemplateName.trim();
    if (!name) {
      this.showNotice('Informe um nome para o template.');
      return;
    }
    const cleanedLayout = this.tryBuildCleanedLayout();
    if (!cleanedLayout) return;
    const created = this.uiFieldConfigService.saveTemplate(name, this.entityTable, cleanedLayout);
    this.newTemplateName = '';
    this.showCreateTemplateForm = false;
    this.refreshTemplates();
    this.activeTemplateId = created.id;
    this.activeTemplateName = created.name;
    this.selectedTemplateId = created.id;
    this.scopeMode = 'template';
    this.templatesChanged.emit();
    this.showNotice(`Template "${name}" criado.`);
  }

  exportLayout(): void {
    try {
      const exportedLayout = this.uiFieldLayoutPortabilityService.exportLayout(this.entityTable, this.buildCleanedLayout());
      const blob = new Blob([JSON.stringify(exportedLayout, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lorekit-layout-${this.entityTable.toLocaleLowerCase()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url));
      this.showNotice('Layout exportado.');
    } catch (error) {
      this.showNotice(error instanceof Error ? error.message : 'Nao foi possivel exportar o layout.');
    }
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

  createDynamicField(): void {
    const name = this.newFieldName.trim();
    if (!name) {
      this.showNotice('Informe um nome para o campo dinamico.');
      return;
    }

    const normalizedName = name.toLocaleLowerCase();
    const alreadyExists = this.catalog.some((field) => (
      field.source === 'dynamic' && field.label.toLocaleLowerCase() === normalizedName
    ));

    if (alreadyExists) {
      this.showNotice('Ja existe um campo dinamico com esse nome.');
      return;
    }

    if (this.newFieldType === 'chart' && this.newChartType === 'radar' && this.parseChartCategories(this.newChartCategories).length < 3) {
      this.showNotice('Defina pelo menos 3 categorias distintas para o Radar.');
      return;
    }

    this.creatingDynamicField = true;
    try {
      const dynamicField = new DynamicField('', name, this.entityTable, '');
      dynamicField.fieldType = this.newFieldType;
      dynamicField.isEditorField = this.newFieldType === 'editor';
      dynamicField.options = this.newFieldOptionsForType();
      dynamicField.targetEntityTable = this.newFieldType === 'entity' ? this.newFieldTargetEntityTable : undefined;

      this.uiFieldConfigService.saveDynamicField(dynamicField);
      this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
      this.loadDynamicFields();

      this.newFieldName = '';
      this.newFieldOptions = '';
      this.newFieldType = 'text';
      this.newFieldTargetEntityTable = '';
      this.resetNewStructuredFieldConfig();
      this.showNotice('Campo dinamico criado.');
      this.newFieldImageAspectRatio = '1';
    } finally {
      this.creatingDynamicField = false;
    }
  }

  private loadDynamicFields(): void {
    this.dynamicFields = this.dynamicFieldService.getDynamicFields(this.entityTable);
  }

  async startEditDynamicField(field: DynamicField): Promise<void> {
    if (this.editingDynamicFieldId === field.id) return;

    if (this.editingDynamicFieldId) {
      const confirmed = await this.confirmService.ask('Descartar as alterações não salvas do campo atual?');
      if (!confirmed) return;
    }

    this.listColumnDrafts = {};
    this.closeListColumnSuggestions();
    this.loadDynamicFields();
    this.editingDynamicFieldId = field.id;
    const editableField = this.dynamicFields.find(item => item.id === field.id);
    if (editableField?.fieldType === 'list') this.listColumnDrafts[editableField.id] = this.formatListColumns(editableField);
  }

  cancelEditDynamicField(): void {
    this.loadDynamicFields();
    this.editingDynamicFieldId = '';
    this.listColumnDrafts = {};
    this.closeListColumnSuggestions();
  }

  setDynamicFieldType(field: DynamicField, value: string): void {
    if (!['text', 'options', 'editor', 'entity', 'image', 'slider', 'list', 'chart'].includes(value)) return;

    field.fieldType = value as DynamicFieldType;
    field.isEditorField = field.fieldType === 'editor';
    if (field.fieldType === 'slider' && !field.options) field.options = serializeDynamicFieldOptions(defaultSliderFieldOptions());
    if (field.fieldType === 'list' && !field.options) field.options = serializeDynamicFieldOptions(defaultListFieldOptions());
    if (field.fieldType === 'chart' && !field.options) field.options = serializeDynamicFieldOptions(defaultChartFieldOptions());
    if (field.fieldType !== 'options' && field.fieldType !== 'image' && field.fieldType !== 'slider' && field.fieldType !== 'list' && field.fieldType !== 'chart') field.options = undefined;
    if (field.fieldType === 'image' && !this.imageAspectRatioItems.some((option) => option.value === field.options)) {
      field.options = '1';
    }
    if (field.fieldType !== 'entity') field.targetEntityTable = undefined;
    if (field.fieldType !== 'list') delete this.listColumnDrafts[field.id];
  }

  saveDynamicField(field: DynamicField): void {
    const name = field.name.trim();
    if (!name) {
      this.showNotice('Informe um nome para o campo dinâmico.');
      return;
    }

    if (field.fieldType === 'chart' && this.chartConfig(field).chartType === 'radar' && (this.chartConfig(field).categories?.length ?? 0) < 3) {
      this.showNotice('Defina pelo menos 3 categorias distintas para o Radar.');
      return;
    }

    const duplicateName = this.dynamicFields.some((existing) => (
      existing.id !== field.id && existing.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    ));
    if (duplicateName) {
      this.showNotice('Já existe um campo dinâmico com esse nome.');
      return;
    }

    field.name = name;
    field.isEditorField = field.fieldType === 'editor';
    if (field.fieldType === 'options' || field.fieldType === 'image') {
      field.options = field.options?.trim() || undefined;
    } else if (field.fieldType === 'slider' || field.fieldType === 'list' || field.fieldType === 'chart') {
      const config = parseDynamicFieldOptions(field.fieldType, field.options);
      field.options = config ? serializeDynamicFieldOptions(config) : undefined;
    } else {
      field.options = undefined;
    }
    if (field.fieldType !== 'entity') field.targetEntityTable = undefined;

    this.uiFieldConfigService.saveDynamicField(field);
    this.loadDynamicFields();
    this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
    this.editingDynamicFieldId = '';
    delete this.listColumnDrafts[field.id];
    this.closeListColumnSuggestions();
    this.showNotice('Campo dinâmico atualizado.');
  }

  async deleteDynamicField(field: DynamicField): Promise<void> {
    const confirmed = await this.confirmService.ask(
      `Excluir o campo dinâmico "${field.name}"? Ele pode estar incluído em layouts desta entidade.`
    );
    if (!confirmed) return;

    this.dynamicFieldService.deleteDynamicField(field);
    this.loadDynamicFields();
    this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
    if (this.editingDynamicFieldId === field.id) this.editingDynamicFieldId = '';
    delete this.listColumnDrafts[field.id];
    this.closeListColumnSuggestions();
    this.showNotice('Campo dinâmico excluído.');
  }

  getDynamicFieldTypeLabel(field: DynamicField): string {
    switch (field.fieldType) {
      case 'options': return `Opções${field.options ? `: ${field.options}` : ''}`;
      case 'editor': return 'Editor de texto';
      case 'entity': return `Entidade relacionada${field.targetEntityTable ? `: ${field.targetEntityTable}` : ''}`;
      case 'image': return 'Imagem';
      case 'slider': {
        const config = this.sliderConfig(field);
        return `Slider${config.unit ? ` (${config.unit})` : ''}: ${config.min}-${config.max}`;
      }
      case 'list': {
        const config = this.listConfig(field);
        return config.mode === 'headless' ? 'Listagem headless' : `Listagem: ${config.columns.length} coluna(s)`;
      }
      case 'chart': return `Grafico ${this.chartConfig(field).chartType}`;
      default: return 'Texto';
    }
  }

  sliderConfig(field: DynamicField): SliderFieldOptions {
    return parseDynamicFieldOptions('slider', field.options) as SliderFieldOptions;
  }

  listConfig(field: DynamicField): ListFieldOptions {
    return parseDynamicFieldOptions('list', field.options) as ListFieldOptions;
  }

  chartConfig(field: DynamicField): ChartFieldOptions {
    return parseDynamicFieldOptions('chart', field.options) as ChartFieldOptions;
  }

  updateSliderConfig(field: DynamicField, key: 'min' | 'max' | 'step' | 'unit', value: string): void {
    const current = this.sliderConfig(field);
    if (key === 'unit') current.unit = value;
    else {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      current[key] = numeric;
    }
    field.options = serializeDynamicFieldOptions(current);
  }

  updateListMode(field: DynamicField, mode: string): void {
    const current = this.listConfig(field);
    current.mode = mode === 'headless' ? 'headless' : 'table';
    field.options = serializeDynamicFieldOptions(current);
  }

  updateListColumns(field: DynamicField, value: string): void {
    this.listColumnDrafts[field.id] = value;
    const current = this.listConfig(field);
    current.columns = this.parseListColumns(value);
    field.options = serializeDynamicFieldOptions(current);
  }

  listColumnsText(field: DynamicField): string {
    return this.listColumnDrafts[field.id] ?? this.formatListColumns(field);
  }

  listColumnSuggestions(value: string): ListColumnType[] {
    const entries = value.split(';');
    const current = entries[entries.length - 1]?.trim() ?? '';
    const colonIndex = current.lastIndexOf(':');
    if (colonIndex < 0) return [];
    const query = current.slice(colonIndex + 1).trim().toLowerCase();
    return this.listColumnTypeItems
      .map(item => item.value as ListColumnType)
      .filter(type => !query || type.startsWith(query));
  }

  listColumnTypeLabel(type: ListColumnType): string {
    return this.listColumnTypeItems.find(item => item.value === type)?.label ?? type;
  }

  onNewListColumnsInput(event: Event): void {
    this.newListColumns = (event.target as HTMLInputElement).value;
    this.newListColumnSuggestionsOpen = this.listColumnSuggestions(this.newListColumns).length > 0;
  }

  onNewListColumnsFocus(): void {
    this.newListColumnSuggestionsOpen = this.listColumnSuggestions(this.newListColumns).length > 0;
  }

  chooseNewListColumnType(type: ListColumnType): void {
    this.newListColumns = this.replaceActiveListColumnType(this.newListColumns, type);
    this.newListColumnSuggestionsOpen = false;
  }

  onListColumnsInput(field: DynamicField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateListColumns(field, value);
    this.activeListColumnSuggestionFieldId = this.listColumnSuggestions(value).length > 0 ? field.id : '';
  }

  onListColumnsFocus(field: DynamicField): void {
    this.activeListColumnSuggestionFieldId = this.listColumnSuggestions(this.listColumnsText(field)).length > 0 ? field.id : '';
  }

  chooseListColumnType(field: DynamicField, type: ListColumnType): void {
    const value = this.replaceActiveListColumnType(this.listColumnsText(field), type);
    this.updateListColumns(field, value);
    this.activeListColumnSuggestionFieldId = '';
  }

  closeListColumnSuggestions(): void {
    this.newListColumnSuggestionsOpen = false;
    this.activeListColumnSuggestionFieldId = '';
  }

  updateChartConfig(field: DynamicField, key: 'chartType' | 'title' | 'legend' | 'color', value: string | undefined): void {
    const current = this.chartConfig(field);
    if (key === 'chartType') current.chartType = value === 'bar' || value === 'line' ? value : 'radar';
    else if (key === 'color') {
      current.color = value && /^#[0-9a-f]{6}$/i.test(value) ? value : current.color;
      if (current.series[0]) current.series[0].color = current.color;
    }
    else current[key] = value ?? '';
    field.options = serializeDynamicFieldOptions(current);
  }

  chartSeriesText(field: DynamicField): string {
    return this.chartConfig(field).series.map(series => series.label).join('; ');
  }

  chartCategoriesText(field: DynamicField): string {
    return this.chartCategoryDrafts.get(field) ?? (this.chartConfig(field).categories ?? []).join('; ');
  }

  updateChartCategories(field: DynamicField, value: string): void {
    this.chartCategoryDrafts.set(field, value);
    const current = this.chartConfig(field);
    current.categories = this.parseChartCategories(value);
    field.options = serializeDynamicFieldOptions(current);
  }

  private parseChartCategories(value: string): string[] {
    return [...new Set(value.split(';').map(item => item.trim()).filter(Boolean))].slice(0, 12);
  }

  updateChartSeries(field: DynamicField, value: string): void {
    const current = this.chartConfig(field);
    current.series = this.parseChartSeries(value, current.color, current.series);
    field.options = serializeDynamicFieldOptions(current);
  }

  private newFieldOptionsForType(): string | undefined {
    if (this.newFieldType === 'options') return this.newFieldOptions.trim();
    if (this.newFieldType === 'image') return this.newFieldImageAspectRatio;
    if (this.newFieldType === 'slider') {
      const fallback = defaultSliderFieldOptions();
      const min = this.numericOr(this.newSliderMin, fallback.min);
      const max = Math.max(min, this.numericOr(this.newSliderMax, fallback.max));
      const step = Math.max(Number.EPSILON, this.numericOr(this.newSliderStep, fallback.step));
      return serializeDynamicFieldOptions({ version: 1, kind: 'slider', min, max, step, unit: this.newSliderUnit.trim(), defaultValue: min });
    }
    if (this.newFieldType === 'list') {
      return serializeDynamicFieldOptions({ version: 1, kind: 'list', mode: this.newListMode, columns: this.parseListColumns(this.newListColumns) });
    }
    if (this.newFieldType === 'chart') {
      const color = /^#[0-9a-f]{6}$/i.test(this.newChartColor) ? this.newChartColor : '#facc15';
      return serializeDynamicFieldOptions({ version: 1, kind: 'chart', chartType: this.newChartType, title: this.newChartTitle.trim(), legend: this.newChartLegend.trim(), color, categories: this.parseChartCategories(this.newChartCategories), series: this.parseChartSeries(this.newChartSeries, color) });
    }
    return undefined;
  }

  private resetNewStructuredFieldConfig(): void {
    this.newSliderMin = '0';
    this.newSliderMax = '100';
    this.newSliderStep = '1';
    this.newSliderUnit = '';
    this.newListMode = 'table';
    this.newListColumns = 'Item';
    this.newChartType = 'radar';
    this.newChartTitle = '';
    this.newChartLegend = '';
    this.newChartColor = '#facc15';
    this.newChartSeries = 'Serie 1';
    this.newChartCategories = 'Categoria 1; Categoria 2; Categoria 3';
  }

  private parseListColumns(value: string): ListColumn[] {
    const columns = value.split(';').map((entry, index) => {
      const [rawLabel, rawType] = entry.split(':');
      const label = (rawLabel ?? '').trim();
      if (!label) return null;
      const type: ListColumnType = rawType?.trim() === 'number' || rawType?.trim() === 'boolean' || rawType?.trim() === 'date' ? rawType.trim() as ListColumnType : 'text';
      const id = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `column-${index + 1}`;
      return { id, label, type };
    }).filter((column): column is ListColumn => !!column);
    return columns.length ? columns : defaultListFieldOptions().columns;
  }

  private replaceActiveListColumnType(value: string, type: ListColumnType): string {
    const entries = value.split(';');
    const index = entries.length - 1;
    const current = entries[index]?.trim() ?? '';
    const colonIndex = current.lastIndexOf(':');
    if (colonIndex < 0) return value;
    entries[index] = `${current.slice(0, colonIndex).trim()}:${type}`;
    return entries.join('; ');
  }

  private formatListColumns(field: DynamicField): string {
    return this.listConfig(field).columns.map(column => column.type === 'text' ? column.label : `${column.label}:${column.type}`).join('; ');
  }

  private parseChartSeries(value: string, fallbackColor: string, previous: Array<{ id: string; label: string; color: string }> = []): Array<{ id: string; label: string; color: string }> {
    const labels = value.split(';').map(item => item.trim()).filter(Boolean).slice(0, 8);
    if (!labels.length) labels.push('Serie 1');
    return labels.map((label, index) => ({
      id: previous[index]?.id || `series-${index + 1}`,
      label,
      color: previous[index]?.color || (index === 0 ? fallbackColor : CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]),
    }));
  }

  private numericOr(value: string, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  numberText(value: number): string { return String(value); }

  async deleteActiveTemplate(): Promise<void> {
    if (!this.activeTemplateId) return;

    const templateId = this.activeTemplateId;
    const templateName = this.activeTemplateName.trim() || 'este layout';
    const confirmed = await this.confirmService.ask(
      `Excluir o layout "${templateName}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    this.uiFieldConfigService.deleteTemplate(templateId);
    this.activeTemplateId = '';
    this.activeTemplateName = '';
    this.selectedTemplateId = '';
    this.scopeMode = this.entityId ? 'entity' : 'global';
    this.refreshTemplates();
    this.layout = this.uiFieldConfigService.getResolvedConfig(this.entityTable, this.entityId);
    this.ensureActiveTab();
    this.templatesChanged.emit();
    this.showNotice(`Layout "${templateName}" excluído.`);
  }

  private getDefaultWidth(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    if (!catalogItem) return 4;
    if (catalogItem.fieldType === 'image') return 4;
    if (catalogItem.fieldType === 'chart' || catalogItem.fieldType === 'list') return 6;
    return catalogItem.isEditorField ? 6 : 4;
  }

  private getDefaultHeight(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    if (!catalogItem) return 1;
    if (catalogItem.fieldType === 'image') return 6;
    if (catalogItem.fieldType === 'slider') return 2;
    if (catalogItem.fieldType === 'chart') return 6;
    if (catalogItem.fieldType === 'list') return 4;
    return catalogItem.isEditorField ? 6 : 1;
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
