import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Age } from '../../../models/age.model';
import { GreatMark } from '../../../models/great-mark.model';
import { buildImageRecordUrl, getImageByUsageKey, Image } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { TimelineEvent } from '../../../models/timeline-event.model';
import { Timeline } from '../../../models/timeline.model';
import { AgeService } from '../../../services/age.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { EventService } from '../../../services/event.service';
import { GreatMarkService } from '../../../services/great-mark.service';
import { TimelineService } from '../../../services/timeline.service';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { EditorComponent } from '../../../components/editor/editor.component';
import { AgeEditComponent } from '../age-edit/age-edit.component';
import { GreatMarkEditComponent } from '../great-mark-edit/great-mark-edit.component';
import { TimelineEventEditComponent } from '../timeline-event-edit/timeline-event-edit.component';
import { WORKSPACE_TAB_CONTEXT } from '../../../models/workspace-tab-context';
import { DISCARD_PENDING_SAVES_EVENT, FLUSH_PENDING_SAVES_EVENT, PendingSaveEventDetail, pendingSaveEventMatchesTab } from '../../../utils/pending-save-event';
type DragKind = 'age-move' | 'age-start' | 'age-end' | 'mark-move' | 'event-move' | 'event-start' | 'event-end';
type TimelineItem = Age | GreatMark | TimelineEvent;
type TimelineIndexKind = 'age' | 'mark' | 'event';

interface TimelineIndexItem {
  kind: TimelineIndexKind;
  id: string;
  label: string;
  typeLabel: string;
  dateLabel: string;
  summary: string;
  color: string;
  icon: string;
  date: number;
  endDate: number;
}

