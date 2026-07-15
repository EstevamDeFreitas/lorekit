import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import {
  Moodboard,
  MoodboardItem,
  MoodboardItemConfig,
  MoodboardShapeType,
  MoodboardTextAlign,
  MoodboardVerticalAlign,
} from '../../../models/moodboard.model';
import { buildImageUrl } from '../../../models/image.model';
import { Document } from '../../../models/document.model';
import { EditorComponent } from '../../../components/editor/editor.component';
import { DocumentService } from '../../../services/document.service';
import { ImageService } from '../../../services/image.service';
import {
  MoodboardEntitySearchResult,
  MoodboardService,
} from '../../../services/moodboard.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorldStateService } from '../../../services/world-state.service';

type MoodboardTool = 'select' | 'text' | 'draw' | MoodboardShapeType;
type DragMode = 'none' | 'pan' | 'item' | 'resize' | 'rotate' | 'pendingCreate' | 'create' | 'endpoint' | 'draw';
type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type LineEndpoint = 'start' | 'end';

type MoodboardCanvasItem = {
  item: MoodboardItem;
  config: MoodboardItemConfig;
  entity: MoodboardEntitySearchResult | null;
  document: Document | null;
  documentBlocks: DocumentPreviewBlock[];
};

type DocumentPreviewBlock = {
  type: string;
  text: string;
  level?: number;
  rows?: string[][];
};

type CanvasPoint = {
  x: number;
  y: number;
};

type DrawingGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  path: string;
  viewBox: string;
};

type DrawingPreview = DrawingGeometry & {
  stroke: string;
  strokeWidth: number;
};

type DragState = {
  mode: DragMode;
  itemId: string;
  startClientX: number;
  startClientY: number;
  startCanvasX: number;
  startCanvasY: number;
  startPanX: number;
  startPanY: number;
  startItemX: number;
  startItemY: number;
  startWidth: number;
  startHeight: number;
  startRotation: number;
  resizeHandle: ResizeHandle | '';
  endpoint: LineEndpoint | '';
  createTool: MoodboardTool | '';
  centerX: number;
  centerY: number;
  moved: boolean;
};

const CANVAS_WIDTH = 5000;
const CANVAS_HEIGHT = 5000;
const DEFAULT_SHAPE_FILL = '#ffffff';
const DEFAULT_SHAPE_STROKE = '#3f3f46';
const MIN_ITEM_SIZE = 24;
const DEFAULT_TEXT_WIDTH = 220;
const DEFAULT_TEXT_HEIGHT = 92;
const DEFAULT_SHAPE_WIDTH = 180;
const DEFAULT_SHAPE_HEIGHT = 120;
const DEFAULT_LINE_WIDTH = 220;
const DEFAULT_LINE_HEIGHT = 40;
const CREATE_DRAG_THRESHOLD = 4;
const DEFAULT_DRAWING_STROKE_WIDTH = 3;
const DRAWING_PADDING = 8;
const DRAWING_POINT_DISTANCE = 1.5;

