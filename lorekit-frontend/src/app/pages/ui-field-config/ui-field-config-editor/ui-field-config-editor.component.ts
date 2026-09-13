import { NgStyle } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { createFieldLayoutItem, UiConfigPayload, UiFieldCatalogItem, UiFieldLayoutItem, UiFieldLayoutTab, UiFieldTemplate, validateUiConfigPayload } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';
import { UiFieldLayoutPortabilityService } from '../../../services/ui-field-layout-portability.service';
import { DynamicField } from '../../../models/dynamicfields.model';
import { DbProvider } from '../../../app.config';
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
  template: `
    <div class=" flex flex-col gap-4 h-full">
      <div class="flex flex-row items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          @if (scopeMode === 'template' && activeTemplateName) {
            <h1 class="text-xl font-semibold text-white">Editando Template: {{ activeTemplateName }}</h1>
          } @else {
            <h1 class="text-xl font-semibold text-white">Configurar Layout de Campos</h1>
          }
          <p class="text-sm text-zinc-400">Arraste campos para o grid e redimensione pelas bordas.</p>
        </div>
        @if (isDialogMode) {
          <app-icon-button title="Fechar" icon="fa-solid fa-xmark" buttonType="secondaryActive" size="base" (click)="closeDialog()"></app-icon-button>
        } @else {
          <app-button label="Voltar" buttonType="secondary" size="xs" [route]="backRoute"></app-button>
        }
      </div>

      <div class="flex flex-wrap gap-4 items-end bg-zinc-925 p-3 rounded-lg border border-zinc-800">
        <app-combo-box
          class="min-w-0 md:min-w-56"
          label="Escopo"
          [items]="scopeModeItems"
          compareProp="value"
          displayProp="label"
          [comboValue]="scopeMode"
          (comboValueChange)="onScopeModeChange($event)">
        </app-combo-box>

        @if (scopeMode === 'template') {
          <app-combo-box
            class="min-w-0 md:min-w-72"
            label="Template"
            [items]="availableTemplates"
            compareProp="value"
            displayProp="label"
            [comboValue]="selectedTemplateId"
            (comboValueChange)="onTemplateSelected($event)">
          </app-combo-box>

          @if (activeTemplateId) {
            <app-input
              class="min-w-0 md:min-w-56"
              label="Nome do template"
              [(value)]="activeTemplateName">
            </app-input>
          }
        }

        @if (scopeMode === 'parent' && parentScopeOptions.length > 0) {
          <app-combo-box
            class="min-w-0 md:min-w-72"
            label="Pai"
            [items]="parentScopeItems"
            compareProp="value"
            displayProp="label"
            [(comboValue)]="selectedParentScopeKey">
          </app-combo-box>
        }

        @if (scopeMode === 'parent' && allowParentSelection) {
          <app-combo-box
            class="min-w-0 md:min-w-48"
            label="Tabela Pai"
            [items]="parentSelectableTables"
            [comboValue]="selectedParentTable"
            (comboValueChange)="onParentTableChange($event)">
          </app-combo-box>

          <app-combo-box
            class="min-w-0 md:min-w-72"
            label="Entidade Pai"
            [items]="parentEntityItems"
            compareProp="id"
            displayProp="label"
            [(comboValue)]="selectedParentEntityId">
          </app-combo-box>
        }

        <div class="flex flex-col items-end gap-1 ms-auto">
          <div class="flex flex-row gap-2">
            @if (scopeMode !== 'template') {
              <app-icon-button title="Padrão do Sistema" icon="fa-solid fa-computer" buttonType="white" size="base" (click)="confirmResetToDefault()"></app-icon-button>
              <app-icon-button title="Criar Template" icon="fa-solid fa-bookmark" buttonType="white" size="base" (click)="toggleCreateTemplateForm()"></app-icon-button>
            }
            <app-icon-button title="Exportar Layout" icon="fa-solid fa-download" buttonType="white" size="base" (click)="exportLayout()"></app-icon-button>
            <app-icon-button title="Salvar Layout" icon="fa-solid fa-floppy-disk" buttonType="primary" size="base" (click)="save()"></app-icon-button>
          </div>

          @if (showCreateTemplateForm) {
            <div class="flex flex-row gap-2 items-end mt-2">
              <app-input label="Nome do template" [placeholder]="'Ex: Ficha de combate'" [(value)]="newTemplateName"></app-input>
              <app-button label="Confirmar" buttonType="primary" size="xs" (click)="confirmCreateTemplate()"></app-button>
              <app-button label="Cancelar" buttonType="secondary" size="xs" (click)="showCreateTemplateForm = false; newTemplateName = ''"></app-button>
            </div>
          }

          @if (noticeMessage) {
            <span class="text-xs text-emerald-300">{{ noticeMessage }}</span>
          }
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-925 p-3">
        @for (tab of layout.tabs; track tab.id) {
          <button type="button" class="rounded px-3 py-2 text-sm"
            [class.bg-zinc-700]="tab.id === activeTabId" (click)="selectLayoutTab(tab.id)">{{ tab.name }}</button>
        }
        <app-icon-button title="Nova aba" icon="fa-solid fa-plus" size="xs" buttonType="primary" (click)="addLayoutTab()"></app-icon-button>
        <app-icon-button title="Mover aba para esquerda" icon="fa-solid fa-arrow-left" size="xs" buttonType="secondary" (click)="moveLayoutTab(-1)"></app-icon-button>
        <app-icon-button title="Mover aba para direita" icon="fa-solid fa-arrow-right" size="xs" buttonType="secondary" (click)="moveLayoutTab(1)"></app-icon-button>
        <app-icon-button title="Excluir aba" icon="fa-solid fa-trash" size="xs" buttonType="danger" (click)="removeLayoutTab()"></app-icon-button>
        <app-input class="min-w-56" label="Nome da aba" [(value)]="activeTab.name"></app-input>
        <div class="ms-auto flex items-center gap-2 text-xs text-zinc-400">
          <span>Arraste os elementos para o grid</span>
          <div class="catalog-item catalog-item--separator" draggable="true" (dragstart)="onSeparatorDragStart($event, 'horizontal')" (dragend)="clearDragState()">Separador horizontal</div>
          <div class="catalog-item catalog-item--separator" draggable="true" (dragstart)="onSeparatorDragStart($event, 'vertical')" (dragend)="clearDragState()">Separador vertical</div>
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
            (drop)="onGridDrop($event)"
            (click)="closeContextMenu()">

            @for (item of activeTab.items; track item.id) {
              <div
                class="layout-item"
                [class.layout-item--separator]="item.kind === 'separator'"
                [ngStyle]="getItemStyle(item)"
                (mousedown)="startMove($event, item)"
                (click)="openItemMenu($event, item)">
                @if (item.kind === 'separator') {
                  <div class="layout-separator-preview" [class.layout-separator-preview--vertical]="item.orientation === 'vertical'" [style.color]="item.color || null">
                    <span></span>@if (item.label) { <b>{{ item.label }}</b> }<span></span>
                  </div>
                } @else {
                  <div class="layout-item-header">
                    <span>{{ getItemLabel(item) }}</span>
                    <span class="text-[10px] text-zinc-400">Editar</span>
                  </div>
                  <div class="layout-item-body"><span>{{ item.width }} x {{ item.height }}</span></div>
                }

                @if (item.kind === 'separator') {
                  <div class="separator-resize-handle"
                    [class.separator-resize-handle--vertical]="item.orientation === 'vertical'"
                    (mousedown)="startResize($event, item, item.orientation === 'horizontal' ? 'right' : 'bottom')"></div>
                } @else {
                  <div class="resize-handle-right" (mousedown)="startResize($event, item, 'right')"></div>
                  <div class="resize-handle-bottom" (mousedown)="startResize($event, item, 'bottom')"></div>
                  <div class="resize-handle-corner" (mousedown)="startResize($event, item, 'corner')"></div>
                }
              </div>
            }
            @if (contextMenuItem; as item) {
              <div #contextMenuElement class="layout-context-menu" [style.left.px]="contextMenu!.x" [style.top.px]="contextMenu!.y"
                (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation()">
                <div class="flex items-center justify-between gap-4"><strong>{{ getItemLabel(item) }}</strong><button type="button" (click)="closeContextMenu()">×</button></div>
                <span class="text-xs text-zinc-400">{{ item.width }} x {{ item.height }}</span>
                @if (item.kind === 'separator') {
                  <app-input label="Título opcional" size="xs" [(value)]="item.label"></app-input>
                  <div class="flex gap-2">
                    <app-button label="Horizontal" buttonType="secondary" size="xs" (click)="item.orientation = 'horizontal'"></app-button>
                    <app-button label="Vertical" buttonType="secondary" size="xs" (click)="item.orientation = 'vertical'"></app-button>
                  </div>
                }
                <app-hex-color-picker label="Destaque" [(value)]="item.color"></app-hex-color-picker>
                <app-button label="Remover" buttonType="danger" size="xs" (click)="removeItem(item.id)"></app-button>
              </div>
            }
          </div>
        </div>

        <div class="bg-zinc-925 rounded-lg border border-zinc-800 p-3 h-[65vh] overflow-y-auto scrollbar-dark flex flex-col min-h-0">
          <div class="border-b border-zinc-800 bg-zinc-925 p-3 mb-6 pb-6">
            <div class="text-sm text-zinc-200 mb-2">Novo campo dinamico</div>

            <div class="flex flex-col gap-2">
              <app-input
                label="Nome do campo"
                [placeholder]="'Digite o nome do campo'"
                [(value)]="newFieldName">
              </app-input>

              <app-combo-box
                label="Tipo"
                [items]="fieldTypeItems"
                compareProp="value"
                displayProp="label"
                [(comboValue)]="newFieldType">
              </app-combo-box>

              @if (newFieldType === 'options') {
                <app-input
                  label="Opcoes"
                  [placeholder]="'Separe por ; (ex: op1;op2;op3)'"
                  [(value)]="newFieldOptions">
                </app-input>
              }

              @if (newFieldType === 'entity') {
                <app-combo-box
                  label="Entidade relacionada"
                  [items]="entityTableOptions"
                  [(comboValue)]="newFieldTargetEntityTable">
                </app-combo-box>
              }
              @if (newFieldType === 'image') {
                <app-combo-box
                  label="Propor??o do recorte"
                  [items]="imageAspectRatioItems"
                  compareProp="value"
                  displayProp="label"
                  [(comboValue)]="newFieldImageAspectRatio">
                </app-combo-box>
              }


              <div class="flex justify-end">
                <app-icon-button
                  title="Criar Campo"
                  buttonType="primary"
                  size="xs"
                  [disabled]="creatingDynamicField"
                  (click)="createDynamicField()">
                </app-icon-button>
              </div>
            </div>
          </div>

          <div class="text-sm text-zinc-300 mb-3">Campos disponiveis</div>
          <div class="flex flex-col gap-2 pr-1 min-h-0 flex-1">
            @for (field of catalog; track field.token) {
              <div
                class="catalog-item relative"
                [class.catalog-item--disabled]="isTokenPlaced(field.token)"
                [attr.draggable]="!isTokenPlaced(field.token)"
                (dragstart)="onCatalogDragStart($event, field.token)">
                <div class="flex flex-col">
                  <span class="text-sm">{{ field.label }}</span>
                  <span class="text-[11px] text-zinc-400">{{ field.source }}{{ field.fieldType && field.fieldType !== 'text' ? ' · ' + field.fieldType : '' }}{{ field.isEditorField && field.fieldType === 'text' ? ' - editor' : '' }}</span>
                </div>
                @if (isTokenPlaced(field.token)){
                  <div class="absolute bottom-1 right-2" >
                    <p class="text-xs">Presente no Grid</p>
                  </div>
                }

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
  private uiFieldLayoutPortabilityService = inject(UiFieldLayoutPortabilityService);
  private confirmService = inject(ConfirmService);

  entityTable = '';
  entityId: string | null = null;
  backRoute = '/app/culture/list';

  catalog: UiFieldCatalogItem[] = [];
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
  newFieldType: 'text' | 'options' | 'editor' | 'entity' | 'image' = 'text';
  newFieldTargetEntityTable = '';
  newFieldImageAspectRatio = '1';
  creatingDynamicField = false;

  readonly fieldTypeItems = [
    { value: 'text', label: 'Texto' },
    { value: 'options', label: 'Opcoes (combobox)' },
    { value: 'editor', label: 'Editor de texto' },
    { value: 'entity', label: 'Entidade relacionada' },
    { value: 'image', label: 'Imagem' },
  ];
  readonly imageAspectRatioItems = [
    { value: '1', label: 'Quadrada (1:1)' },
    { value: '0.8', label: 'Retrato (4:5)' },
    { value: '0.6666666667', label: 'Retrato (2:3)' },
    { value: '1.3333333333', label: 'Paisagem (4:3)' },
    { value: '1.7777777778', label: 'Paisagem (16:9)' },
    { value: '5', label: 'Banner (5:1)' },
  ];


  get entityTableOptions(): string[] {
    const ignored = new Set([
      'Personalization', 'Image', 'DynamicField', 'DynamicFieldValue', 'Document',
      'UiFieldConfig', 'UiFieldTemplate', 'LocationCategory', 'Relationship',
      'GlobalParameter', 'OrganizationType', 'Link',
    ]);
    return schema.map((t) => t.name).filter((name) => !ignored.has(name));
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
    this.entityTable = this.dialogData?.entityTable ?? queryMap.get('entityTable') ?? '';
    this.entityId = this.dialogData?.entityId ?? queryMap.get('entityId');
    this.backRoute = this.dialogData?.backRoute ?? queryMap.get('backRoute') ?? '/app/culture/list';

    // if (!this.entityTable) {
    //   this.router.navigate(['/app']);
    //   return;
    // }

    this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);
    this.refreshTemplates();

    const incomingTemplateId = this.dialogData?.templateId as string | undefined;
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

    const requestedScopeMode = this.dialogData?.scopeMode as 'entity' | 'parent' | 'global' | 'template' | undefined;
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
      this.uiFieldConfigService.updateTemplate(this.activeTemplateId, this.activeTemplateName, cleanedLayout);

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

    this.creatingDynamicField = true;
    try {
      const dynamicField = new DynamicField('', name, this.entityTable, '');
      dynamicField.fieldType = this.newFieldType;
      dynamicField.isEditorField = this.newFieldType === 'editor';
      dynamicField.options = this.newFieldType === 'options'
        ? this.newFieldOptions.trim()
        : this.newFieldType === 'image'
          ? this.newFieldImageAspectRatio
          : undefined;
      dynamicField.targetEntityTable = this.newFieldType === 'entity' ? this.newFieldTargetEntityTable : undefined;

      this.uiFieldConfigService.saveDynamicField(dynamicField);
      this.catalog = this.uiFieldConfigService.getCatalog(this.entityTable);

      this.newFieldName = '';
      this.newFieldOptions = '';
      this.newFieldType = 'text';
      this.newFieldTargetEntityTable = '';
      this.showNotice('Campo dinamico criado.');
      this.newFieldImageAspectRatio = '1';
    } finally {
      this.creatingDynamicField = false;
    }
  }

  private getDefaultWidth(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    if (!catalogItem) return 4;
    if (catalogItem.fieldType === 'image') return 4;
    return catalogItem.isEditorField ? 6 : 4;
  }

  private getDefaultHeight(token: string): number {
    const catalogItem = this.catalog.find((item) => item.token === token);
    if (!catalogItem) return 1;
    if (catalogItem.fieldType === 'image') return 6;
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
