import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, effect, input } from '@angular/core';
import { SlicePipe, NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { InputComponent } from '../../../components/input/input.component';
import { LinkService, SelectableTable } from '../../../services/link.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorldStateService } from '../../../services/world-state.service';
import { GraphEdge, GraphNode, GraphView } from '../../../libs/relationship-graph/relationship-graph.types';
import type { TabEntityType } from '../../../models/workspace.model';
import { GRAPH_CANVAS_HEIGHT, GRAPH_CANVAS_WIDTH, makeNodeKey } from '../../../libs/relationship-graph/relationship-graph.utils';
import { buildImageUrl } from '../../../models/image.model';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
@Component({
  selector: 'app-relation-graph',
  imports: [FormsModule, NgClass, SlicePipe, ComboBoxComponent, InputComponent, IconButtonComponent],
  host: {
    '(window:touchmove)': 'onGraphTouchMove($event)',
    '(window:touchend)': 'onGraphTouchEnd()',
    '(window:touchcancel)': 'onGraphTouchEnd()',
  },
  template: `
    <div class="flex flex-col pt-2 gap-4 @container">
      <div class="flex flex-wrap items-end gap-3">
        <app-combo-box class="w-56" label="Tipo da entidade" size="xs" [items]="tableOptions" compareProp="value" displayProp="label" [(comboValue)]="selectedTable" (comboValueChange)="onTableChange()" />
        <app-combo-box class="w-full md:w-80" label="Entidade principal (opcional)" [items]="entityOptions" compareProp="id" displayProp="label" [(comboValue)]="selectedEntityId" (comboValueChange)="onRootEntitySelected()" />
        <div class="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 min-h-9 flex items-center">{{ scopeLabel }}</div>
      </div>

      @if (graphView; as graph) {
        <div class="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1fr)_22rem] gap-4">
          <div class="rounded-lg border border-zinc-800 bg-zinc-925 overflow-hidden relative cursor-grab touch-none" [ngClass]="{'!cursor-grabbing': isPanning}" (click)="onCanvasClick($event)" (wheel)="onGraphWheel($event)" (mousedown)="startPan($event)" (touchstart)="onGraphTouchStart($event)">
            <div class="absolute z-20 top-2 right-2 flex gap-1 rounded-md border border-zinc-700 bg-zinc-900/90 p-1">
              <button type="button" aria-label="Diminuir zoom" class="w-7 h-7 rounded hover:bg-zinc-800 cursor-pointer" (click)="$event.stopPropagation(); zoomOut()">-</button>
              <span class="w-10 h-7 flex items-center justify-center text-xs text-zinc-400">{{ zoomPercent }}%</span>
              <button type="button" aria-label="Aumentar zoom" class="w-7 h-7 rounded hover:bg-zinc-800 cursor-pointer" (click)="$event.stopPropagation(); zoomIn()">+</button>
              <button type="button" aria-label="Centralizar grafo" class="w-7 h-7 rounded hover:bg-zinc-800 cursor-pointer" (click)="$event.stopPropagation(); centerViewport()">◎</button>
            </div>
            @if (graph.nodes.length === 0) {
              <div class="absolute inset-0 flex items-center justify-center p-8 text-center pointer-events-none"><span class="text-sm text-zinc-400">{{ emptyGraphMessage }}</span></div>
            }
            <svg #graphSvg class="w-full h-[min(60dvh,32rem)] md:h-[calc(100vh-10.5rem)]" [attr.viewBox]="graphViewBox" role="img" [attr.aria-label]="'Grafo de relações. ' + graph.nodes.length + ' entidades.'">
              <defs>
                <marker id="relation-arrow-head" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 9 3.5 L 0 7 z" class="fill-zinc-300" /></marker>
              </defs>
              @for (edge of graph.edges; track edge.id) {
                @if (edgeGeometry(edge); as geometry) {
                  <path [attr.d]="geometry.path" fill="none" stroke-width="2" stroke-linecap="round" [ngClass]="edgeClasses(edge)" [attr.marker-end]="'url(#relation-arrow-head)'" role="button" [attr.tabindex]="0" [attr.aria-label]="'Relação: ' + edgeLabel(edge)" (click)="$event.stopPropagation(); startEditLink(edge)" (keydown.enter)="startEditLink(edge)" (keydown.space)="$event.preventDefault(); startEditLink(edge)"><title>{{ edgeLabel(edge) }}</title></path>
                  <path [attr.d]="geometry.path" fill="none" stroke="transparent" stroke-width="14" class="cursor-pointer" (click)="$event.stopPropagation(); startEditLink(edge)" />
                }
              }
              @for (node of graph.nodes; track node.key) {
                <g [attr.transform]="'translate(' + node.x + ' ' + node.y + ')'" [attr.tabindex]="0" role="button" [attr.aria-label]="node.label + ', ' + nodeTypeLabel(node.table)" class="cursor-pointer outline-none" (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation(); selectNode(node)" (keydown.enter)="selectNode(node)" (keydown.space)="$event.preventDefault(); selectNode(node)">
                  @if (node.imagePath) { <defs><clipPath [attr.id]="nodeClipId(node)"><circle [attr.r]="node.radius" /></clipPath></defs><image [attr.x]="-node.radius" [attr.y]="-node.radius" [attr.width]="node.radius * 2" [attr.height]="node.radius * 2" [attr.href]="buildImageUrl(node.imagePath)" [attr.clip-path]="'url(#' + nodeClipId(node) + ')'" preserveAspectRatio="xMidYMid slice" /> }
                  <circle [attr.r]="node.radius" [ngClass]="nodeClasses(node)" [style.fill]="nodeFill(node)" [style.stroke]="nodeStroke(node)" [style.stroke-width]="nodeStrokeWidth(node)" />
                  @if (!node.imagePath) { <text y="5" text-anchor="middle" class="fill-zinc-300 text-base font-semibold pointer-events-none">{{ nodeInitials(node.label) }}</text> }
                  <circle [attr.r]="node.radius" fill="none" [style.stroke]="nodeStroke(node)" [style.stroke-width]="nodeStrokeWidth(node)" class="pointer-events-none" />
                  <text [attr.y]="nodeLabelY(node)" text-anchor="middle" class="fill-white text-xs font-semibold pointer-events-none">{{ node.label | slice:0:nodeLabelLimit(node) }}</text>
                  <text [attr.y]="nodeTypeY(node)" text-anchor="middle" class="fill-zinc-400 text-[10px] pointer-events-none">{{ nodeTypeLabel(node.table) }}</text>
                </g>
              }
              @for (edge of graph.edges; track edge.id) {
                @if (edgeGeometry(edge); as geometry) {
                  @if (showEdgeLabel(edge, graph)) { <text [attr.x]="geometry.labelX" [attr.y]="geometry.labelY" text-anchor="middle" class="relation-edge-label fill-zinc-200 text-xs cursor-pointer" (click)="$event.stopPropagation(); startEditLink(edge)">{{ edgeLabel(edge) }}</text> }
                }
              }
            </svg>
          </div>
          <aside class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3 max-h-[75vh] overflow-y-auto scrollbar-dark" aria-label="Painel de relações">
            @if (selectedNode; as node) {
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-sm font-bold" [style.background]="nodeFill(node)" [style.border]="'2px solid ' + nodeStroke(node)">{{ nodeInitials(node.label) }}</div>
                <div class="min-w-0"><h3 class="text-base font-bold text-white truncate">{{ node.label }}</h3><div class="text-xs text-zinc-400">{{ nodeTypeLabel(node.table) }} · {{ scopeLabel }}</div></div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-md bg-zinc-925 border border-zinc-800 px-3 py-2"><div class="text-zinc-500">Saindo</div><div class="text-white text-lg font-semibold">{{ outgoingEdges(graph).length }}</div></div>
                <div class="rounded-md bg-zinc-925 border border-zinc-800 px-3 py-2"><div class="text-zinc-500">Chegando</div><div class="text-white text-lg font-semibold">{{ incomingEdges(graph).length }}</div></div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded-md bg-yellow-500 px-3 py-2 text-xs font-semibold text-zinc-900 cursor-pointer disabled:opacity-50" [disabled]="node.isRoot" (click)="makeSelectedNodeRoot()">Tornar entidade principal</button>
                <button type="button" class="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 cursor-pointer hover:bg-zinc-800" (click)="openSelectedNodeInNewTab()">Abrir relações</button>
                <button type="button" class="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 cursor-pointer hover:bg-zinc-800" (click)="openSelectedEntityInNewTab()">Abrir entidade</button>
                <button type="button" class="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 cursor-pointer hover:bg-zinc-800" (click)="startNewRelation()">Nova relação</button>
              </div>
              @if (relationEditorOpen) {
                <div class="border-t border-zinc-800 pt-3 mt-1 flex flex-col gap-3">
                  <div class="flex items-center justify-between"><h4 class="text-sm font-semibold">{{ editingLinkId ? 'Editar relação' : 'Nova relação' }}</h4><button type="button" class="text-zinc-400 hover:text-white text-xs cursor-pointer" (click)="resetDraft()">Cancelar</button></div>
                  <div class="text-xs text-zinc-400">Origem: {{ relationDraftFromLabel || relationDraft.fromId }}</div>
                  <app-combo-box label="Tabela de destino" [items]="tableOptions" compareProp="value" displayProp="label" [(comboValue)]="relationDraft.toTable" (comboValueChange)="onDraftToTableChange()" />
                  <app-combo-box label="Entidade de destino" [items]="draftTargetEntities" compareProp="id" displayProp="label" [(comboValue)]="relationDraft.toId" />
                  <app-input label="Nome da relação" [(value)]="relationDraft.name" />
                  <div class="flex gap-2">
                    <app-icon-button [title]="editingLinkId ? 'Salvar relação' : 'Criar relação'" [icon]="editingLinkId ? 'fa-solid fa-floppy-disk' : 'fa-solid fa-plus'" size="xs" buttonType="white" (click)="saveDraftRelation()" />
                    @if (editingLinkId) {
                      <app-icon-button title="Inverter direção" icon="fa-solid fa-arrow-right-arrow-left" size="xs" buttonType="white" (click)="invertEditingLink()" />
                      <app-icon-button title="Excluir relação" icon="fa-solid fa-trash-can" size="xs" buttonType="danger" (click)="deleteEditingLink()" />
                    }
                    <app-icon-button title="Cancelar edição" icon="fa-solid fa-xmark" size="xs" buttonType="danger" (click)="resetDraft()" />
                  </div>
                </div>
              }
              <div class="border-t border-zinc-800 pt-3 mt-1"><h4 class="text-sm font-semibold mb-2">Relações de saída</h4>
                @for (edge of outgoingEdges(graph); track edge.id) { <button type="button" class="w-full text-left rounded-md border border-zinc-800 bg-zinc-925 hover:bg-zinc-800 px-2 py-2 cursor-pointer" [ngClass]="editingLinkId === edge.id ? 'border-yellow-500 bg-yellow-500/10' : ''" (click)="startEditLink(edge)"><div class="text-xs text-zinc-400">{{ edge.link.toTable }} · {{ edge.link.toId }}</div><div class="text-sm text-white">{{ edgeLabel(edge) }}</div></button> }
                @if (outgoingEdges(graph).length === 0) { <div class="text-xs text-zinc-500">Nenhuma relação de saída.</div> }
              </div>
              <div class="border-t border-zinc-800 pt-3 mt-1"><h4 class="text-sm font-semibold mb-2">Relações de chegada</h4>
                @for (edge of incomingEdges(graph); track edge.id) { <button type="button" class="w-full text-left rounded-md border border-zinc-800 bg-zinc-925 hover:bg-zinc-800 px-2 py-2 cursor-pointer" [ngClass]="editingLinkId === edge.id ? 'border-yellow-500 bg-yellow-500/10' : ''" (click)="startEditLink(edge)"><div class="text-xs text-zinc-400">{{ edge.link.fromTable }} · {{ edge.link.fromId }}</div><div class="text-sm text-white">{{ edgeLabel(edge) }}</div></button> }
                @if (incomingEdges(graph).length === 0) { <div class="text-xs text-zinc-500">Nenhuma relação de chegada.</div> }
              </div>
            } @else {
              <div class="flex flex-col gap-2 text-sm text-zinc-400"><h3 class="text-base font-bold text-white">Inspeção</h3><p>Selecione um círculo para consultar relações e abrir ações de edição.</p><p class="text-xs text-zinc-500">O layout é automático; use zoom e pan para navegar pela teia.</p></div>
            }
          </aside>
        </div>
      } @else {
        <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">Não foi possível carregar a entidade principal selecionada.</div>
      }
    </div>
  `,
  styleUrl: './relation-graph.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class RelationGraphComponent implements OnInit {
  public buildImageUrl = buildImageUrl;
  @ViewChild('graphSvg') graphSvg?: ElementRef<SVGSVGElement>;

  rootTable = input<string | null>(null);
  rootId = input<string | null>(null);

  canvasWidth = GRAPH_CANVAS_WIDTH;
  canvasHeight = GRAPH_CANVAS_HEIGHT;
  zoomLevel = 1;
  zoomStep = 0.1;
  panX = 0;
  panY = 0;
  isPanning = false;

  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private movedDuringPan = false;
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private initialized = false;

  graphView: GraphView | null = null;
  tableOptions: SelectableTable[] = [];
  entityOptions: Array<{ table: string; id: string; label: string }> = [];
  draftTargetEntities: Array<{ table: string; id: string; label: string }> = [];

  selectedTable = '';
  selectedEntityId: string | null = null;

  currentRootTable = '';
  currentRootId = '';
  currentWorldId = '';
  currentWorldName = '';

  selectedNodeKey = '';
  currentSelectedTable = '';
  currentSelectedId = '';

  editingLinkId: string | null = null;
  relationEditorOpen = false;
  relationDraft: {
    fromTable: string;
    fromId: string;
    toTable: string;
    toId: string;
    name: string;
  } = {
    fromTable: '',
    fromId: '',
    toTable: '',
    toId: '',
    name: '',
  };
  relationDraftFromLabel = '';

  hasInputRoot = computed(() => !!this.rootTable() && !!this.rootId());

  constructor(
    private linkService: LinkService,
    private route: ActivatedRoute,
    private tabManager: TabManagerService,
    private worldStateService: WorldStateService,
    private destroyRef: DestroyRef,
  ) {
    effect(() => {
      const inputTable = this.rootTable();
      const inputId = this.rootId();

      if (!this.initialized) {
        return;
      }

      if (inputTable && inputId) {
        this.setRoot(inputTable, inputId, true);
      } else if (this.currentRootTable || this.currentRootId) {
        this.clearRoot();
      }
    });
  }

  ngOnInit(): void {
    this.tableOptions = this.linkService.getSelectableTables();

    const currentWorld = this.worldStateService.getCurrentWorld();
    this.currentWorldId = currentWorld?.id || '';
    this.currentWorldName = currentWorld?.name || '';

    const inputTable = this.rootTable();
    const inputId = this.rootId();
    const queryTable = this.route.snapshot.queryParamMap.get('table');
    const queryId = this.route.snapshot.queryParamMap.get('id');

    if (inputTable && inputId) {
      this.setRoot(inputTable, inputId, true);
    } else if (queryTable && queryId) {
      this.setRoot(queryTable, queryId, true);
    } else {
      this.selectedTable = this.tableOptions[0]?.value || '';
      this.onTableChange();
      this.loadGraph();
    }

    this.initialized = true;

    this.worldStateService.currentWorld$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(world => this.onWorldChanged(world?.id || '', world?.name || ''));
  }

  get graphViewBox(): string {
    const graphWidth = this.graphView?.width || this.canvasWidth;
    const graphHeight = this.graphView?.height || this.canvasHeight;
    const viewWidth = graphWidth / this.zoomLevel;
    const viewHeight = graphHeight / this.zoomLevel;
    const x = (graphWidth - viewWidth) / 2 - this.panX;
    const y = (graphHeight - viewHeight) / 2 - this.panY;
    return x + ' ' + y + ' ' + viewWidth + ' ' + viewHeight;
  }

  get zoomPercent(): number {
    return Math.round(this.zoomLevel * 100);
  }

  get selectedNode(): GraphNode | null {
    return this.graphView?.nodes.find(node => node.key === this.selectedNodeKey) || null;
  }

  get effectiveScopeWorldId(): string | null {
    if (this.currentRootTable && this.currentRootId) {
      return this.linkService.getWorldIdForEntity(this.currentRootTable, this.currentRootId);
    }

    return this.currentWorldId || null;
  }

  get scopeLabel(): string {
    if (this.currentRootTable && this.currentRootId) {
      const root = this.linkService.getEntitySummary(this.currentRootTable, this.currentRootId);
      const world = this.effectiveScopeWorldId
        ? this.linkService.getEntitySummary('World', this.effectiveScopeWorldId)
        : null;
      return 'Foco: ' + (root?.label || this.currentRootId) + ' · Escopo: ' + (world?.label || 'global');
    }

    return this.currentWorldId
      ? 'Mundo: ' + (this.currentWorldName || this.currentWorldId)
      : 'Escopo: global';
  }

  get emptyGraphMessage(): string {
    if (this.effectiveScopeWorldId) {
      return 'Não há entidades disponíveis no mundo ' + (this.currentWorldName || this.effectiveScopeWorldId) + '.';
    }

    return 'Não há entidades disponíveis para montar a visão global.';
  }

  onTableChange(): void {
    this.entityOptions = this.linkService.getEntitiesByTable(this.selectedTable, this.effectiveScopeWorldId);

    if (this.currentRootTable === this.selectedTable && this.currentRootId) {
      this.selectedEntityId = this.currentRootId;
    } else {
      this.selectedEntityId = null;
    }
  }

  onRootEntitySelected(): void {
    if (!this.selectedEntityId) {
      this.clearRoot();
      return;
    }

    this.setRoot(this.selectedTable, this.selectedEntityId, true);
  }

  refreshGraph(): void {
    this.loadGraph();
  }

  private loadGraph(): void {
    const rootReference = this.currentRootTable && this.currentRootId
      ? { table: this.currentRootTable, id: this.currentRootId }
      : null;
    const selectedWorldId = rootReference ? null : this.currentWorldId || null;

    this.graphView = this.linkService.getGraphForScope(rootReference, selectedWorldId);

    if (this.selectedNodeKey && !this.graphView?.nodes.some(node => node.key === this.selectedNodeKey)) {
      this.selectedNodeKey = '';
      this.currentSelectedTable = '';
      this.currentSelectedId = '';
      this.resetDraft();
    }
  }

  private onWorldChanged(worldId: string, worldName: string): void {
    if (this.currentWorldId === worldId && this.currentWorldName === worldName) {
      return;
    }

    this.currentWorldId = worldId;
    this.currentWorldName = worldName;

    this.onTableChange();
    this.loadGraph();
  }

  selectNode(node: GraphNode): void {
    if (this.movedDuringPan) {
      this.movedDuringPan = false;
      return;
    }

    this.selectedNodeKey = node.key;
    this.currentSelectedTable = node.table;
    this.currentSelectedId = node.id;
    this.relationEditorOpen = false;
    this.editingLinkId = null;
    this.resetDraft();
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.movedDuringPan) {
      this.movedDuringPan = false;
      return;
    }

    if (event.target === this.graphSvg?.nativeElement) {
      this.selectedNodeKey = '';
      this.currentSelectedTable = '';
      this.currentSelectedId = '';
      this.resetDraft();
    }
  }

  startNewRelation(): void {
    const node = this.selectedNode;
    if (!node) return;

    this.relationDraft = {
      fromTable: node.table,
      fromId: node.id,
      toTable: this.tableOptions[0]?.value || '',
      toId: '',
      name: '',
    };
    this.relationDraftFromLabel = node.label;
    this.editingLinkId = null;
    this.relationEditorOpen = true;
    this.onDraftToTableChange();
  }

  startEditLink(edge: GraphEdge): void {
    const source = this.graphView?.nodes.find(node => node.key === edge.fromKey);
    if (source) {
      this.selectedNodeKey = source.key;
      this.currentSelectedTable = source.table;
      this.currentSelectedId = source.id;
    }

    this.editingLinkId = edge.id;
    this.relationEditorOpen = true;
    this.relationDraft = {
      fromTable: edge.link.fromTable,
      fromId: edge.link.fromId,
      toTable: edge.link.toTable,
      toId: edge.link.toId,
      name: edge.link.name || '',
    };
    const sourceEntity = this.linkService.getEntitySummary(edge.link.fromTable, edge.link.fromId);
    this.relationDraftFromLabel = sourceEntity?.label || edge.link.fromId;
    this.onDraftToTableChange(false);
  }

  onDraftToTableChange(resetTarget = true): void {
    this.draftTargetEntities = this.linkService.getEntitiesByTable(
      this.relationDraft.toTable,
      this.effectiveScopeWorldId,
    );

    if (resetTarget || !this.draftTargetEntities.some(entity => entity.id === this.relationDraft.toId)) {
      this.relationDraft.toId = this.draftTargetEntities[0]?.id || '';
    }
  }

  saveDraftRelation(): void {
    if (!this.relationDraft.fromTable || !this.relationDraft.fromId || !this.relationDraft.toTable || !this.relationDraft.toId) {
      return;
    }

    if (this.editingLinkId) {
      this.linkService.updateLink(this.editingLinkId, {
        fromTable: this.relationDraft.fromTable,
        fromId: this.relationDraft.fromId,
        toTable: this.relationDraft.toTable,
        toId: this.relationDraft.toId,
        name: this.relationDraft.name,
      });
    } else {
      this.linkService.createLink({
        fromTable: this.relationDraft.fromTable,
        fromId: this.relationDraft.fromId,
        toTable: this.relationDraft.toTable,
        toId: this.relationDraft.toId,
        name: this.relationDraft.name,
      });
    }

    this.loadGraph();
    this.resetDraft();
  }

  deleteEditingLink(): void {
    if (!this.editingLinkId) return;

    this.linkService.deleteLink(this.editingLinkId);
    this.loadGraph();
    this.resetDraft();
  }

  invertEditingLink(): void {
    if (!this.editingLinkId) return;

    const updated = this.linkService.invertLinkDirection(this.editingLinkId);
    if (!updated) return;

    this.relationDraft = {
      fromTable: updated.fromTable,
      fromId: updated.fromId,
      toTable: updated.toTable,
      toId: updated.toId,
      name: updated.name || '',
    };
    const sourceEntity = this.linkService.getEntitySummary(updated.fromTable, updated.fromId);
    this.relationDraftFromLabel = sourceEntity?.label || updated.fromId;
    this.onDraftToTableChange(false);
    this.loadGraph();
  }

  resetDraft(): void {
    this.editingLinkId = null;
    this.relationEditorOpen = false;
    this.draftTargetEntities = [];
    this.relationDraft = {
      fromTable: this.currentSelectedTable,
      fromId: this.currentSelectedId,
      toTable: '',
      toId: '',
      name: '',
    };
    const sourceEntity = this.currentSelectedTable && this.currentSelectedId
      ? this.linkService.getEntitySummary(this.currentSelectedTable, this.currentSelectedId)
      : null;
    this.relationDraftFromLabel = sourceEntity?.label || '';
  }

  makeSelectedNodeRoot(): void {
    const node = this.selectedNode;
    if (!node) return;

    this.setRoot(node.table, node.id, true);
  }

  openSelectedNodeInNewTab(): void {
    const node = this.selectedNode;
    if (!node) return;

    this.tabManager.openRelationsTab({
      table: node.table,
      id: node.id,
      label: node.label,
    });
  }

  openSelectedEntityInNewTab(): void {
    const node = this.selectedNode;
    if (!node) return;

    const entityType = this.getTabEntityType(node.table);
    if (!entityType) return;

    this.tabManager.openTab(entityType, node.id, node.label, 'fa-solid fa-pen-to-square');
  }

  private getTabEntityType(table: string): Exclude<TabEntityType, 'view'> | null {
    const tableAliases: Record<string, Exclude<TabEntityType, 'view'>> = {
      World: 'World',
      Character: 'Character',
      Location: 'Location',
      Organization: 'Organization',
      Species: 'Specie',
      Culture: 'Culture',
      Document: 'Document',
      Object: 'Object',
    };

    return tableAliases[table] || null;
  }

  private clearRoot(): void {
    this.currentRootTable = '';
    this.currentRootId = '';
    this.selectedNodeKey = '';
    this.currentSelectedTable = '';
    this.currentSelectedId = '';
    this.selectedEntityId = null;
    this.relationEditorOpen = false;
    this.editingLinkId = null;
    this.onTableChange();
    this.loadGraph();
  }

  private setRoot(table: string, id: string, syncSelectors: boolean): void {
    if (!table || !id) return;

    this.currentRootTable = table;
    this.currentRootId = id;
    this.selectedNodeKey = makeNodeKey(table, id);
    this.currentSelectedTable = table;
    this.currentSelectedId = id;

    if (syncSelectors) {
      this.selectedTable = table;
      this.entityOptions = this.linkService.getEntitiesByTable(table, this.effectiveScopeWorldId);
      this.selectedEntityId = id;
    }

    this.loadGraph();

    const rootEntity = this.linkService.getEntitySummary(table, id);
    this.tabManager.pinActiveRelationsTab({
      table,
      id,
      label: rootEntity?.label,
    });

    this.resetDraft();
  }

  centerViewport(): void {
    this.panX = 0;
    this.panY = 0;
    this.zoomLevel = 1;
  }

  zoomIn(): void {
    this.setZoom(this.zoomLevel * (1 + this.zoomStep));
  }

  zoomOut(): void {
    this.setZoom(this.zoomLevel / (1 + this.zoomStep));
  }

  private setZoom(value: number): void {
    const width = this.graphView?.width || this.canvasWidth;
    const height = this.graphView?.height || this.canvasHeight;
    if (value > 0 && Number.isFinite(value) &&
        Number.isFinite(width / value) && Number.isFinite(height / value) &&
        width / value > 0 && height / value > 0) {
      this.zoomLevel = value;
    }
  }

  onGraphWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  onGraphTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      this.isPanning = false;
      this.pinchStartDistance = this.touchDistance(event);
      this.pinchStartZoom = this.zoomLevel;
      return;
    }

    const mouseEvent = this.touchToMouseEvent(event, 'mousedown');
    if (!mouseEvent) return;

    event.preventDefault();
    this.startPan(mouseEvent);
  }

  onGraphTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      const distance = this.touchDistance(event);
      if (!this.pinchStartDistance) {
        this.pinchStartDistance = distance;
        this.pinchStartZoom = this.zoomLevel;
      }
      if (distance && this.pinchStartDistance) {
        this.setZoom(this.pinchStartZoom * distance / this.pinchStartDistance);
      }
      return;
    }

    if (!this.isPanning) return;

    const mouseEvent = this.touchToMouseEvent(event, 'mousemove');
    if (!mouseEvent) return;

    event.preventDefault();
    this.onPanMove(mouseEvent);
  }

  onGraphTouchEnd(): void {
    this.pinchStartDistance = 0;
    this.stopPan();
  }

  private touchDistance(event: TouchEvent): number {
    const first = event.touches[0];
    const second = event.touches[1];
    if (!first || !second) return 0;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  private touchToMouseEvent(event: TouchEvent, type: string): MouseEvent | null {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return null;

    return new MouseEvent(type, {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      buttons: 1,
    });
  }

  startPan(event: MouseEvent): void {
    if (event.button !== 0) return;

    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.panX;
    this.panOriginY = this.panY;
    this.movedDuringPan = false;
  }

  @HostListener('window:mousemove', ['$event'])
  onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;

    const panUnitPerPixel = this.getPanUnitPerPixel();
    const dx = (event.clientX - this.panStartX) * panUnitPerPixel;
    const dy = (event.clientY - this.panStartY) * panUnitPerPixel;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.movedDuringPan = true;

    this.panX = this.panOriginX + dx;
    this.panY = this.panOriginY + dy;
  }

  private getPanUnitPerPixel(): number {
    const graphWidth = this.graphView?.width || this.canvasWidth;
    const graphHeight = this.graphView?.height || this.canvasHeight;
    const viewWidth = graphWidth / this.zoomLevel;
    const viewHeight = graphHeight / this.zoomLevel;
    const bounds = this.graphSvg?.nativeElement.getBoundingClientRect();
    const renderedWidth = bounds?.width || 0;
    const renderedHeight = bounds?.height || 0;
    const renderedScale = Math.min(
      renderedWidth / viewWidth,
      renderedHeight / viewHeight,
    );

    return renderedScale > 0 && Number.isFinite(renderedScale)
      ? 1 / renderedScale
      : 1 / this.zoomLevel;
  }

  @HostListener('window:mouseup')
  stopPan(): void {
    this.isPanning = false;
  }

  edgeGeometry(edge: GraphEdge): { path: string; labelX: number; labelY: number } | null {
    const from = this.graphView?.nodes.find(node => node.key === edge.fromKey);
    const to = this.graphView?.nodes.find(node => node.key === edge.toKey);
    if (!from || !to) return null;

    const pairEdges = this.graphView?.edges
      .filter(candidate => this.sameUndirectedPair(candidate, edge))
      .sort((first, second) => first.id.localeCompare(second.id)) || [];
    const pairIndex = Math.max(0, pairEdges.findIndex(candidate => candidate.id === edge.id));
    const pairOffset = (pairIndex - (pairEdges.length - 1) / 2) * 26;

    if (from.key === to.key) {
      const loopIndex = pairIndex;
      const angle = -Math.PI / 2 + loopIndex * 0.65;
      const endAngle = angle + 0.95;
      const start = {
        x: from.x + Math.cos(angle) * from.radius * 0.8,
        y: from.y + Math.sin(angle) * from.radius * 0.8,
      };
      const end = {
        x: from.x + Math.cos(endAngle) * from.radius * 0.8,
        y: from.y + Math.sin(endAngle) * from.radius * 0.8,
      };
      const controlOne = {
        x: from.x + Math.cos(angle - 0.65) * (from.radius + 68 + loopIndex * 12),
        y: from.y + Math.sin(angle - 0.65) * (from.radius + 68 + loopIndex * 12),
      };
      const controlTwo = {
        x: from.x + Math.cos(endAngle + 0.65) * (from.radius + 68 + loopIndex * 12),
        y: from.y + Math.sin(endAngle + 0.65) * (from.radius + 68 + loopIndex * 12),
      };
      return {
        path: 'M ' + start.x + ' ' + start.y + ' C ' + controlOne.x + ' ' + controlOne.y + ' ' + controlTwo.x + ' ' + controlTwo.y + ' ' + end.x + ' ' + end.y,
        labelX: from.x + Math.cos(angle + 0.5) * (from.radius + 72 + loopIndex * 12),
        labelY: from.y + Math.sin(angle + 0.5) * (from.radius + 72 + loopIndex * 12),
      };
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const start = {
      x: from.x + ux * from.radius,
      y: from.y + uy * from.radius,
    };
    const end = {
      x: to.x - ux * to.radius,
      y: to.y - uy * to.radius,
    };
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const perpendicular = { x: -uy, y: ux };
    const control = {
      x: midpoint.x + perpendicular.x * pairOffset,
      y: midpoint.y + perpendicular.y * pairOffset,
    };

    return {
      path: 'M ' + start.x + ' ' + start.y + ' Q ' + control.x + ' ' + control.y + ' ' + end.x + ' ' + end.y,
      labelX: (start.x + 2 * control.x + end.x) / 4,
      labelY: (start.y + 2 * control.y + end.y) / 4 - 7,
    };
  }

  sameUndirectedPair(first: GraphEdge, second: GraphEdge): boolean {
    return (
      (first.fromKey === second.fromKey && first.toKey === second.toKey) ||
      (first.fromKey === second.toKey && first.toKey === second.fromKey)
    );
  }

  edgeLabel(edge: GraphEdge): string {
    return edge.name?.trim() || 'Relação';
  }

  showEdgeLabel(edge: GraphEdge, graph: GraphView): boolean {
    if (graph.edges.length <= 24) return true;
    if (this.editingLinkId === edge.id) return true;
    return edge.fromKey === this.selectedNodeKey || edge.toKey === this.selectedNodeKey;
  }

  edgeClasses(edge: GraphEdge): Record<string, boolean> {
    const focused = edge.fromKey === this.selectedNodeKey || edge.toKey === this.selectedNodeKey;
    return {
      'stroke-zinc-500': !focused && this.editingLinkId !== edge.id,
      'stroke-yellow-400': this.editingLinkId === edge.id,
      'stroke-cyan-400': focused && this.editingLinkId !== edge.id,
      'opacity-30': !!this.selectedNodeKey && !focused && this.editingLinkId !== edge.id,
    };
  }

  nodeClasses(node: GraphNode): Record<string, boolean> {
    return {
      'drop-shadow-[0_0_8px_rgba(250,204,21,0.55)]': node.isRoot,
      'opacity-100': true,
    };
  }

  nodeFill(node: GraphNode): string {
    const color = this.nodeColor(node.table);
    return node.isRoot ? color + '44' : color + '28';
  }

  nodeStroke(node: GraphNode): string {
    if (this.selectedNodeKey === node.key) return '#facc15';
    if (node.isRoot) return '#facc15';
    return this.nodeColor(node.table);
  }

  nodeStrokeWidth(node: GraphNode): number {
    if (this.selectedNodeKey === node.key) return 4;
    if (node.isRoot) return 3;
    return 2;
  }

  nodeColor(table: string): string {
    const colors: Record<string, string> = {
      World: '#f59e0b',
      Character: '#38bdf8',
      Location: '#4ade80',
      Organization: '#c084fc',
      Species: '#fb7185',
      Culture: '#fbbf24',
      Document: '#a78bfa',
      Object: '#2dd4bf',
    };
    return colors[table] || '#a1a1aa';
  }

  nodeTypeLabel(table: string): string {
    return this.tableOptions.find(option => option.value === table)?.label || table;
  }

  nodeInitials(label: string): string {
    const words = label.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

  nodeClipId(node: GraphNode): string {
    return 'relation-node-' + node.key.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  nodeLabelLimit(node: GraphNode): number {
    return node.radius >= 45 ? 28 : 18;
  }

  nodeLabelY(node: GraphNode): number {
    return node.radius + 19;
  }

  nodeTypeY(node: GraphNode): number {
    return node.radius + 33;
  }

  outgoingEdges(graph: GraphView): GraphEdge[] {
    if (!this.selectedNodeKey) return [];
    return graph.edges.filter(edge => edge.fromKey === this.selectedNodeKey);
  }

  incomingEdges(graph: GraphView): GraphEdge[] {
    if (!this.selectedNodeKey) return [];
    return graph.edges.filter(edge => edge.toKey === this.selectedNodeKey);
  }

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.relationEditorOpen) {
      this.resetDraft();
      return;
    }

    this.selectedNodeKey = '';
    this.currentSelectedTable = '';
    this.currentSelectedId = '';
  }
}
