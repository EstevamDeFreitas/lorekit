import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, ViewChild, computed, effect, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, SlicePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '../../../components/button/button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { InputComponent } from '../../../components/input/input.component';
import { LinkService, SelectableTable } from '../../../services/link.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { GraphEdge, GraphNode, GraphView } from '../../../libs/relationship-graph/relationship-graph.types';
import { GRAPH_CANVAS_HEIGHT, GRAPH_CANVAS_WIDTH, makeNodeKey } from '../../../libs/relationship-graph/relationship-graph.utils';
import { buildImageUrl } from '../../../models/image.model';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';

const NODE_MIN_SCALE = 0.6;
const NODE_MAX_SCALE = 2.2;
const NODE_RESIZE_HANDLE_SIZE = 10;

@Component({
  selector: 'app-relation-graph',
  imports: [FormsModule, NgClass, SlicePipe, ButtonComponent, ComboBoxComponent, InputComponent, IconButtonComponent],
  template: `
    <div class="flex flex-col gap-4 @container">
      <div class="flex flex-wrap items-end gap-3">
        <app-combo-box
          class="w-56"
          label="Tipo da Entidade"
          size="xs"
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

        <!-- <app-button label="Atualizar" icon="fa-refresh" size="sm" buttonType="secondary" (click)="refreshGraph()" /> -->

        <!-- <div class="flex flex-col">
          <label class="text-xs mb-1">Níveis</label>
          <select
            class="rounded-lg px-3 py-2 bg-zinc-925 border-zinc-800 border transition focus:outline-none focus:border-zinc-100"
            [(ngModel)]="relationshipDepth"
            (ngModelChange)="onDepthChange()"
            [disabled]="loadAllLevels"
          >
            <option [ngValue]="1">1</option>
            <option [ngValue]="2">2</option>
            <option [ngValue]="3">3</option>
            <option [ngValue]="4">4</option>
            <option [ngValue]="5">5</option>
          </select>
        </div>

        <label class="flex flex-row items-center gap-2 text-sm pb-2 cursor-pointer select-none">
          <input type="checkbox" [(ngModel)]="loadAllLevels" (ngModelChange)="onToggleAllLevels()" />
          Carregar todas relações
        </label> -->
      </div>

      @if (!graphView) {
        <div class="p-4 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300">
          Selecione uma entidade principal para visualizar e editar as relações.
        </div>
      }

      @if (graphView; as graph) {
        <div class="grid grid-cols-1 @4xl:grid-cols-[1fr_21rem] gap-4">
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

            <svg #graphSvg class="w-full h-[calc(100vh-10.5rem)]" [attr.viewBox]="graphViewBox">
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
                  (click)="$event.stopPropagation(); selectNode(node);"
                  (mousedown)="startNodeDrag($event, node)"
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
                      [attr.x]="nodeImageX(node)"
                      [attr.y]="nodeImageY(node)"
                      [attr.width]="nodeImageSize(node)"
                      [attr.height]="nodeImageSize(node)"
                      [attr.href]="buildImageUrl(node.imagePath)"
                      preserveAspectRatio="xMidYMid slice"
                    />
                  }
                  <text [attr.x]="nodeLabelX(node)" [attr.y]="nodeTitleY(node)" text-anchor="start" class="fill-white text-sm font-semibold">
                    {{ node.label | slice:0:nodeLabelLimit(node) }}
                  </text>
                  <text [attr.x]="nodeLabelX(node)" [attr.y]="nodeSubtitleY(node)" text-anchor="start" class="fill-zinc-300 text-xs">
                    {{ node.table }}
                  </text>
                  @if (selectedNodeKey === node.key) {
                    <rect
                      [attr.x]="nodeResizeHandleRect(node).x"
                      [attr.y]="nodeResizeHandleRect(node).y"
                      [attr.width]="nodeResizeHandleRect(node).width"
                      [attr.height]="nodeResizeHandleRect(node).height"
                      [attr.rx]="3"
                      class="fill-yellow-500 stroke-zinc-900 stroke-[1] cursor-se-resize"
                      (mousedown)="startNodeResize($event, node)"
                    />
                  }
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
                <button
                  class="w-full text-left text-sm px-2 py-2 rounded hover:bg-zinc-800 cursor-pointer"
                  (click)="openNodeRelationsInNewTab()"
                >
                  Abrir em nova aba
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

            <div class="flex flex-row gap-2">
              @if (!editingLinkId) {
                <!-- <app-button label="Criar Relação" size="xs" buttonType="white" (click)="saveDraftRelation()" /> -->
                <app-icon-button title="Criar Relação" icon="fa-solid fa-plus" size="xs" buttonType="white" (click)="saveDraftRelation()" />
              }
              @else {
                <!-- <app-button label="Salvar" size="xs" buttonType="white" (click)="saveDraftRelation()" /> -->
                  <app-icon-button title="Salvar" icon="fa-solid fa-floppy-disk" size="xs" buttonType="white" (click)="saveDraftRelation()" />
              }
              <!-- <app-button label="Limpar" size="xs" buttonType="secondary" (click)="resetDraft()" /> -->
              <app-icon-button title="Limpar" icon="fa-solid fa-xmark" size="xs" buttonType="danger" (click)="resetDraft()" />
              @if (editingLinkId) {

                <!-- <app-button label="Inverter Relação" size="xs" buttonType="secondary" (click)="invertEditingLink()" /> -->
                <app-icon-button title="Inverter Relação" icon="fa-solid fa-arrow-right-arrow-left" size="xs" buttonType="white" (click)="invertEditingLink()" />
                <!-- <app-button label="Excluir Relação" size="xs" buttonType="danger" (click)="deleteEditingLink()" /> -->
                <app-icon-button title="Excluir Relação" icon="fa-solid fa-trash-can" size="xs" buttonType="danger" (click)="deleteEditingLink()" />

              }

            </div>


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
  @ViewChild('graphSvg') graphSvg?: ElementRef<SVGSVGElement>;

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
  isNodeDragging = false;
  private draggedNode: GraphNode | null = null;
  private movedDuringNodeDrag = false;
  isNodeResizing = false;
  private resizedNode: GraphNode | null = null;
  private movedDuringNodeResize = false;
  private resizeAnchorTopLeft: { x: number; y: number } | null = null;

  relationshipDepth = 2;
  loadAllLevels = true;

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
  } = {
    fromTable: '',
    fromId: '',
    toTable: '',
    toId: '',
    name: '',
  };

  relationDraftFromLabel = '';

  selectedNodeKey = '';

  currentSelectedTable = '';
  currentSelectedId = '';


  contextMenuOpen = false;
  contextMenuNode: GraphNode | null = null;
  contextMenuPosition = { x: 0, y: 0 };

  hasInputRoot = computed(() => !!this.rootTable() && !!this.rootId());

  constructor(
    private linkService: LinkService,
    private route: ActivatedRoute,
    private tabManager: TabManagerService,
  ) {
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
    this.loadGraph();
  }

  onDepthChange(): void {
    this.loadGraph();
  }

  onToggleAllLevels(): void {
    this.loadGraph();
  }

  private loadGraph(): void {
    if (!this.currentRootTable || !this.currentRootId) {
      if (this.selectedTable && this.selectedEntityId) {
        this.setRoot(this.selectedTable, this.selectedEntityId, true);
      }
      return;
    }

    this.graphView = this.linkService.getGraphForRoot(this.currentRootTable, this.currentRootId, {
      depth: this.relationshipDepth,
      includeAllLevels: this.loadAllLevels,
    });
  }

  selectNode(node: GraphNode): void {
    if (this.movedDuringPan) {
      this.movedDuringPan = false;
      return;
    }

    this.relationDraft.fromTable = node.table;
    this.relationDraft.fromId = node.id;
    this.relationDraftFromLabel = node.label;
    // this.relationDraft.toTable = this.currentRootTable || node.table;
    // this.draftTargetEntities = this.linkService.getEntitiesByTable(this.relationDraft.toTable);
    // this.relationDraft.toId = this.currentRootId || this.draftTargetEntities[0]?.id || '';
    this.relationDraft.name = '';
    this.editingLinkId = null;

    this.selectedNodeKey = node.key;
    this.currentSelectedTable = node.table;
    this.currentSelectedId = node.id;
  }

  startNodeDrag(event: MouseEvent, node: GraphNode): void {
    event.stopPropagation();

    if (event.button !== 0) return;
    if (node.isRoot) return;

    this.isNodeDragging = true;
    this.draggedNode = node;
    this.movedDuringNodeDrag = false;
  }

  startNodeResize(event: MouseEvent, node: GraphNode): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.button !== 0) return;

    this.selectedNodeKey = node.key;
    this.isNodeResizing = true;
    this.resizedNode = node;
    const rect = this.nodeRect(node);
    this.resizeAnchorTopLeft = { x: rect.x, y: rect.y };
    this.movedDuringNodeResize = false;
  }

  nodeCircleClass(node: GraphNode): string {
    if (node.isRoot) return 'fill-yellow-500/20 stroke-yellow-500';
    if (this.selectedNodeKey === node.key) return 'fill-zinc-700 stroke-zinc-300';
    return 'fill-zinc-800 stroke-zinc-600';
  }

  nodeRect(node: GraphNode): { x: number; y: number; width: number; height: number } {
    const width = this.baseNodeWidth(node) * this.nodeWidthScale(node);
    const height = this.baseNodeHeight(node) * this.nodeHeightScale(node);
    return {
      x: node.x - width / 2,
      y: node.y - height / 2,
      width,
      height,
    };
  }

  nodeResizeHandleRect(node: GraphNode): { x: number; y: number; width: number; height: number } {
    const rect = this.nodeRect(node);
    const size = Math.max(8, NODE_RESIZE_HANDLE_SIZE * Math.min(this.nodeWidthScale(node), this.nodeHeightScale(node)));
    return {
      x: rect.x + rect.width - size / 2,
      y: rect.y + rect.height - size / 2,
      width: size,
      height: size,
    };
  }

  nodeLabelLimit(node: GraphNode): number {
    const scale = this.nodeWidthScale(node);
    if (scale < 0.9) return 18;
    if (scale > 1.2) return 36;
    return 26;
  }

  nodeLabelX(node: GraphNode): number {
    const left = this.nodeRect(node).x;
    return left + (node.imagePath ? 44 : 12) * this.nodeWidthScale(node);
  }

  nodeImageSize(node: GraphNode): number {
    return +(28 * Math.min(this.nodeWidthScale(node), this.nodeHeightScale(node))).toFixed(2);
  }

  nodeImageX(node: GraphNode): number {
    return this.nodeRect(node).x + 8 * this.nodeWidthScale(node);
  }

  nodeImageY(node: GraphNode): number {
    return this.nodeRect(node).y + 10 * this.nodeHeightScale(node);
  }

  nodeTitleY(node: GraphNode): number {
    return node.y - 8 * this.nodeHeightScale(node);
  }

  nodeSubtitleY(node: GraphNode): number {
    return node.y + 14 * this.nodeHeightScale(node);
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
    if (this.isNodeDragging) return;
    if (this.isNodeResizing) return;
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
    if (this.isNodeResizing) {
      this.moveResizedNode(event);
      return;
    }

    if (this.isNodeDragging) {
      this.moveDraggedNode(event);
      return;
    }

    if (!this.isPanning) return;

    const dx = (event.clientX - this.panStartX) / this.zoomLevel;
    const dy = (event.clientY - this.panStartY) / this.zoomLevel;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.movedDuringPan = true;
    }

    this.panX = this.panOriginX + dx;
    this.panY = this.panOriginY + dy;
  }

  @HostListener('window:mouseup')
  stopPan(): void {
    if (this.isNodeResizing && this.resizedNode) {
      if (this.movedDuringNodeResize && this.graphView) {
        this.linkService.saveNodeCardSize(
          { table: this.currentRootTable, id: this.currentRootId },
          {
            table: this.resizedNode.table,
            id: this.resizedNode.id,
            cardWidthScale: this.nodeWidthScale(this.resizedNode),
            cardHeightScale: this.nodeHeightScale(this.resizedNode),
          },
          this.graphView.edges.map((edge) => edge.link)
        );
      }

      this.isNodeResizing = false;
      this.resizedNode = null;
      this.resizeAnchorTopLeft = null;
      this.movedDuringNodeResize = false;
    }

    if (this.isNodeDragging && this.draggedNode) {
      if (this.movedDuringNodeDrag && this.graphView) {
        this.linkService.saveNodePosition(
          { table: this.currentRootTable, id: this.currentRootId },
          {
            table: this.draggedNode.table,
            id: this.draggedNode.id,
            x: this.draggedNode.x,
            y: this.draggedNode.y,
          },
          this.graphView.edges.map((edge) => edge.link)
        );
      }

      this.isNodeDragging = false;
      this.draggedNode = null;
      this.movedDuringNodeDrag = false;
    }

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
    // this.relationDraft.toTable = this.currentRootTable || this.contextMenuNode.table;
    // this.draftTargetEntities = this.linkService.getEntitiesByTable(this.relationDraft.toTable);
    // this.relationDraft.toId = this.currentRootId || this.draftTargetEntities[0]?.id || '';
    this.relationDraft.name = '';
    this.editingLinkId = null;

    this.currentSelectedTable = this.contextMenuNode.table;
    this.currentSelectedId = this.contextMenuNode.id;

    this.closeContextMenu();
  }

  openNodeRelationsInNewTab(): void {
    if (!this.contextMenuNode) return;

    this.tabManager.openRelationsTab({
      table: this.contextMenuNode.table,
      id: this.contextMenuNode.id,
      label: this.contextMenuNode.label,
    });

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

    this.refreshGraph();
    this.resetDraft();
  }

  deleteEditingLink(): void {
    if (!this.editingLinkId) return;

    this.linkService.deleteLink(this.editingLinkId);
    this.refreshGraph();
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
    this.draftTargetEntities = this.linkService.getEntitiesByTable(updated.toTable);

    this.refreshGraph();
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
    };
    const sourceEntity = this.linkService.getEntitySummary(this.currentRootTable, this.currentRootId);
    this.relationDraftFromLabel = sourceEntity?.label || '';
  }

  private setRoot(table: string, id: string, syncSelectors: boolean): void {
    this.currentRootTable = table;
    this.currentRootId = id;

    this.currentSelectedTable = table;
    this.currentSelectedId = id;

    this.graphView = this.linkService.getGraphForRoot(table, id, {
      depth: this.relationshipDepth,
      includeAllLevels: this.loadAllLevels,
    });

    if (syncSelectors) {
      this.selectedTable = table;
      this.entityOptions = this.linkService.getEntitiesByTable(table);
      this.selectedEntityId = id;
    }

    const rootEntity = this.linkService.getEntitySummary(table, id);
    this.tabManager.pinActiveRelationsTab({
      table,
      id,
      label: rootEntity?.label,
    });

    this.resetDraft();
  }

  private nodeByKey(key: string): GraphNode | undefined {
    return this.graphView?.nodes.find((node) => node.key === key);
  }

  private moveDraggedNode(event: MouseEvent): void {
    if (!this.draggedNode) return;

    const point = this.mouseToGraphPoint(event);
    if (!point) return;

    const nextX = point.x;
    const nextY = point.y;

    if (Math.abs(nextX - this.draggedNode.x) > 0.5 || Math.abs(nextY - this.draggedNode.y) > 0.5) {
      this.movedDuringNodeDrag = true;
    }

    this.draggedNode.x = nextX;
    this.draggedNode.y = nextY;
  }

  private moveResizedNode(event: MouseEvent): void {
    if (!this.resizedNode || !this.resizeAnchorTopLeft) return;

    const point = this.mouseToGraphPoint(event);
    if (!point) return;

    const nextWidth = Math.max(this.minNodeWidth(this.resizedNode), point.x - this.resizeAnchorTopLeft.x);
    const nextHeight = Math.max(this.minNodeHeight(this.resizedNode), point.y - this.resizeAnchorTopLeft.y);

    const targetWidthScale = this.clampNodeDimensionScale(nextWidth / this.baseNodeWidth(this.resizedNode));
    const targetHeightScale = this.clampNodeDimensionScale(nextHeight / this.baseNodeHeight(this.resizedNode));
    const currentWidthScale = this.nodeWidthScale(this.resizedNode);
    const currentHeightScale = this.nodeHeightScale(this.resizedNode);

    if (Math.abs(targetWidthScale - currentWidthScale) > 0.003 || Math.abs(targetHeightScale - currentHeightScale) > 0.003) {
      this.resizedNode.cardWidthScale = targetWidthScale;
      this.resizedNode.cardHeightScale = targetHeightScale;

      const width = this.baseNodeWidth(this.resizedNode) * targetWidthScale;
      const height = this.baseNodeHeight(this.resizedNode) * targetHeightScale;
      this.resizedNode.x = this.resizeAnchorTopLeft.x + width / 2;
      this.resizedNode.y = this.resizeAnchorTopLeft.y + height / 2;
      this.movedDuringNodeResize = true;
    }
  }

  private mouseToGraphPoint(event: MouseEvent): { x: number; y: number } | null {
    if (!this.graphSvg) return null;

    const svg = this.graphSvg.nativeElement;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const [viewX, viewY, viewW, viewH] = this.graphViewBox.split(' ').map(Number);
    if ([viewX, viewY, viewW, viewH].some((n) => Number.isNaN(n))) return null;

    const ratioX = (event.clientX - rect.left) / rect.width;
    const ratioY = (event.clientY - rect.top) / rect.height;

    return {
      x: viewX + ratioX * viewW,
      y: viewY + ratioY * viewH,
    };
  }

  private baseNodeWidth(node: GraphNode): number {
    return node.isRoot ? 220 : 190;
  }

  private baseNodeHeight(node: GraphNode): number {
    return node.isRoot ? 78 : 64;
  }

  private minNodeWidth(node: GraphNode): number {
    return this.baseNodeWidth(node) * NODE_MIN_SCALE;
  }

  private minNodeHeight(node: GraphNode): number {
    return this.baseNodeHeight(node) * NODE_MIN_SCALE;
  }

  private nodeWidthScale(node: GraphNode): number {
    return this.clampNodeDimensionScale(node.cardWidthScale ?? 1);
  }

  private nodeHeightScale(node: GraphNode): number {
    return this.clampNodeDimensionScale(node.cardHeightScale ?? 1);
  }

  private clampNodeDimensionScale(scale: number): number {
    return +Math.min(NODE_MAX_SCALE, Math.max(NODE_MIN_SCALE, scale)).toFixed(3);
  }

  outgoingEdges(graph: GraphView): GraphEdge[] {
    const currentKey = makeNodeKey(this.currentSelectedTable, this.currentSelectedId);
    return graph.edges.filter((edge) => edge.fromKey === currentKey);
  }

  incomingEdges(graph: GraphView): GraphEdge[] {
    const currentKey = makeNodeKey(this.currentSelectedTable, this.currentSelectedId);
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