interface TimelineDrag {
  kind: DragKind;
  item: TimelineItem;
  clientX: number;
  startDate: number;
  clientY: number;
  endDate: number;
  date?: number;
  lane?: number;
  eventStartTop: number;
  pointerOffsetY: number;
  pixelsPerYear: number;
  pointerId: number;
  pointerTarget: HTMLElement | null;
  moved: boolean;
}
@Component({
  selector: 'app-timeline-edit',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, EditorComponent, FormsModule, IconButtonComponent, PersonalizationButtonComponent, SafeDeleteButtonComponent],
  templateUrl: './timeline-edit.component.html',
  styleUrl: './timeline-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineEditComponent implements OnDestroy {
  readonly AGE_RULER_TOP = 52;
  readonly AGE_RULER_HEIGHT = 38;
  readonly EVENT_ROW_HEIGHT = 82;
  readonly MARK_ROW_HEIGHT = 56;
  axisTop = 236;
  markTopBase = 219;
  eventTopBase = 300;
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly timelineService = inject(TimelineService);
  private readonly ageService = inject(AgeService);
  private readonly greatMarkService = inject(GreatMarkService);
  private readonly eventService = inject(EventService);
  private readonly entityChangeService = inject(EntityChangeService);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 500);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabContext = inject(WORKSPACE_TAB_CONTEXT, { optional: true });
  private unregisterTabLifecycle?: () => void;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;
  @ViewChild('viewport') private viewport?: ElementRef<HTMLElement>;
  dialogRef = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });
  timelineIdInput = input<string | null>(null);
  readonly timelineId = computed(() => this.timelineIdInput() || this.data?.id || this.activatedRoute.snapshot.paramMap.get('timelineId') || '');
  readonly isRouteComponent = computed(() => this.router.routerState.root.firstChild?.component === TimelineEditComponent || this.activatedRoute.component === TimelineEditComponent);
  readonly getTextClass = getTextClass;
  timeline = new Timeline();
  ages: Age[] = [];
  greatMarks: GreatMark[] = [];
  events: TimelineEvent[] = [];
  ageLanes: Record<string, number> = {};
  minDate = -500;
  maxDate = 500;
  private lastContentDate = 0;
  pixelsPerYear = 8;
  private zoomFactor = 1;
  canvasWidth = 1400;
  canvasHeight = 520;
  yearTicks: number[] = [0];
  timelineIndexItems: TimelineIndexItem[] = [];
  filteredTimelineIndexItems: TimelineIndexItem[] = [];
  timelineIndexSearch = '';
  timelineIndexFilter: TimelineIndexKind | 'all' = 'all';
  showTimelineIndex = true;
  selectedTimelineItemKey = '';
  quickAddDate: number | null = null;
  quickAddLeft = 0;
  quickAddTop = 0;
  saveState: 'saved' | 'saving' | 'error' = 'saved';
  private drag: TimelineDrag | null = null;
  private readonly pointerMove = (event: PointerEvent) => this.moveDrag(event);
  private readonly pointerUp = (event: PointerEvent) => this.endDrag(event);
  private readonly flushPendingSaves = (event: Event): void => {
    const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
    if (!pendingSaveEventMatchesTab(detail, this.tabContext?.tabId) || !this.drag) return;
    const flush = this.endDrag(undefined, true);
    if (detail) detail.flushes.push(flush);
    else void flush;
  };
  private readonly discardPendingSaves = (event: Event): void => {
    const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
    if (pendingSaveEventMatchesTab(detail, this.tabContext?.tabId)) this.cancelDrag();
  };
  constructor() {
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, this.flushPendingSaves);
    window.addEventListener(DISCARD_PENDING_SAVES_EVENT, this.discardPendingSaves);
    this.unregisterTabLifecycle = this.tabContext?.onActiveChange(active => {
      if (!active && this.drag) this.cancelDrag();
    });
    effect(() => {
      if (this.timelineId() && this.timeline.id !== this.timelineId()) this.loadTimeline();
    });

    this.entityChangeService.changes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(change => {
        if (!this.isTimelineItemChange(change.table, change.id)) return;
        this.zone.run(() => this.loadTimeline());
      });
  }
  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, this.flushPendingSaves);
    window.removeEventListener(DISCARD_PENDING_SAVES_EVENT, this.discardPendingSaves);
    this.unregisterTabLifecycle?.();
    this.cancelDrag();
  }
  loadTimeline(): void {
    const id = this.timelineId();
    if (!id) return;
    const loadedTimeline = this.timelineService.getTimelineById(id);
    if (!loadedTimeline) {
      this.timeline = new Timeline();
      this.ages = [];
      this.greatMarks = [];
      this.events = [];
      this.timelineIndexItems = [];
      this.filteredTimelineIndexItems = [];
      if (this.dialogRef) {
        this.dialogRef.close({ deleted: true });
      } else if (this.isRouteComponent()) {
        void this.router.navigate(['/app/timeline']);
      }
      return;
    }

    this.timeline = loadedTimeline;
    this.timeline.timeUnitName ||= 'Anos';
    this.ages = this.ageService.getAgesByTimelineId(id);
    this.greatMarks = this.greatMarkService.getGreatMarksByTimelineId(id);
    this.events = this.eventService.getEventsByTimelineId(id);
    this.saveState = 'saved';
    this.refreshLayout();
  }
  onTimelineWheel(event: WheelEvent): void {
    const viewport = this.viewport?.nativeElement;
    if (!viewport) return;

    if (!event.ctrlKey) {
      if (event.shiftKey && event.deltaY) {
        event.preventDefault();
        viewport.scrollLeft += event.deltaY;
      }
      return;
    }

    const direction = Math.sign(event.deltaY || event.deltaX);
    if (!direction) return;
    const bounds = viewport.getBoundingClientRect();
    const pointerOffset = event.clientX - bounds.left;
    const dateAtPointer = this.minDate + (viewport.scrollLeft + pointerOffset - 54) / this.pixelsPerYear;
    this.zoomFactor = Math.max(.25, Math.min(8, this.zoomFactor * (direction < 0 ? 1.12 : .89)));
    this.refreshLayout();
    viewport.scrollLeft = Math.max(0, this.dateToX(dateAtPointer) - pointerOffset);
    this.cdr.markForCheck();
  }
  zoomIn(): void {
    this.setZoom(this.zoomFactor * 1.2);
  }
  zoomOut(): void {
    this.setZoom(this.zoomFactor * .82);
  }
  resetZoom(): void {
    this.setZoom(1);
  }
  zoomLabel(): string {
    return `${Math.round(this.zoomFactor * 100)}%`;
  }
  onCanvasClick(event: MouseEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('.timeline-interactive-item, button, .timeline-tooltip, .timeline-quick-add')) return;

    const canvas = this.canvas?.nativeElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const date = Math.round(this.minDate + (localX - 54) / this.pixelsPerYear);

    this.quickAddDate = date;
    this.quickAddLeft = Math.max(12, Math.min(this.canvasWidth - 210, localX - 72));
    this.quickAddTop = Math.max(58, Math.min(this.canvasHeight - 96, localY - 18));
    this.cdr.markForCheck();
  }
  closeQuickAdd(): void {
    this.quickAddDate = null;
  }
  onTimelineItemKeydown(event: KeyboardEvent, kind: TimelineIndexKind, item: TimelineItem): void {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (kind === 'age') this.openAgeDialog((item as Age).startDate, item.id);
    if (kind === 'mark') this.openGreatMarkDialog((item as GreatMark).date, item.id);
    if (kind === 'event') this.openEventDialog((item as TimelineEvent).startDate, item.id);
  }
  quickCreate(kind: TimelineIndexKind): void {
    const date = this.quickAddDate ?? this.defaultDate();
    this.closeQuickAdd();
    if (kind === 'age') this.openAgeDialog(date);
    if (kind === 'mark') this.openGreatMarkDialog(date);
    if (kind === 'event') this.openEventDialog(date);
  }
  filterTimelineIndex(): void {
    const term = this.timelineIndexSearch.trim().toLocaleLowerCase();
    this.filteredTimelineIndexItems = this.timelineIndexItems.filter(item => {
      const matchesType = this.timelineIndexFilter === 'all' || item.kind === this.timelineIndexFilter;
      const matchesTerm = !term || `${item.label} ${item.typeLabel} ${item.summary} ${item.dateLabel}`.toLocaleLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  }
  setTimelineIndexFilter(filter: TimelineIndexKind | 'all'): void {
    this.timelineIndexFilter = filter;
    this.filterTimelineIndex();
  }
  selectTimelineIndex(item: TimelineIndexItem): void {
    this.selectedTimelineItemKey = this.timelineItemKey(item.kind, item.id);
    this.focusTimelineItem(item);
    this.cdr.markForCheck();
  }
  openTimelineIndexItem(item: TimelineIndexItem): void {
    this.selectTimelineIndex(item);
    if (item.kind === 'age') this.openAgeDialog(item.date, item.id);
    if (item.kind === 'mark') this.openGreatMarkDialog(item.date, item.id);
    if (item.kind === 'event') this.openEventDialog(item.date, item.id);
  }
  isTimelineIndexSelected(item: TimelineIndexItem): boolean {
    return this.selectedTimelineItemKey === this.timelineItemKey(item.kind, item.id);
  }
  private setZoom(nextZoom: number): void {
    const viewport = this.viewport?.nativeElement;
    const centerDate = viewport
      ? this.minDate + (viewport.scrollLeft + viewport.clientWidth / 2 - 54) / this.pixelsPerYear
      : this.defaultDate();
    this.zoomFactor = Math.max(.25, Math.min(8, nextZoom));
    this.refreshLayout();
    if (viewport) viewport.scrollLeft = Math.max(0, this.dateToX(centerDate) - viewport.clientWidth / 2);
    this.cdr.markForCheck();
  }
  timelineDescriptionChange(value: unknown): void {
    this.timeline.description = JSON.stringify(value);
    this.saveTimeline();
  }
  saveTimeline(): void {
    if (!this.timeline.id || !this.timeline.name.trim()) return;
    this.timeline.timeUnitName = this.timeline.timeUnitName?.trim() || 'Anos';
    this.saveState = 'saving';
    this.saveTask.schedule(() => {
      try {
        this.timelineService.saveTimeline(this.timeline, this.timeline.ParentWorld?.id || null);
        this.entityChangeService.notifySave('Timeline', this.timeline.id);
        this.saveState = 'saved';
      } catch {
        this.saveState = 'error';
      }
      this.zone.run(() => this.cdr.markForCheck());
    });
  }
  defaultDate(): number {
    return this.ages.length || this.greatMarks.length || this.events.length ? this.lastContentDate : 0;
  }
  dateToX(date: number): number {
    return Math.round((Math.round(Number(date) || 0) - this.minDate) * this.pixelsPerYear + 54);
  }
  rangeWidth(start: number, end: number): number {
    return Math.max(46, (Math.max(start, end) - start) * this.pixelsPerYear + 46);
  }
  ageTop(age: Age): number {
    return this.AGE_RULER_TOP + (this.ageLanes[age.id] || 0) * this.AGE_RULER_HEIGHT;
  }
  ageRangeWidth(start: number, end: number): number {
    return Math.max(16, (Math.max(start, end) - start) * this.pixelsPerYear);
  }
  ageContextWidth(start: number, end: number): number {
    return this.ageRangeWidth(start, end);
  }
  markTop(mark: GreatMark): number {
    return this.markTopBase + Math.max(0, mark.lane || 0) * this.MARK_ROW_HEIGHT;
  }
  markSectionTop(): number {
    return this.markTopBase - 12;
  }
  markSectionHeight(): number {
    return Math.max(0, this.eventTopBase - this.markSectionTop() - 8);
  }
  eventTop(event: TimelineEvent): number {
    return this.eventTopBase + Math.max(0, event.lane || 0) * this.EVENT_ROW_HEIGHT;
  }
  isCompactEvent(event: TimelineEvent): boolean {
    return Math.max(0, event.endDate - event.startDate) * this.pixelsPerYear <= 24;
  }
  eventWidth(event: TimelineEvent): number {
    return this.isCompactEvent(event) ? 42 : this.rangeWidth(event.startDate, event.endDate);
  }
  eventLeft(event: TimelineEvent): number {
    return this.isCompactEvent(event) ? this.dateToX(event.startDate) - 21 : this.dateToX(event.startDate);
  }
  colorOf(item: { Personalization?: unknown }): string {
    return getPersonalizationValue(item, 'color') || '#52525B';
  }
  iconOf(item: { Personalization?: unknown }): string | null {
    return getPersonalizationValue(item, 'icon');
  }
  itemIconClass(item: { Personalization?: unknown }): string {
    return `fa-solid ${this.iconOf(item) || 'fa-question'}`;
  }
  greatMarkIconClass(mark: GreatMark): string {
    return `${this.itemIconClass(mark)} great-mark-icon`;
  }
  ageBackgroundImage(age: Age): string | null {
    return this.itemBackgroundImage(age, 'linear-gradient(rgb(9 9 11 / .78), rgb(9 9 11 / .78))');
  }
  eventBackgroundImage(event: TimelineEvent): string | null {
    return this.itemBackgroundImage(
      event,
      `linear-gradient(105deg, ${this.rgba(this.colorOf(event), .82)}, rgb(9 9 11 / .72))`,
    );
  }
  markBackgroundImage(mark: GreatMark): string | null {
    return this.itemBackgroundImage(mark, 'linear-gradient(rgb(9 9 11 / .72), rgb(9 9 11 / .72))');
  }
  private itemBackgroundImage(item: { Images?: Image[] }, overlay: string): string | null {
    const image = getImageByUsageKey(item.Images, 'default');
    const url = buildImageRecordUrl(image);
    return url ? `${overlay}, url("${url.replaceAll('"', '\\"')}")` : null;
  }  tooltipBackgroundImage(item: { Personalization?: unknown; Images?: Image[] }): string | null {
    return this.itemBackgroundImage(
      item,
      `linear-gradient(135deg, ${this.rgba(this.colorOf(item), .9)}, rgb(9 9 11 / .86))`,
    );
  }
  formatYear(value: number): string {
    return String(Math.round(value));
  }
  formatText(value: string | null | undefined, startDate: number, endDate: number): string {
    const start = this.formatYear(startDate);
    const end = this.formatYear(endDate);
    const center = this.formatYear(Math.round((Number(startDate) + Number(endDate)) / 2));
    return (value || '')
      .replaceAll('{AutoGenStartDate}', start)
      .replaceAll('{AutoGenEndDate}', end)
      .replaceAll('{AutoGenDate}', center);
  }
  startDrag(event: PointerEvent, kind: DragKind, item: TimelineItem): void {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const isMark = kind === 'mark-move';
    const isEvent = kind === 'event-move' || kind === 'event-start' || kind === 'event-end';
    const indexKind: TimelineIndexKind = isMark ? 'mark' : isEvent ? 'event' : 'age';
    const hasLane = isMark || isEvent;
    const range = item as Age | TimelineEvent;
    const eventStartTop = isMark ? this.markTop(item as GreatMark) : isEvent ? this.eventTop(item as TimelineEvent) : 0;
    const canvasTop = this.canvas?.nativeElement.getBoundingClientRect().top ?? 0;

    const pointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    pointerTarget?.setPointerCapture?.(event.pointerId);
    this.selectedTimelineItemKey = this.timelineItemKey(indexKind, item.id);
    this.closeQuickAdd();

    this.drag = {
      kind,
      item,
      clientX: event.clientX,
      clientY: event.clientY,
      startDate: 'startDate' in range ? range.startDate : 0,
      endDate: 'endDate' in range ? range.endDate : 0,
      date: isMark ? (item as GreatMark).date : undefined,
      lane: hasLane ? (item as GreatMark | TimelineEvent).lane : undefined,
      eventStartTop,
      pointerOffsetY: hasLane ? event.clientY - canvasTop - eventStartTop : 0,
      pixelsPerYear: this.pixelsPerYear,
      pointerId: event.pointerId,
      pointerTarget,
      moved: false,
    };

    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerup', this.pointerUp);
  }

  private moveDrag = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const deltaX = event.clientX - drag.clientX;
    const deltaY = event.clientY - drag.clientY;
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) drag.moved = true;

    const dateDelta = Math.round(deltaX / drag.pixelsPerYear);
    if (drag.kind === 'mark-move') {
      const mark = drag.item as GreatMark;
      mark.date = this.snapDate((drag.date ?? mark.date) + dateDelta, event);
      const canvasTop = this.canvas?.nativeElement.getBoundingClientRect().top;
      const targetTop = canvasTop === undefined
        ? drag.eventStartTop + deltaY
        : event.clientY - canvasTop - drag.pointerOffsetY;
      mark.lane = Math.max(0, Math.floor((targetTop - this.markTopBase + this.MARK_ROW_HEIGHT / 2) / this.MARK_ROW_HEIGHT));
      this.greatMarks = [...this.greatMarks];
    } else {
      const item = drag.item as Age | TimelineEvent;
      if (drag.kind === 'age-start' || drag.kind === 'event-start') {
        item.startDate = Math.min(this.snapDate(drag.startDate + dateDelta, event), drag.endDate - 1);
      } else if (drag.kind === 'age-end' || drag.kind === 'event-end') {
        item.endDate = Math.max(this.snapDate(drag.endDate + dateDelta, event), drag.startDate + 1);
      } else {
        const duration = drag.endDate - drag.startDate;
        item.startDate = this.snapDate(drag.startDate + dateDelta, event);
        item.endDate = item.startDate + duration;
      }

      if (drag.kind === 'event-move') {
        const timelineEvent = item as TimelineEvent;
        const canvasTop = this.canvas?.nativeElement.getBoundingClientRect().top;
        const targetTop = canvasTop === undefined
          ? drag.eventStartTop + deltaY
          : event.clientY - canvasTop - drag.pointerOffsetY;
        timelineEvent.lane = Math.max(0, Math.floor((targetTop - this.eventTopBase + this.EVENT_ROW_HEIGHT / 2) / this.EVENT_ROW_HEIGHT));
        this.events = [...this.events];
        this.canvasHeight = Math.max(this.canvasHeight, this.eventTopBase + (timelineEvent.lane + 1) * this.EVENT_ROW_HEIGHT + 72);
      }
    }


    this.cdr.markForCheck();
  };

  private endDrag = async (event?: PointerEvent, suppressClickAction = false): Promise<void> => {
    const drag = this.drag;
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;

    this.drag = null;
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    if (drag.pointerTarget?.hasPointerCapture(drag.pointerId)) {
      drag.pointerTarget.releasePointerCapture(drag.pointerId);
    }

    if (!drag.moved) {
      if (!suppressClickAction) {
        if (drag.kind === 'mark-move') {
          this.openGreatMarkDialog((drag.item as GreatMark).date, (drag.item as GreatMark).id);
        } else if (drag.kind === 'event-move' || drag.kind === 'event-start' || drag.kind === 'event-end') {
          this.openEventDialog((drag.item as TimelineEvent).startDate, (drag.item as TimelineEvent).id);
        } else {
          this.openAgeDialog((drag.item as Age).startDate, (drag.item as Age).id);
        }
      }
      return;
    }

    if (drag.kind === 'mark-move') {
      const mark = drag.item as GreatMark;
      await this.greatMarkService.saveDate(mark.id, mark.date, mark.lane);
      this.entityChangeService.notifySave('GreatMark', mark.id);
    } else if (drag.kind === 'event-move' || drag.kind === 'event-start' || drag.kind === 'event-end') {
      const timelineEvent = drag.item as TimelineEvent;
      await this.persistEventPlacement(timelineEvent);
    } else {
      const age = drag.item as Age;
      await this.ageService.saveRange(age.id, age.startDate, age.endDate);
      this.entityChangeService.notifySave('Age', age.id);
    }

    this.refreshLayout();
    this.cdr.markForCheck();
  };

  private cancelDrag(): void {
    const drag = this.drag;
    this.drag = null;
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    if (drag?.pointerTarget?.hasPointerCapture(drag.pointerId)) {
      drag.pointerTarget.releasePointerCapture(drag.pointerId);
    }
  }

  private async persistEventPlacement(event: TimelineEvent): Promise<void> {
    await this.eventService.saveEventPlacement(event.id, event.startDate, event.endDate, event.lane);
  }
  openAgeDialog(defaultStartDate: number, ageId?: string): void {
    this.openDialog(AgeEditComponent, { id: ageId, timelineId: this.timeline.id, defaultStartDate });
  }
  openGreatMarkDialog(defaultDate: number, markId?: string): void {
    this.openDialog(GreatMarkEditComponent, { id: markId, timelineId: this.timeline.id, defaultSortOrder: defaultDate, worldId: this.timeline.ParentWorld?.id || null }, '90vw', '980px');
  }
  openEventDialog(defaultDate: number, eventId?: string): void {
    this.openDialog(TimelineEventEditComponent, { id: eventId, timelineId: this.timeline.id, defaultSortOrder: defaultDate, worldId: this.timeline.ParentWorld?.id || null }, '90vw', '980px');
  }
  private openDialog(component: unknown, data: object, width = '36rem', maxWidth = '92vw'): void {
    const ref = this.dialog.open(component as any, { panelClass: ['screen-dialog', 'overflow-visible'], width, maxWidth, data });
    ref.closed.subscribe(() => {
      this.zone.run(() => {
        this.loadTimeline();
        this.cdr.markForCheck();
      });
    });
  }
  private isTimelineItemChange(table: string, id: string): boolean {
    if (table === 'Timeline') return id === this.timelineId();
    if (table === 'Age') return this.ages.some(item => item.id === id);
    if (table === 'GreatMark') return this.greatMarks.some(item => item.id === id);
    if (table === 'Event') return this.events.some(item => item.id === id);
    return false;
  }
  private refreshLayout(): void {
    const dates = [
      ...this.ages.flatMap(age => [age.startDate, age.endDate]),
      ...this.events.flatMap(event => [event.startDate, event.endDate]),
      ...this.greatMarks.flatMap(mark => [mark.startDate, mark.endDate, mark.date]),
    ].map(value => Math.round(Number(value) || 0));
    const firstContentDate = dates.length ? Math.min(...dates) : 0;
    this.lastContentDate = dates.length ? Math.max(...dates) : 0;
    const contentSpan = Math.max(1, this.lastContentDate - firstContentDate);
    this.minDate = firstContentDate - 500;
    this.maxDate = this.lastContentDate + 500;
    const basePixelsPerYear = contentSpan > 5000 ? 1 : contentSpan > 1000 ? 2 : contentSpan > 250 ? 4 : 8;
    this.pixelsPerYear = Math.max(.25, basePixelsPerYear * this.zoomFactor);
    this.canvasWidth = Math.max(1400, (this.maxDate - this.minDate) * this.pixelsPerYear + 140);
    this.assignAgeLanes();
    const maxEventLane = Math.max(0, ...this.events.map(event => Number(event.lane) || 0));
    const maxAgeLane = Math.max(0, ...Object.values(this.ageLanes));
    const ageHeaderBottom = this.AGE_RULER_TOP + (maxAgeLane + 1) * this.AGE_RULER_HEIGHT;
    this.axisTop = Math.max(184, ageHeaderBottom + 76);
    this.markTopBase = this.axisTop - 17;
    const maxMarkLane = Math.max(0, ...this.greatMarks.map(mark => Number(mark.lane) || 0));
    this.eventTopBase = this.axisTop + 72 + maxMarkLane * this.MARK_ROW_HEIGHT;
    this.canvasHeight = Math.max(520, this.eventTopBase + (maxEventLane + 1) * this.EVENT_ROW_HEIGHT + 72);
    this.yearTicks = this.buildYearTicks();
    this.rebuildTimelineIndex();
  }
  private rebuildTimelineIndex(): void {
    const unit = this.timeline.timeUnitName || 'Anos';
    this.timelineIndexItems = [
      ...this.ages.map(age => ({
        kind: 'age' as const,
        id: age.id,
        label: this.formatText(age.name || 'Era sem nome', age.startDate, age.endDate),
        typeLabel: 'Era',
        dateLabel: `${this.formatYear(age.startDate)} — ${this.formatYear(age.endDate)} ${unit}`,
        summary: this.formatText(age.description, age.startDate, age.endDate),
        color: this.colorOf(age),
        icon: this.itemIconClass(age),
        date: age.startDate,
        endDate: age.endDate,
      })),
      ...this.greatMarks.map(mark => ({
        kind: 'mark' as const,
        id: mark.id,
        label: this.formatText(mark.name || 'Marco sem nome', mark.startDate, mark.endDate),
        typeLabel: 'Marco',
        dateLabel: `${this.formatText(mark.displayDate || '{AutoGenDate}', mark.startDate, mark.endDate)} ${unit}`,
        summary: this.formatText(mark.description, mark.startDate, mark.endDate),
        color: this.colorOf(mark),
        icon: this.greatMarkIconClass(mark),
        date: mark.date,
        endDate: mark.endDate,
      })),
      ...this.events.map(event => ({
        kind: 'event' as const,
        id: event.id,
        label: this.formatText(event.name || 'Evento sem nome', event.startDate, event.endDate),
        typeLabel: 'Evento',
        dateLabel: `${this.formatText(event.date || '{AutoGenDate}', event.startDate, event.endDate)} ${unit}`,
        summary: this.formatText(event.description, event.startDate, event.endDate),
        color: this.colorOf(event),
        icon: this.itemIconClass(event),
        date: event.startDate,
        endDate: event.endDate,
      })),
    ].sort((a, b) => a.date - b.date || a.typeLabel.localeCompare(b.typeLabel));
    this.filterTimelineIndex();
  }
  private focusTimelineItem(item: TimelineIndexItem): void {
    const viewport = this.viewport?.nativeElement;
    if (!viewport) return;
    const itemTop = item.kind === 'age'
      ? this.ageTop(this.ages.find(age => age.id === item.id) || this.ages[0])
      : item.kind === 'mark'
        ? this.markTop(this.greatMarks.find(mark => mark.id === item.id) || this.greatMarks[0])
        : this.eventTop(this.events.find(event => event.id === item.id) || this.events[0]);
    viewport.scrollLeft = Math.max(0, this.dateToX(item.date) - viewport.clientWidth * .38);
    viewport.scrollTop = Math.max(0, itemTop - viewport.clientHeight * .36);
  }
  private timelineItemKey(kind: TimelineIndexKind, id: string): string {
    return `${kind}:${id}`;
  }
  private assignAgeLanes(): void {
    const laneEnds: number[] = [];
    const lanes: Record<string, number> = {};
    for (const age of [...this.ages].sort((a, b) => a.startDate - b.startDate || a.endDate - b.endDate)) {
      let lane = laneEnds.findIndex(end => end < age.startDate);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = age.endDate;
      lanes[age.id] = lane;
    }
    this.ageLanes = lanes;
  }
  private snapDate(value: number, event: PointerEvent): number {
    const step = event.ctrlKey && event.shiftKey ? 1000 : event.shiftKey ? 100 : event.ctrlKey ? 10 : 1;
    return Math.round(value / step) * step;
  }
  private buildYearTicks(): number[] {
    const target = 96 / this.pixelsPerYear;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
    const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= target) || magnitude * 10;
    const ticks = [this.minDate];
    for (let year = Math.ceil(this.minDate / step) * step; year <= this.maxDate; year += step) {
      if (year !== this.minDate) ticks.push(Math.round(year));
    }
    return ticks;
  }
  rgba(hex: string, alpha: number): string {
    const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#52525B';
    return `rgba(${Number.parseInt(normalized.slice(1, 3), 16)}, ${Number.parseInt(normalized.slice(3, 5), 16)}, ${Number.parseInt(normalized.slice(5, 7), 16)}, ${alpha})`;
  }
  private isGreatMark(item: TimelineItem): item is GreatMark {
    return 'date' in item && !('startDate' in item);
  }
  private isEvent(item: TimelineItem): item is TimelineEvent {
    return 'lane' in item;
  }
  private isAge(item: TimelineItem): item is Age {
    return 'startDate' in item && !this.isEvent(item);
  }
}