@Component({
  selector: 'app-moodboard-edit',
  imports: [FormsModule, ComboBoxComponent, EditorComponent],
  templateUrl: './moodboard-edit.component.html',
  styleUrl: './moodboard-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoodboardEditComponent implements OnInit, OnDestroy {
  @ViewChild('stage') private stage?: ElementRef<HTMLDivElement>;
  @ViewChild('imageInput') private imageInput?: ElementRef<HTMLInputElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly moodboardService = inject(MoodboardService);
  private readonly imageService = inject(ImageService);
  private readonly documentService = inject(DocumentService);
  private readonly worldStateService = inject(WorldStateService);
  private readonly tabManager = inject(TabManagerService);
  private readonly renderer = inject(Renderer2);
  private readonly cdr = inject(ChangeDetectorRef);

  moodboardIdInput = input<string | null>(null);

  readonly canvasWidth = CANVAS_WIDTH;
  readonly canvasHeight = CANVAS_HEIGHT;
  readonly buildImageUrl = buildImageUrl;

  readonly moodboard = signal<Moodboard>(new Moodboard());
  readonly items = signal<MoodboardCanvasItem[]>([]);
  readonly selectedItemId = signal('');
  readonly editingItemId = signal('');
  readonly activeTool = signal<MoodboardTool>('select');
  readonly zoom = signal(0.85);
  readonly panX = signal(-450);
  readonly panY = signal(-350);
  readonly fillColor = signal(DEFAULT_SHAPE_FILL);
  readonly strokeColor = signal(DEFAULT_SHAPE_STROKE);
  readonly isSpacePressed = signal(false);
  readonly entitySearchTerm = signal('');
  readonly entityTableFilter = signal('');
  readonly entityResults = signal<MoodboardEntitySearchResult[]>([]);
  readonly drawingPreview = signal<DrawingPreview | null>(null);

  readonly tableOptions = [
    { value: '', label: 'Todos' },
    { value: 'World', label: 'Mundos' },
    { value: 'Character', label: 'Personagens' },
    { value: 'Location', label: 'Localidades' },
    { value: 'Organization', label: 'Organizações' },
    { value: 'Species', label: 'Espécies' },
    { value: 'Culture', label: 'Culturas' },
    { value: 'Document', label: 'Documentos' },
    { value: 'Object', label: 'Objetos' },
  ];

  readonly sortedItems = computed(() =>
    [...this.items()].sort((a, b) => (a.item.index ?? 0) - (b.item.index ?? 0))
  );

  readonly selectedItem = computed(() =>
    this.items().find(view => view.item.id === this.selectedItemId()) || null
  );

  readonly canvasTransform = computed(() =>
    `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`
  );

  private worldId: string | null = null;
  private dragState: DragState = this.emptyDragState();
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private drawingPoints: CanvasPoint[] = [];
  private removeMouseMove?: () => void;
  private removeMouseUp?: () => void;
  private removeKeyDown?: () => void;
  private removeKeyUp?: () => void;

  readonly moodboardId = computed(() => {
    const inputId = this.moodboardIdInput();
    if (inputId) {
      return inputId;
    }

    return this.route.snapshot.paramMap.get('moodboardId') || '';
  });

  constructor() {
    effect(() => {
      const id = this.moodboardId();
      if (id) {
        this.loadMoodboard(id);
      }
    });
  }

  ngOnInit(): void {
    this.worldId = this.worldStateService.getCurrentWorld()?.id || null;
    this.refreshEntities();

    this.removeMouseMove = this.renderer.listen('window', 'mousemove', (event: MouseEvent) => this.onWindowMouseMove(event));
    this.removeMouseUp = this.renderer.listen('window', 'mouseup', () => this.onWindowMouseUp());
    this.removeKeyDown = this.renderer.listen('window', 'keydown', (event: KeyboardEvent) => this.onWindowKeyDown(event));
    this.removeKeyUp = this.renderer.listen('window', 'keyup', (event: KeyboardEvent) => this.onWindowKeyUp(event));
  }

  ngOnDestroy(): void {
    this.flushPendingSaves();
    this.removeMouseMove?.();
    this.removeMouseUp?.();
    this.removeKeyDown?.();
    this.removeKeyUp?.();
  }

  setTool(tool: MoodboardTool): void {
    this.activeTool.set(tool);

    if (tool === 'draw') {
      this.selectedItemId.set('');
      this.editingItemId.set('');
    }
  }

  setFillColor(color: string): void {
    this.fillColor.set(color);
    const selectedId = this.selectedItemId();
    if (!selectedId) {
      return;
    }

    this.updateItemConfig(selectedId, config => ({ ...config, fill: color }));
  }

  setDrawingColor(color: string): void {
    this.strokeColor.set(color);
  }

  setStrokeColor(color: string): void {
    this.strokeColor.set(color);
    const selectedId = this.selectedItemId();
    if (!selectedId) {
      return;
    }

    this.updateItemConfig(selectedId, config => ({ ...config, stroke: color }));
  }

  clearFillColor(): void {
    const selectedId = this.selectedItemId();
    if (!selectedId) {
      return;
    }

    this.updateItemConfig(selectedId, config => ({ ...config, fill: 'transparent' }));
  }

  isTransparentFill(view: MoodboardCanvasItem | null): boolean {
    return view?.config.fill === 'transparent';
  }

  setTextAlign(align: MoodboardTextAlign): void {
    const selectedId = this.selectedItemId();
    if (!selectedId) {
      return;
    }

    this.updateItemConfig(selectedId, config => ({ ...config, textAlign: align }));
  }

  setVerticalAlign(align: MoodboardVerticalAlign): void {
    const selectedId = this.selectedItemId();
    if (!selectedId) {
      return;
    }

    this.updateItemConfig(selectedId, config => ({ ...config, verticalAlign: align }));
  }

  private selectItem(view: MoodboardCanvasItem): void {
    this.selectedItemId.set(view.item.id);

    this.fillColor.set(view.config.fill === 'transparent' ? DEFAULT_SHAPE_FILL : (view.config.fill || DEFAULT_SHAPE_FILL));
    this.strokeColor.set(view.config.stroke || DEFAULT_SHAPE_STROKE);
  }

  updateMoodboardName(name: string): void {
    this.moodboard.update(current => ({ ...current, name }));
  }

  saveMoodboardName(): void {
    const current = this.moodboard();
    if (!current.id || !current.name?.trim()) {
      return;
    }

    const saved = this.moodboardService.saveMoodboard(current, this.worldId);
    this.moodboard.set(saved);
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.isPanGesture(event)) {
      this.startPanDrag(event);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const point = this.clientToCanvasPoint(event.clientX, event.clientY);
    const tool = this.activeTool();

    if (tool === 'draw') {
      this.startDrawing(point, event);
      return;
    }

    if (tool === 'text') {
      this.startCreateItem(tool, point, event);
      return;
    }

    if (tool === 'rectangle' || tool === 'circle' || tool === 'line' || tool === 'arrow') {
      this.startCreateItem(tool, point, event);
      return;
    }

    this.selectedItemId.set('');
    this.editingItemId.set('');
  }

  onCanvasDoubleClick(event: MouseEvent): void {
    if (this.activeTool() === 'draw') {
      event.preventDefault();
      return;
    }

    const point = this.clientToCanvasPoint(event.clientX, event.clientY);
    this.createTextItem(point.x, point.y, true);
  }

  onItemMouseDown(event: MouseEvent, view: MoodboardCanvasItem): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isPanGesture(event)) {
      this.startPanDrag(event);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (this.activeTool() === 'draw') {
      const point = this.clientToCanvasPoint(event.clientX, event.clientY);
      this.startDrawing(point, event);
      return;
    }

    this.selectItem(view);

    if (this.editingItemId() === view.item.id || this.activeTool() !== 'select') {
      return;
    }

    const point = this.clientToCanvasPoint(event.clientX, event.clientY);
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'item',
      itemId: view.item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCanvasX: point.x,
      startCanvasY: point.y,
      startItemX: view.item.posX ?? 0,
      startItemY: view.item.posY ?? 0,
    };
  }

  startResize(event: MouseEvent, view: MoodboardCanvasItem, handle: ResizeHandle): void {
    event.preventDefault();
    event.stopPropagation();

    this.selectItem(view);
    const point = this.clientToCanvasPoint(event.clientX, event.clientY);
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'resize',
      itemId: view.item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCanvasX: point.x,
      startCanvasY: point.y,
      startItemX: view.item.posX ?? 0,
      startItemY: view.item.posY ?? 0,
      startWidth: this.itemWidth(view),
      startHeight: this.itemHeight(view),
      resizeHandle: handle,
    };
  }

  startRotate(event: MouseEvent, view: MoodboardCanvasItem): void {
    event.preventDefault();
    event.stopPropagation();

    const width = this.itemWidth(view);
    const height = this.itemHeight(view);

    this.selectItem(view);
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'rotate',
      itemId: view.item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRotation: view.config.rotation ?? 0,
      centerX: (view.item.posX ?? 0) + width / 2,
      centerY: (view.item.posY ?? 0) + height / 2,
    };
  }

  startLineEndpointDrag(event: MouseEvent, view: MoodboardCanvasItem, endpoint: LineEndpoint): void {
    event.preventDefault();
    event.stopPropagation();

    this.selectItem(view);
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'endpoint',
      itemId: view.item.id,
      endpoint,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
  }

  editItem(event: MouseEvent, view: MoodboardCanvasItem): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.activeTool() === 'draw') {
      return;
    }

    this.selectItem(view);
    this.editingItemId.set(view.item.id);
  }

  editDocumentItem(event: MouseEvent, view: MoodboardCanvasItem): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isPanGesture(event)) {
      this.startPanDrag(event);
      return;
    }

    if (this.activeTool() === 'draw') {
      if (event.button === 0) {
        const point = this.clientToCanvasPoint(event.clientX, event.clientY);
        this.startDrawing(point, event);
      }
      return;
    }

    this.selectItem(view);
    this.editingItemId.set(view.item.id);
    this.activeTool.set('select');
  }

  stopEditing(): void {
    const id = this.editingItemId();
    if (id) {
      this.saveItemNow(id);
    }
    this.editingItemId.set('');
  }

  updateItemText(view: MoodboardCanvasItem, text: string): void {
    this.updateItemConfig(view.item.id, config => ({ ...config, text }));
  }

  saveEditableText(event: FocusEvent, view: MoodboardCanvasItem): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      this.stopEditing();
      return;
    }

    this.updateItemConfig(view.item.id, config => ({
      ...config,
      text: target.innerText.replace(/\u00A0/g, ' ').replace(/\n$/g, ''),
    }));
    this.stopEditing();
  }

  saveDocumentContent(view: MoodboardCanvasItem, content: unknown): void {
    if (!view.document) {
      return;
    }

    const document = {
      ...view.document,
      content: JSON.stringify(content),
    } as Document;

    const saved = this.documentService.saveDocument(document, null, null, this.worldId);
    this.items.update(items => items.map(item => {
      if (item.item.id !== view.item.id) {
        return item;
      }

      return {
        ...item,
        document: saved,
        documentBlocks: this.documentToPreviewBlocks(saved),
      };
    }));
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom.set(Math.min(2.5, +(this.zoom() + 0.1).toFixed(2)));
  }

  zoomOut(): void {
    this.zoom.set(Math.max(0.25, +(this.zoom() - 0.1).toFixed(2)));
  }

  resetView(): void {
    this.zoom.set(0.85);
    this.panX.set(-450);
    this.panY.set(-350);
  }

  onCanvasWheel(event: WheelEvent): void {
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

  deleteSelected(): void {
    const id = this.selectedItemId();
    if (!id) {
      return;
    }

    this.saveTimers.get(id) && clearTimeout(this.saveTimers.get(id));
    this.saveTimers.delete(id);
    this.moodboardService.deleteMoodboardItem(id);
    this.items.update(items => items.filter(view => view.item.id !== id));
    this.selectedItemId.set('');
    this.editingItemId.set('');
  }

  bringSelectedToFront(): void {
    const id = this.selectedItemId();
    if (!id) {
      return;
    }

    const nextIndex = this.nextIndex();
    this.updateItem(id, view => ({
      ...view,
      item: { ...view.item, index: nextIndex },
    }), true);
  }

  sendSelectedToBack(): void {
    const id = this.selectedItemId();
    if (!id) {
      return;
    }

    const minIndex = Math.min(0, ...this.items().map(view => view.item.index ?? 0));
    this.updateItem(id, view => ({
      ...view,
      item: { ...view.item, index: minIndex - 1 },
    }), true);
  }

  layerZIndex(view: MoodboardCanvasItem): number {
    return (view.item.index ?? 0) + 20;
  }

  lineX1(view: MoodboardCanvasItem): number {
    return view.config.x1 ?? 0;
  }

  lineY1(view: MoodboardCanvasItem): number {
    return view.config.y1 ?? this.itemHeight(view) / 2;
  }

  lineX2(view: MoodboardCanvasItem): number {
    return view.config.x2 ?? this.itemWidth(view);
  }

  lineY2(view: MoodboardCanvasItem): number {
    return view.config.y2 ?? this.itemHeight(view) / 2;
  }

  triggerImageUpload(): void {
    this.imageInput?.nativeElement.click();
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const point = this.defaultCreatePoint();
    const view = this.createItem({
      kind: 'image',
      width: 260,
      height: 220,
      rotation: 0,
      text: file.name.replace(/\.[^.]+$/, ''),
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: DEFAULT_SHAPE_FILL,
      stroke: DEFAULT_SHAPE_STROKE,
      strokeWidth: 1,
    }, point.x, point.y);

    if (!view) {
      return;
    }

    const image = await this.imageService.uploadImage(file, 'MoodboardItem', view.item.id, 'moodboard');
    this.updateItemConfig(view.item.id, config => ({
      ...config,
      imageId: image.id,
      imagePath: image.filePath,
    }));
    this.saveItemNow(view.item.id);
  }

  refreshEntities(): void {
    const raw = this.moodboardService.searchEntities(this.worldId, this.entitySearchTerm());
    const table = this.entityTableFilter();
    this.entityResults.set(table ? raw.filter(entity => entity.table === table) : raw);
  }

  addEntity(entity: MoodboardEntitySearchResult): void {
    const point = this.defaultCreatePoint();
    this.createEntityItem(entity, point.x, point.y);
  }

  onEntityDragStart(event: DragEvent, entity: MoodboardEntitySearchResult): void {
    event.dataTransfer?.setData('application/lorekit-entity', JSON.stringify(entity));
    event.dataTransfer?.setData('text/plain', entity.label);
  }

  onEntityDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const raw = event.dataTransfer?.getData('application/lorekit-entity');
    if (!raw) {
      return;
    }

    try {
      const entity = JSON.parse(raw) as MoodboardEntitySearchResult;
      const point = this.clientToCanvasPoint(event.clientX, event.clientY);
      this.createEntityItem(entity, point.x, point.y);
    }
    catch {
      return;
    }
  }

  private createEntityItem(entity: MoodboardEntitySearchResult, x: number, y: number): void {
    const isDocument = entity.table === 'Document';
    const view = this.createItem({
      kind: 'entity',
      width: isDocument ? 360 : 220,
      height: isDocument ? 440 : 96,
      rotation: 0,
      text: entity.label,
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: DEFAULT_SHAPE_FILL,
      stroke: DEFAULT_SHAPE_STROKE,
      strokeWidth: 1,
      entityTable: entity.table,
      entityId: entity.id,
      renderMode: isDocument ? 'document' : 'card',
    }, x, y);

    if (view) {
      this.selectItem(view);
    }
  }

  entityCardStyle(entity: MoodboardEntitySearchResult | null): Record<string, string> {
    if (entity?.imagePath) {
      return {
        'background-image': `linear-gradient(rgba(9,9,11,0.35), rgba(9,9,11,0.78)), url(${buildImageUrl(entity.imagePath)})`,
      };
    }

    const color = this.entityColor(entity);
    return { 'background': color ? `${color}33` : '#18181b' };
  }

  entityColor(entity: MoodboardEntitySearchResult | null): string {
    if (!entity?.personalization?.contentJson) {
      return '';
    }

    try {
      return JSON.parse(entity.personalization.contentJson)?.color || '';
    }
    catch {
      return '';
    }
  }

  entityCardBackground(view: MoodboardCanvasItem): string {
    if (view.entity?.imagePath) {
      return `linear-gradient(rgba(9,9,11,0.35), rgba(9,9,11,0.78)), url(${buildImageUrl(view.entity.imagePath)})`;
    }

    const color = this.entityColor(view.entity);
    if (color) {
      return this.hexToRgba(color, 0.25);
    }

    return view.config.fill || DEFAULT_SHAPE_FILL;
  }

  fillStyle(view: MoodboardCanvasItem): string {
    return view.config.fill || DEFAULT_SHAPE_FILL;
  }

  textItemColor(view: MoodboardCanvasItem): string {
    return view.config.fill === 'transparent' ? '#ffffff' : (view.config.fill || '#ffffff');
  }

  entityCardBorder(view: MoodboardCanvasItem): string {
    return this.entityColor(view.entity) || view.config.stroke || DEFAULT_SHAPE_STROKE;
  }

  textAlign(view: MoodboardCanvasItem): MoodboardTextAlign {
    return view.config.textAlign || 'center';
  }

  alignItems(view: MoodboardCanvasItem): string {
    const align = this.textAlign(view);
    if (align === 'left') {
      return 'flex-start';
    }

    if (align === 'right') {
      return 'flex-end';
    }

    return 'center';
  }

  justifyContent(view: MoodboardCanvasItem): string {
    const align = view.config.verticalAlign || 'middle';
    if (align === 'top') {
      return 'flex-start';
    }

    if (align === 'bottom') {
      return 'flex-end';
    }

    return 'center';
  }

  readableTextColor(background?: string): string {
    const hex = (background || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return '#18181b';
    }

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.58 ? '#18181b' : '#ffffff';
  }

  canPanByDrag(): boolean {
    return this.isSpacePressed() || this.dragState.mode === 'pan';
  }

  isCanvasPanning(): boolean {
    return this.dragState.mode === 'pan';
  }

  shapeTransform(view: MoodboardCanvasItem): string {
    const x = view.item.posX ?? 0;
    const y = view.item.posY ?? 0;
    const width = this.itemWidth(view);
    const height = this.itemHeight(view);
    return `translate(${x} ${y}) rotate(${view.config.rotation ?? 0} ${width / 2} ${height / 2})`;
  }

  htmlItemStyle(view: MoodboardCanvasItem): Record<string, string> {
    return {
      left: `${view.item.posX ?? 0}px`,
      top: `${view.item.posY ?? 0}px`,
      width: `${this.itemWidth(view)}px`,
      height: `${this.itemHeight(view)}px`,
      transform: `rotate(${view.config.rotation ?? 0}deg)`,
      'z-index': String((view.item.index ?? 0) + 20),
    };
  }

  selectionStyle(view: MoodboardCanvasItem): Record<string, string> {
    return {
      left: `${view.item.posX ?? 0}px`,
      top: `${view.item.posY ?? 0}px`,
      width: `${this.itemWidth(view)}px`,
      height: `${this.itemHeight(view)}px`,
      transform: `rotate(${view.config.rotation ?? 0}deg)`,
      'z-index': '9000',
    };
  }

  itemWidth(view: MoodboardCanvasItem): number {
    return Math.max(MIN_ITEM_SIZE, view.config.width ?? 180);
  }

  itemHeight(view: MoodboardCanvasItem): number {
    return Math.max(MIN_ITEM_SIZE, view.config.height ?? 96);
  }

  private loadMoodboard(id: string): void {
    const moodboard = this.moodboardService.getMoodboard(id);
    if (!moodboard) {
      return;
    }

    this.moodboard.set(moodboard);
    this.worldId = this.moodboardService.getMoodboardWorldId(id) || this.worldStateService.getCurrentWorld()?.id || null;
    this.items.set((moodboard.MoodboardItems || []).map(item => this.toCanvasItem(item)));
    this.tabManager.updateTabTitle(this.findActiveTabId(), moodboard.name || 'Moodboard');
    this.refreshEntities();
    this.cdr.markForCheck();
  }

  private findActiveTabId(): string {
    const layout = this.tabManager.snapshot;
    const pane = layout.panes.find(item => item.id === layout.focusedPaneId);
    return pane?.activeTabId || '';
  }

  private startCreateItem(tool: MoodboardTool, point: { x: number; y: number }, event: MouseEvent): void {
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'pendingCreate',
      createTool: tool,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCanvasX: point.x,
      startCanvasY: point.y,
      startItemX: point.x,
      startItemY: point.y,
    };
  }

  private startDrawing(point: CanvasPoint, event: MouseEvent): void {
    event.preventDefault();
    this.selectedItemId.set('');
    this.editingItemId.set('');
    this.drawingPoints = [point];
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'draw',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCanvasX: point.x,
      startCanvasY: point.y,
    };
    this.updateDrawingPreview();
  }

  private updateDrawing(point: CanvasPoint): void {
    const last = this.drawingPoints[this.drawingPoints.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < DRAWING_POINT_DISTANCE) {
      return;
    }

    this.drawingPoints.push(point);
    this.updateDrawingPreview();
  }

  private finishDrawing(): void {
    const points = [...this.drawingPoints];
    this.drawingPoints = [];
    this.drawingPreview.set(null);
    this.dragState = this.emptyDragState();

    if (points.length < 2) {
      this.cdr.markForCheck();
      return;
    }

    this.createDrawingItem(points);
    this.cdr.markForCheck();
  }

  private updateDrawingPreview(): void {
    const geometry = this.buildDrawingFromPoints(this.drawingPoints);
    this.drawingPreview.set(geometry
      ? { ...geometry, stroke: this.strokeColor(), strokeWidth: DEFAULT_DRAWING_STROKE_WIDTH }
      : null);
    this.cdr.markForCheck();
  }

  private createDrawingItem(points: CanvasPoint[]): MoodboardCanvasItem | null {
    const geometry = this.buildDrawingFromPoints(points);
    if (!geometry) {
      return null;
    }

    const view = this.createItem({
      kind: 'drawing',
      width: geometry.width,
      height: geometry.height,
      rotation: 0,
      text: '',
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: 'transparent',
      stroke: this.strokeColor(),
      strokeWidth: DEFAULT_DRAWING_STROKE_WIDTH,
      path: geometry.path,
      viewBox: geometry.viewBox,
    }, geometry.left, geometry.top, false);

    return view;
  }
  private createTextItem(x: number, y: number, edit = false): MoodboardCanvasItem | null {
    const view = this.createItem({
      kind: 'text',
      width: DEFAULT_TEXT_WIDTH,
      height: DEFAULT_TEXT_HEIGHT,
      rotation: 0,
      text: 'Texto',
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: DEFAULT_SHAPE_FILL,
      stroke: DEFAULT_SHAPE_STROKE,
      strokeWidth: 0,
    }, x, y);

    if (view && edit) {
      this.editingItemId.set(view.item.id);
    }

    this.activeTool.set('select');
    return view;
  }

  private createShapeItem(shapeType: MoodboardShapeType, x: number, y: number): MoodboardCanvasItem | null {
    const isLine = shapeType === 'line' || shapeType === 'arrow';
    const view = this.createItem({
      kind: 'shape',
      shapeType,
      width: isLine ? DEFAULT_LINE_WIDTH : DEFAULT_SHAPE_WIDTH,
      height: isLine ? DEFAULT_LINE_HEIGHT : DEFAULT_SHAPE_HEIGHT,
      rotation: 0,
      text: '',
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: this.fillColor(),
      stroke: this.strokeColor(),
      strokeWidth: 2,
      x1: 0,
      y1: isLine ? DEFAULT_LINE_HEIGHT / 2 : undefined,
      x2: isLine ? DEFAULT_LINE_WIDTH : undefined,
      y2: isLine ? DEFAULT_LINE_HEIGHT / 2 : undefined,
    }, x, y);
    this.activeTool.set('select');
    return view;
  }

  private createItem(config: MoodboardItemConfig, x: number, y: number, selectAfterCreate = true): MoodboardCanvasItem | null {
    const moodboardId = this.moodboard().id;
    if (!moodboardId) {
      return null;
    }

    const item = new MoodboardItem(
      '',
      JSON.stringify(config),
      Math.round(x),
      Math.round(y),
      this.nextIndex()
    );

    const saved = this.moodboardService.saveMoodboardItem(item, moodboardId);
    const view = this.toCanvasItem(saved);
    this.items.update(items => [...items, view]);
    if (selectAfterCreate) {
      this.selectItem(view);
    }
    this.cdr.markForCheck();
    return view;
  }

  private nextIndex(): number {
    const indexes = this.items().map(view => view.item.index ?? 0);
    return indexes.length ? Math.max(...indexes) + 1 : 1;
  }

  private toCanvasItem(item: MoodboardItem): MoodboardCanvasItem {
    const config = this.parseConfig(item.configJson);
    const entity = config.kind === 'entity' && config.entityTable && config.entityId
      ? this.moodboardService.getEntity(config.entityTable, config.entityId)
      : null;

    const document = config.kind === 'entity' && config.entityTable === 'Document' && config.entityId
      ? this.documentService.getDocument(config.entityId)
      : null;

    const documentBlocks = document ? this.documentToPreviewBlocks(document) : [];

    return { item, config, entity, document, documentBlocks };
  }

  private parseConfig(configJson?: string | null): MoodboardItemConfig {
    if (!configJson) {
      return {
        kind: 'text',
        width: 220,
        height: 92,
        text: '',
        textAlign: 'center',
        verticalAlign: 'middle',
        fill: DEFAULT_SHAPE_FILL,
        stroke: DEFAULT_SHAPE_STROKE,
      };
    }

    try {
      return this.withConfigDefaults(JSON.parse(configJson) as MoodboardItemConfig);
    }
    catch {
      return {
        kind: 'text',
        width: 220,
        height: 92,
        text: '',
        textAlign: 'center',
        verticalAlign: 'middle',
        fill: DEFAULT_SHAPE_FILL,
        stroke: DEFAULT_SHAPE_STROKE,
      };
    }
  }

  private withConfigDefaults(config: MoodboardItemConfig): MoodboardItemConfig {
    return {
      ...config,
      textAlign: config.textAlign || 'center',
      verticalAlign: config.verticalAlign || 'middle',
      fill: config.fill ?? DEFAULT_SHAPE_FILL,
      stroke: config.stroke || DEFAULT_SHAPE_STROKE,
    };
  }

  private updateItemConfig(id: string, updater: (config: MoodboardItemConfig) => MoodboardItemConfig): void {
    this.updateItem(id, view => {
      const config = updater(view.config);
      return {
        ...view,
        config,
        item: {
          ...view.item,
          configJson: JSON.stringify(config),
        },
      };
    }, true);
  }

  private updateItem(id: string, updater: (view: MoodboardCanvasItem) => MoodboardCanvasItem, save: boolean): void {
    this.items.update(items => items.map(view => {
      if (view.item.id !== id) {
        return view;
      }

      const next = updater(view);
      return {
        ...next,
        item: {
          ...next.item,
          configJson: JSON.stringify(next.config),
        },
      };
    }));

    if (save) {
      this.scheduleSave(id);
    }

    this.cdr.markForCheck();
  }

  private scheduleSave(id: string): void {
    const existing = this.saveTimers.get(id);
    if (existing) {
      clearTimeout(existing);
    }

    this.saveTimers.set(id, setTimeout(() => this.saveItemNow(id), 500));
  }

  private saveItemNow(id: string): void {
    const timer = this.saveTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(id);
    }

    const view = this.items().find(item => item.item.id === id);
    const moodboardId = this.moodboard().id;

    if (view && moodboardId) {
      this.moodboardService.saveMoodboardItem(view.item, moodboardId);
    }
  }

  private flushPendingSaves(): void {
    for (const id of Array.from(this.saveTimers.keys())) {
      this.saveItemNow(id);
    }
  }

  private onWindowMouseMove(event: MouseEvent): void {
    const state = this.dragState;
    if (state.mode === 'none') {
      return;
    }

    if (state.mode === 'pan') {
      const dx = event.clientX - state.startClientX;
      const dy = event.clientY - state.startClientY;
      this.panX.set(state.startPanX + dx);
      this.panY.set(state.startPanY + dy);
      this.cdr.markForCheck();
      return;
    }

    const point = this.clientToCanvasPoint(event.clientX, event.clientY);

    if (state.mode === 'draw') {
      this.updateDrawing(point);
      return;
    }

    if (state.mode === 'pendingCreate') {
      if (
        Math.abs(event.clientX - state.startClientX) < CREATE_DRAG_THRESHOLD &&
        Math.abs(event.clientY - state.startClientY) < CREATE_DRAG_THRESHOLD
      ) {
        return;
      }

      const view = state.createTool === 'text'
        ? this.createTextItem(state.startCanvasX, state.startCanvasY)
        : this.createShapeItem(state.createTool as MoodboardShapeType, state.startCanvasX, state.startCanvasY);

      if (!view) {
        this.dragState = this.emptyDragState();
        return;
      }

      this.dragState = {
        ...state,
        mode: 'create',
        itemId: view.item.id,
        startWidth: this.itemWidth(view),
        startHeight: this.itemHeight(view),
      };
      this.updateCreatedItem(view.item.id, point);
      return;
    }

    const view = this.items().find(item => item.item.id === state.itemId);
    if (!view) {
      return;
    }

    const dx = point.x - state.startCanvasX;
    const dy = point.y - state.startCanvasY;
    state.moved = true;

    if (state.mode === 'item') {
      this.updateItem(state.itemId, current => ({
        ...current,
        item: {
          ...current.item,
          posX: Math.round(state.startItemX + dx),
          posY: Math.round(state.startItemY + dy),
        },
      }), true);
      return;
    }

    if (state.mode === 'create') {
      this.updateCreatedItem(state.itemId, point);
      return;
    }

    if (state.mode === 'resize') {
      this.resizeItemFromHandle(state.itemId, point);
      return;
    }

    if (state.mode === 'endpoint' && state.endpoint) {
      this.updateLineEndpoint(state.itemId, state.endpoint, point);
      return;
    }

    if (state.mode === 'rotate') {
      let angle = Math.atan2(point.y - state.centerY, point.x - state.centerX) * 180 / Math.PI + 90;
      if (event.ctrlKey) {
        angle = Math.round(angle / 15) * 15;
      }
      this.updateItemConfig(state.itemId, config => ({
        ...config,
        rotation: Math.round(angle),
      }));
    }
  }

  private onWindowMouseUp(): void {
    if (this.dragState.mode === 'draw') {
      this.finishDrawing();
      return;
    }

    if (this.dragState.mode === 'pendingCreate') {
      this.dragState = this.emptyDragState();
      return;
    }

    if (this.dragState.mode !== 'none' && this.dragState.itemId) {
      this.saveItemNow(this.dragState.itemId);
    }

    this.dragState = this.emptyDragState();
  }

  private onWindowKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !this.isTypingTarget(event.target)) {
      this.isSpacePressed.set(true);
      event.preventDefault();
    }

    if (this.editingItemId()) {
      if (event.key === 'Escape') {
        this.stopEditing();
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.deleteSelected();
      return;
    }

    if (event.key === 'Escape') {
      this.selectedItemId.set('');
      this.activeTool.set('select');
      this.cdr.markForCheck();
    }
  }

  private onWindowKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.isSpacePressed.set(false);
      this.cdr.markForCheck();
    }
  }

  private isPanGesture(event: MouseEvent): boolean {
    return event.button === 1 || (event.button === 0 && this.isSpacePressed());
  }

  private startPanDrag(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.editingItemId.set('');
    this.dragState = {
      ...this.emptyDragState(),
      mode: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: this.panX(),
      startPanY: this.panY(),
    };
    this.cdr.markForCheck();
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.isContentEditable
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      || !!target.closest('.codex-editor');
  }

  private clientToCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.stage?.nativeElement.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: (clientX - rect.left - this.panX()) / this.zoom(),
      y: (clientY - rect.top - this.panY()) / this.zoom(),
    };
  }

  private defaultCreatePoint(): { x: number; y: number } {
    const rect = this.stage?.nativeElement.getBoundingClientRect();
    if (!rect) {
      return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    }

    return this.clientToCanvasPoint(rect.left + rect.width / 2 - 110, rect.top + rect.height / 2 - 60);
  }

  private emptyDragState(): DragState {
    return {
      mode: 'none',
      itemId: '',
      startClientX: 0,
      startClientY: 0,
      startCanvasX: 0,
      startCanvasY: 0,
      startPanX: 0,
      startPanY: 0,
      startItemX: 0,
      startItemY: 0,
      startWidth: 0,
      startHeight: 0,
      startRotation: 0,
      resizeHandle: '',
      endpoint: '',
      createTool: '',
      centerX: 0,
      centerY: 0,
      moved: false,
    };
  }

  private updateCreatedItem(id: string, point: { x: number; y: number }): void {
    const state = this.dragState;

    this.updateItem(id, view => {
      const isLine = view.config.kind === 'shape' && (view.config.shapeType === 'line' || view.config.shapeType === 'arrow');

      if (isLine) {
        return this.buildLineItemFromAbsolutePoints(view, state.startCanvasX, state.startCanvasY, point.x, point.y);
      }

      const left = Math.min(state.startCanvasX, point.x);
      const top = Math.min(state.startCanvasY, point.y);
      const width = Math.max(MIN_ITEM_SIZE, Math.abs(point.x - state.startCanvasX));
      const height = Math.max(MIN_ITEM_SIZE, Math.abs(point.y - state.startCanvasY));

      return {
        ...view,
        item: {
          ...view.item,
          posX: Math.round(left),
          posY: Math.round(top),
        },
        config: {
          ...view.config,
          width: Math.round(width),
          height: Math.round(height),
        },
      };
    }, true);
  }

  private updateLineEndpoint(id: string, endpoint: LineEndpoint, point: { x: number; y: number }): void {
    this.updateItem(id, view => {
      const absoluteStart = {
        x: (view.item.posX ?? 0) + this.lineX1(view),
        y: (view.item.posY ?? 0) + this.lineY1(view),
      };
      const absoluteEnd = {
        x: (view.item.posX ?? 0) + this.lineX2(view),
        y: (view.item.posY ?? 0) + this.lineY2(view),
      };

      if (endpoint === 'start') {
        return this.buildLineItemFromAbsolutePoints(view, point.x, point.y, absoluteEnd.x, absoluteEnd.y);
      }

      return this.buildLineItemFromAbsolutePoints(view, absoluteStart.x, absoluteStart.y, point.x, point.y);
    }, true);
  }

  private buildLineItemFromAbsolutePoints(
    view: MoodboardCanvasItem,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): MoodboardCanvasItem {
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.max(MIN_ITEM_SIZE, Math.abs(endX - startX));
    const height = Math.max(MIN_ITEM_SIZE, Math.abs(endY - startY));

    return {
      ...view,
      item: {
        ...view.item,
        posX: Math.round(left),
        posY: Math.round(top),
      },
      config: {
        ...view.config,
        width: Math.round(width),
        height: Math.round(height),
        x1: Math.round(startX - left),
        y1: Math.round(startY - top),
        x2: Math.round(endX - left),
        y2: Math.round(endY - top),
      },
    };
  }

  private buildDrawingFromPoints(points: CanvasPoint[]): DrawingGeometry | null {
    if (points.length < 2) {
      return null;
    }

    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const left = Math.floor(Math.min(...xs) - DRAWING_PADDING);
    const top = Math.floor(Math.min(...ys) - DRAWING_PADDING);
    const width = Math.max(MIN_ITEM_SIZE, Math.ceil(Math.max(...xs) - Math.min(...xs) + DRAWING_PADDING * 2));
    const height = Math.max(MIN_ITEM_SIZE, Math.ceil(Math.max(...ys) - Math.min(...ys) + DRAWING_PADDING * 2));
    const localPoints = points.map(point => ({
      x: point.x - left,
      y: point.y - top,
    }));

    return {
      left,
      top,
      width,
      height,
      path: this.pointsToSvgPath(localPoints),
      viewBox: `0 0 ${width} ${height}`,
    };
  }

  private pointsToSvgPath(points: CanvasPoint[]): string {
    const first = points[0];
    if (!first) {
      return '';
    }

    let path = `M ${this.roundSvgNumber(first.x)} ${this.roundSvgNumber(first.y)}`;
    if (points.length === 1) {
      return path;
    }

    for (let index = 1; index < points.length - 1; index++) {
      const current = points[index];
      const next = points[index + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      path += ` Q ${this.roundSvgNumber(current.x)} ${this.roundSvgNumber(current.y)} ${this.roundSvgNumber(midX)} ${this.roundSvgNumber(midY)}`;
    }

    const last = points[points.length - 1];
    return `${path} L ${this.roundSvgNumber(last.x)} ${this.roundSvgNumber(last.y)}`;
  }

  private roundSvgNumber(value: number): number {
    return Math.round(value * 10) / 10;
  }
  private resizeItemFromHandle(id: string, point: { x: number; y: number }): void {
    const state = this.dragState;
    const handle = state.resizeHandle;
    let nextX = state.startItemX;
    let nextY = state.startItemY;
    let nextWidth = state.startWidth;
    let nextHeight = state.startHeight;

    if (handle.includes('e')) {
      nextWidth = Math.max(MIN_ITEM_SIZE, point.x - state.startItemX);
    }

    if (handle.includes('s')) {
      nextHeight = Math.max(MIN_ITEM_SIZE, point.y - state.startItemY);
    }

    if (handle.includes('w')) {
      const right = state.startItemX + state.startWidth;
      nextX = Math.min(point.x, right - MIN_ITEM_SIZE);
      nextWidth = right - nextX;
    }

    if (handle.includes('n')) {
      const bottom = state.startItemY + state.startHeight;
      nextY = Math.min(point.y, bottom - MIN_ITEM_SIZE);
      nextHeight = bottom - nextY;
    }

    this.updateItem(id, view => ({
      ...view,
      item: {
        ...view.item,
        posX: Math.round(nextX),
        posY: Math.round(nextY),
      },
      config: {
        ...view.config,
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      },
    }), true);
  }

  private documentToPreviewBlocks(document: Document | null): DocumentPreviewBlock[] {
    if (!document?.content) {
      return [];
    }

    try {
      const parsed = JSON.parse(document.content);
      const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
      return blocks.slice(0, 30).map((block: Record<string, unknown>) => this.toPreviewBlock(block));
    }
    catch {
      return [{ type: 'paragraph', text: document.content }];
    }
  }

  private toPreviewBlock(block: Record<string, unknown>): DocumentPreviewBlock {
    const data = (block['data'] || {}) as Record<string, unknown>;
    const type = String(block['type'] || 'paragraph');

    if (type === 'list') {
      return { type, text: this.listItemsToText(data['items']).join('\n') };
    }

    if (type === 'table') {
      const rows = Array.isArray(data['content']) ? data['content'] as unknown[][] : [];
      return {
        type,
        text: '',
        rows: rows.map(row => row.map(cell => this.htmlToText(String(cell)))),
      };
    }

    if (type === 'quote') {
      return {
        type,
        text: [
          this.htmlToText(String(data['text'] || '')),
          this.htmlToText(String(data['caption'] || '')),
        ].filter(Boolean).join('\n'),
      };
    }

    if (type === 'image') {
      return {
        type,
        text: this.htmlToText(String(data['caption'] || data['url'] || data['file'] || '')),
      };
    }

    return {
      type,
      level: Number(data['level'] || 2),
      text: this.htmlToText(String(data['text'] || data['caption'] || '')),
    };
  }

  private listItemsToText(items: unknown, depth = 0): string[] {
    if (!Array.isArray(items)) {
      return [];
    }

    const lines: string[] = [];
    for (const item of items) {
      if (typeof item === 'string') {
        lines.push(`${'  '.repeat(depth)}- ${this.htmlToText(item)}`);
        continue;
      }

      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const content = this.htmlToText(String(record['content'] || record['text'] || ''));
        if (content) {
          lines.push(`${'  '.repeat(depth)}- ${content}`);
        }
        lines.push(...this.listItemsToText(record['items'], depth + 1));
      }
    }

    return lines;
  }

  private htmlToText(html: string): string {
    const element = document.createElement('div');
    element.innerHTML = html || '';
    element.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return (element.textContent || '').replace(/\u00A0/g, ' ').trim();
  }

  private hexToRgba(hex: string, opacity: number): string {
    const value = hex.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
      return value;
    }

    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
}
