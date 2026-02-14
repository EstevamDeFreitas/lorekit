import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, effect, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, SlicePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '../../../components/button/button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { InputComponent } from '../../../components/input/input.component';
import { LinkService, SelectableTable } from '../../../services/link.service';
import { GraphEdge, GraphNode, GraphView } from '../../../libs/relationship-graph/relationship-graph.types';
import { GRAPH_CANVAS_HEIGHT, GRAPH_CANVAS_WIDTH, makeNodeKey } from '../../../libs/relationship-graph/relationship-graph.utils';
import { buildImageUrl } from '../../../models/image.model';

@Component({
  selector: 'app-relation-graph',
  imports: [FormsModule, NgClass, SlicePipe, ButtonComponent, ComboBoxComponent, InputComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-row items-end gap-3">
        <app-combo-box
          class="w-56"
          label="Tipo da Entidade"
          [items]="tableOptions"
          compareProp="value"
          displayProp="label"
          [(comboValue)]="selectedTable"
          (comboValueChange)="onTableChange()"
        />

        <app-combo-box
          class="w-80"
          label="Entidade Principal"
          [items]="entityOptions"
          compareProp="id"
          displayProp="label"
          [(comboValue)]="selectedEntityId"
          (comboValueChange)="onRootEntitySelected()"
        />

        <div class="w-40">
          <app-button label="Atualizar" buttonType="secondary" (click)="refreshGraph()" />
        </div>
      </div>

      @if (!graphView) {
        <div class="p-4 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300">
          Selecione uma entidade principal para visualizar e editar as relações.
        </div>
      }

      @if (graphView; as graph) {
        <div class="grid grid-cols-[1fr_21rem] gap-4">
          <div
            class="rounded-lg border border-zinc-800 bg-zinc-925 overflow-hidden relative cursor-grab"
            [ngClass]="{'!cursor-grabbing': isPanning}"
            (click)="closeContextMenu()"
            (wheel)="onGraphWheel($event)"
            (mousedown)="startPan($event)"
          >
            <div class="absolute z-20 top-2 right-2 flex flex-row gap-1 rounded-md border border-zinc-700 bg-zinc-900/90 p-1">
              <button class="w-7 h-7 rounded hover:bg-zinc-800 cursor-pointer" (click)="$event.stopPropagation(); zoomOut()">-</button>
              <button class="w-7 h-7 rounded hover:bg-zinc-800 cursor-pointer" (click)="$event.stopPropagation(); zoomIn()">+</button>
            </div>

            <svg class="w-full h-[70vh]" [attr.viewBox]="graphViewBox">
              <defs>
                <marker
                  id="arrow-head"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3.5, 0 7" class="fill-zinc-400" />
                </marker>
              </defs>

              @for (edge of graph.edges; track edge.id) {
                @let points = edgeLinePoints(edge);
                @if (points) {
                  <line
                    [attr.x1]="points.x1"
                    [attr.y1]="points.y1"
                    [attr.x2]="points.x2"
                    [attr.y2]="points.y2"
                    [attr.marker-end]="'url(#arrow-head)'"
                    class="stroke-zinc-500/90 stroke-[2] cursor-pointer"
                    [ngClass]="{'!stroke-yellow-500': editingLinkId === edge.id}"
                    (click)="$event.stopPropagation(); startEditLink(edge)"
                  />
                  <text
                    class="fill-zinc-200 text-xs cursor-pointer"
                    [attr.x]="(points.x1 + points.x2) / 2"
                    [attr.y]="(points.y1 + points.y2) / 2 - 8"
                    text-anchor="middle"
                    (click)="$event.stopPropagation(); startEditLink(edge)"
                  >
                    {{ edge.name || 'relação' }}
                  </text>
                }
              }

              @for (node of graph.nodes; track node.key) {
                <g
                  class="cursor-pointer"
                  (contextmenu)="openNodeContextMenu($event, node)"
                  (click)="$event.stopPropagation(); selectNode(node)"
                >
                  <rect
                    [attr.x]="nodeRect(node).x"
                    [attr.y]="nodeRect(node).y"
                    [attr.width]="nodeRect(node).width"
                    [attr.height]="nodeRect(node).height"
                    [attr.rx]="12"
                    class="stroke-[2]"
                    [ngClass]="nodeCircleClass(node)"
                  />
                  @if (node.imagePath) {
                    <image
                      [attr.x]="nodeRect(node).x + 8"
                      [attr.y]="nodeRect(node).y + 10"
                      [attr.width]="28"
                      [attr.height]="28"
                      [attr.href]="buildImageUrl(node.imagePath)"
                      preserveAspectRatio="xMidYMid slice"
                    />
                  }
                  <text [attr.x]="nodeLabelX(node)" [attr.y]="node.y - 8" text-anchor="start" class="fill-white text-sm font-semibold">
                    {{ node.label | slice:0:26 }}
                  </text>
                  <text [attr.x]="nodeLabelX(node)" [attr.y]="node.y + 14" text-anchor="start" class="fill-zinc-300 text-xs">
                    {{ node.table }}
                  </text>
                </g>
              }
            </svg>

            @if (contextMenuOpen && contextMenuNode) {
              <div
                class="fixed z-50 min-w-56 rounded-md border border-zinc-700 bg-zinc-900 shadow-lg p-2"
                [style.left.px]="contextMenuPosition.x"
                [style.top.px]="contextMenuPosition.y"
                (click)="$event.stopPropagation()"
              >
                <div class="text-xs text-zinc-400 mb-2">{{ contextMenuNode.label }}</div>
                <button
                  class="w-full text-left text-sm px-2 py-2 rounded hover:bg-zinc-800 cursor-pointer"
                  (click)="prepareAddRelationFromContext()"
                >
                  Adicionar relação a partir deste nó
                </button>
              </div>
            }
          </div>

          <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3 h-[70vh] overflow-y-auto scrollbar-dark">
            <h3 class="text-base font-bold">Edição de Relações</h3>

            <div class="text-xs text-zinc-400">Origem</div>
            <div class="text-sm rounded-md border border-zinc-800 px-3 py-2 bg-zinc-925">
              {{ relationDraft.fromTable || '-' }} / {{ relationDraftFromLabel || '-' }}
            </div>

            <app-combo-box
              label="Tabela de Destino"
              [items]="tableOptions"
              compareProp="value"
              displayProp="label"
              [(comboValue)]="relationDraft.toTable"
              (comboValueChange)="onDraftToTableChange()"
            />

            <app-combo-box
              label="Entidade de Destino"
              [items]="draftTargetEntities"
              compareProp="id"
              displayProp="label"
              [(comboValue)]="relationDraft.toId"
            />

            <app-input label="Nome da Relação" [(value)]="relationDraft.name" />
            <app-input label="Config JSON" [(value)]="relationDraft.configJson" />

            <div class="grid grid-cols-2 gap-2">
              @if (!editingLinkId) {
                <app-button label="Criar Relação" buttonType="white" (click)="saveDraftRelation()" />
              }
              @else {
                <app-button label="Salvar" buttonType="white" (click)="saveDraftRelation()" />
              }
              <app-button label="Limpar" buttonType="secondary" (click)="resetDraft()" />
            </div>

            @if (editingLinkId) {
              <app-button label="Excluir Relação" buttonType="danger" (click)="deleteEditingLink()" />
            }

            <div class="border-t border-zinc-800 pt-3 mt-2">
              <h4 class="text-sm font-semibold mb-2">Relações de Origem (saindo)</h4>

              <div class="flex flex-col gap-2">
                @for (edge of outgoingEdges(graph); track edge.id) {
                  <button
                    class="text-left rounded-md border px-2 py-2 cursor-pointer transition"
                    [ngClass]="editingLinkId === edge.id ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-800 bg-zinc-925 hover:bg-zinc-800'"
                    (click)="startEditLink(edge)"
                  >
                    <div class="text-xs text-zinc-300">{{ edge.link.fromTable }} → {{ edge.link.toTable }}</div>
                    <div class="text-sm text-white">{{ edge.name || 'Sem nome' }}</div>
                  </button>
                }
                @if (outgoingEdges(graph).length === 0) {
                  <div class="text-xs text-zinc-500">Nenhuma relação de origem para esta entidade.</div>
                }
              </div>
            </div>

            <div class="border-t border-zinc-800 pt-3 mt-2">
              <h4 class="text-sm font-semibold mb-2">Relações de Destino (chegando)</h4>
              <div class="flex flex-col gap-2">
                @for (edge of incomingEdges(graph); track edge.id) {
                  <button
                    class="text-left rounded-md border px-2 py-2 cursor-pointer transition"
                    [ngClass]="editingLinkId === edge.id ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-800 bg-zinc-925 hover:bg-zinc-800'"
                    (click)="startEditLink(edge)"
                  >
                    <div class="text-xs text-zinc-300">{{ edge.link.fromTable }} → {{ edge.link.toTable }}</div>
                    <div class="text-sm text-white">{{ edge.name || 'Sem nome' }}</div>
                  </button>
                }
                @if (incomingEdges(graph).length === 0) {
                  <div class="text-xs text-zinc-500">Nenhuma relação cadastrada para esta entidade.</div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './relation-graph.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class RelationGraphComponent implements OnInit {
  public buildImageUrl = buildImageUrl;

  rootTable = input<string | null>(null);
  rootId = input<string | null>(null);

  canvasWidth = GRAPH_CANVAS_WIDTH;
  canvasHeight = GRAPH_CANVAS_HEIGHT;
  zoomLevel = 1;
  minZoom = 0.5;
  maxZoom = 2.5;
  zoomStep = 0.1;
  panX = 0;
  panY = 0;
  isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private movedDuringPan = false;

  get graphViewBox(): string {
    const viewWidth = this.canvasWidth / this.zoomLevel;
    const viewHeight = this.canvasHeight / this.zoomLevel;
    const x = (this.canvasWidth - viewWidth) / 2 - this.panX;
    const y = (this.canvasHeight - viewHeight) / 2 - this.panY;

    return `${x} ${y} ${viewWidth} ${viewHeight}`;
  }

  graphView: GraphView | null = null;

  tableOptions: SelectableTable[] = [];
  entityOptions: Array<{ table: string; id: string; label: string }> = [];
  draftTargetEntities: Array<{ table: string; id: string; label: string }> = [];

  selectedTable = '';
  selectedEntityId = '';

  currentRootTable = '';
  currentRootId = '';

  editingLinkId: string | null = null;

  relationDraft: {
    fromTable: string;
    fromId: string;
    toTable: string;
    toId: string;
    name: string;
    configJson: string;
  } = {
    fromTable: '',
    fromId: '',
    toTable: '',
    toId: '',
    name: '',
    configJson: ''
  };

  relationDraftFromLabel = '';

  selectedNodeKey = '';

  contextMenuOpen = false;
  contextMenuNode: GraphNode | null = null;
  contextMenuPosition = { x: 0, y: 0 };

  hasInputRoot = computed(() => !!this.rootTable() && !!this.rootId());

  constructor(private linkService: LinkService, private route: ActivatedRoute) {
    effect(() => {
      const inputTable = this.rootTable();
      const inputId = this.rootId();

      if (inputTable && inputId) {
        this.setRoot(inputTable, inputId, true);
      }
    });
  }

  ngOnInit(): void {
    this.tableOptions = this.linkService.getSelectableTables();

    const inputTable = this.rootTable();
    const inputId = this.rootId();

    if (inputTable && inputId) {
      this.setRoot(inputTable, inputId, true);
      return;
    }

    const queryTable = this.route.snapshot.queryParamMap.get('table');
    const queryId = this.route.snapshot.queryParamMap.get('id');

    if (queryTable && queryId) {
      this.setRoot(queryTable, queryId, true);
      return;
    }

    this.selectedTable = this.tableOptions[0]?.value || '';
    this.onTableChange();
  }

  onTableChange(): void {
    this.entityOptions = this.linkService.getEntitiesByTable(this.selectedTable);

    if (!this.entityOptions.length) {
      this.selectedEntityId = '';
      return;
    }

    if (!this.entityOptions.find((entity) => entity.id === this.selectedEntityId)) {
      this.selectedEntityId = this.entityOptions[0].id;
    }
  }

  onRootEntitySelected(): void {
    if (!this.selectedTable || !this.selectedEntityId) return;
    this.setRoot(this.selectedTable, this.selectedEntityId, true);
  }

  refreshGraph(): void {
    if (!this.currentRootTable || !this.currentRootId) {
      if (this.selectedTable && this.selectedEntityId) {
        this.setRoot(this.selectedTable, this.selectedEntityId, true);
      }
      return;
    }

    this.graphView = this.linkService.getGraphForRoot(this.currentRootTable, this.currentRootId);
  }

  selectNode(node: GraphNode): void {
    if (this.movedDuringPan) {
      this.movedDuringPan = false;
      return;
    }

    this.selectedNodeKey = node.key;
  }

  nodeCircleClass(node: GraphNode): string {
    if (node.isRoot) return 'fill-yellow-500/20 stroke-yellow-500';
    if (this.selectedNodeKey === node.key) return 'fill-zinc-700 stroke-zinc-300';
    return 'fill-zinc-800 stroke-zinc-600';
  }

  nodeRect(node: GraphNode): { x: number; y: number; width: number; height: number } {
    const width = node.isRoot ? 220 : 190;
    const height = node.isRoot ? 78 : 64;
    return {
      x: node.x - width / 2,
      y: node.y - height / 2,
      width,
      height,
    };
  }

  nodeLabelX(node: GraphNode): number {
    const left = this.nodeRect(node).x;
    return left + (node.imagePath ? 44 : 12);
  }

  edgeLinePoints(edge: GraphEdge): { x1: number; y1: number; x2: number; y2: number } | null {
    const from = this.nodeByKey(edge.fromKey);
    const to = this.nodeByKey(edge.toKey);

    if (!from || !to) return null;

    const fromRect = this.nodeRect(from);
    const toRect = this.nodeRect(to);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx === 0 && absDy === 0) {
      return {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      };
    }

    const fromHalfW = fromRect.width / 2;
    const fromHalfH = fromRect.height / 2;
    const toHalfW = toRect.width / 2;
    const toHalfH = toRect.height / 2;

    const fromScale = Math.min(fromHalfW / (absDx || 1), fromHalfH / (absDy || 1));
    const toScale = Math.min(toHalfW / (absDx || 1), toHalfH / (absDy || 1));

    const x1 = from.x + dx * fromScale;
    const y1 = from.y + dy * fromScale;
    const x2 = to.x - dx * toScale;
    const y2 = to.y - dy * toScale;

    return {
      x1,
      y1,
      x2,
      y2,
    };
  }

  openNodeContextMenu(event: MouseEvent, node: GraphNode): void {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenuOpen = true;
    this.contextMenuNode = node;
    this.contextMenuPosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  onGraphWheel(event: WheelEvent): void {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
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

    const dx = (event.clientX - this.panStartX) / this.zoomLevel;
    const dy = (event.clientY - this.panStartY) / this.zoomLevel;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.movedDuringPan = true;
    }

    this.panX = this.panOriginX - dx;
    this.panY = this.panOriginY - dy;
  }

  @HostListener('window:mouseup')
  stopPan(): void {
    this.isPanning = false;
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(this.maxZoom, +(this.zoomLevel + this.zoomStep).toFixed(2));
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(this.minZoom, +(this.zoomLevel - this.zoomStep).toFixed(2));
  }

  closeContextMenu(): void {
    this.contextMenuOpen = false;
    this.contextMenuNode = null;
  }

  prepareAddRelationFromContext(): void {
    if (!this.contextMenuNode) return;

    this.relationDraft.fromTable = this.contextMenuNode.table;
    this.relationDraft.fromId = this.contextMenuNode.id;
    this.relationDraftFromLabel = this.contextMenuNode.label;
    this.relationDraft.toTable = this.currentRootTable || this.contextMenuNode.table;
    this.draftTargetEntities = this.linkService.getEntitiesByTable(this.relationDraft.toTable);
    this.relationDraft.toId = this.currentRootId || this.draftTargetEntities[0]?.id || '';
    this.relationDraft.name = '';
    this.relationDraft.configJson = '';
    this.editingLinkId = null;

    this.closeContextMenu();
  }

  onDraftToTableChange(): void {
    this.draftTargetEntities = this.linkService.getEntitiesByTable(this.relationDraft.toTable);
    this.relationDraft.toId = this.draftTargetEntities[0]?.id || '';
  }

  startEditLink(edge: GraphEdge): void {
    this.editingLinkId = edge.id;
    this.relationDraft = {
      fromTable: edge.link.fromTable,
      fromId: edge.link.fromId,
      toTable: edge.link.toTable,
      toId: edge.link.toId,
      name: edge.link.name || '',
      configJson: edge.link.configJson || ''
    };
    const sourceEntity = this.linkService.getEntitySummary(edge.link.fromTable, edge.link.fromId);
    this.relationDraftFromLabel = sourceEntity?.label || edge.link.fromId;
    this.draftTargetEntities = this.linkService.getEntitiesByTable(this.relationDraft.toTable);
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
        configJson: this.relationDraft.configJson
      });
    } else {
      this.linkService.createLink({
        fromTable: this.relationDraft.fromTable,
        fromId: this.relationDraft.fromId,
        toTable: this.relationDraft.toTable,
        toId: this.relationDraft.toId,
        name: this.relationDraft.name,
        configJson: this.relationDraft.configJson
      });
    }

    this.refreshGraph();
    this.resetDraft();
  }

  deleteEditingLink(): void {
    if (!this.editingLinkId) return;

    this.linkService.deleteLink(this.editingLinkId);
    this.refreshGraph();
    this.resetDraft();
  }

  resetDraft(): void {
    this.editingLinkId = null;
    this.draftTargetEntities = [];
    this.relationDraft = {
      fromTable: this.currentRootTable,
      fromId: this.currentRootId,
      toTable: '',
      toId: '',
      name: '',
      configJson: ''
    };
    const sourceEntity = this.linkService.getEntitySummary(this.currentRootTable, this.currentRootId);
    this.relationDraftFromLabel = sourceEntity?.label || '';
  }

  private setRoot(table: string, id: string, syncSelectors: boolean): void {
    this.currentRootTable = table;
    this.currentRootId = id;

    this.graphView = this.linkService.getGraphForRoot(table, id);

    if (syncSelectors) {
      this.selectedTable = table;
      this.entityOptions = this.linkService.getEntitiesByTable(table);
      this.selectedEntityId = id;
    }

    this.resetDraft();
  }

  private nodeByKey(key: string): GraphNode | undefined {
    return this.graphView?.nodes.find((node) => node.key === key);
  }

  outgoingEdges(graph: GraphView): GraphEdge[] {
    const currentKey = makeNodeKey(this.currentRootTable, this.currentRootId);
    return graph.edges.filter((edge) => edge.fromKey === currentKey);
  }

  incomingEdges(graph: GraphView): GraphEdge[] {
    const currentKey = makeNodeKey(this.currentRootTable, this.currentRootId);
    return graph.edges.filter((edge) => edge.toKey === currentKey);
  }

  @HostListener('document:click')
  handleDocumentClick(): void {
    this.closeContextMenu();
  }

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    this.closeContextMenu();
  }

  protected readonly makeNodeKey = makeNodeKey;
}
