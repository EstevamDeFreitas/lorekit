import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Age } from '../../../models/age.model';
import { GreatMark } from '../../../models/great-mark.model';
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
type DragKind = 'age-move' | 'age-start' | 'age-end' | 'mark-move' | 'event-move' | 'event-start' | 'event-end';
type TimelineItem = Age | GreatMark | TimelineEvent;
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
  imports: [EditorComponent, FormsModule, IconButtonComponent, PersonalizationButtonComponent, SafeDeleteButtonComponent],
  template: `
    <div class="timeline-page">
      <header class="timeline-toolbar">
        <div class="flex min-w-0 items-center gap-3">
          @if (isRouteComponent()) {
            <app-icon-button buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/timeline"></app-icon-button>
          }
          <input class="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none" [(ngModel)]="timeline.name" (blur)="saveTimeline()" aria-label="Nome da timeline">
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <app-icon-button title="Nova era" icon="fa-solid fa-layer-group" buttonType="white" size="xl" (click)="openAgeDialog(defaultDate())"></app-icon-button>
          <app-icon-button title="Novo marco" icon="fa-solid fa-location-dot" buttonType="white" size="xl" (click)="openGreatMarkDialog(defaultDate())"></app-icon-button>
          <app-icon-button title="Novo evento" icon="fa-solid fa-plus" buttonType="white" size="xl" (click)="openEventDialog(defaultDate())"></app-icon-button>
          <app-personalization-button [entityId]="timeline.id" [entityTable]="'Timeline'" [size]="'xl'"></app-personalization-button>
          <app-safe-delete-button [entityName]="timeline.name" [entityId]="timeline.id" [entityTable]="'Timeline'" [size]="'xl'"></app-safe-delete-button>
        </div>
      </header>
      <details class="timeline-summary">
        <summary>Resumo da timeline</summary>
        <app-editor [entityId]="timeline.id" docTitle="Descrição" entityTable="Timeline" [entityName]="timeline.name" [document]="timeline.description || ''" (saveDocument)="timelineDescriptionChange($event)"></app-editor>
      </details>
      <section #viewport class="timeline-viewport scrollbar-dark">
        <div #canvas class="timeline-canvas" [style.width.px]="canvasWidth" [style.height.px]="canvasHeight">
          <div class="timeline-ruler">
            <div class="timeline-ruler-title">Anos</div>
            @for (year of yearTicks; track year) {
              <div class="year-tick" [style.left.px]="dateToX(year)">
                <span>{{ formatYear(year) }}</span>
              </div>
            }
          </div>
          @for (age of ages; track age.id) {
            <div
              class="age-context"
              [style.left.px]="dateToX(age.startDate)"
              [style.width.px]="ageContextWidth(age.startDate, age.endDate)"
              [style.background-color]="rgba(colorOf(age), .16)">
            </div>
            <article
              class="age-bar"
              [style.left.px]="dateToX(age.startDate)"
              [style.top.px]="ageTop(age)"
              [style.width.px]="ageRangeWidth(age.startDate, age.endDate)"
              [style.--age-color]="colorOf(age)"
              [title]="formatText(age.description, age.startDate, age.endDate)"
              (pointerdown)="startDrag($event, 'age-move', age)">
              <button class="range-handle start" aria-label="Alterar início da era" (pointerdown)="startDrag($event, 'age-start', age)"></button>
              <div class="age-content">
                <span class="age-label">
                  @if (iconOf(age)) { <i [class]="itemIconClass(age)"></i> }
                  {{ formatText(age.name, age.startDate, age.endDate) }}
                </span>
              </div>
              <button class="range-handle end" aria-label="Alterar fim da era" (pointerdown)="startDrag($event, 'age-end', age)"></button>
            </article>
          }
          <div class="timeline-axis" [style.top.px]="axisTop"></div>
          <div class="marks-layer">
            @for (mark of greatMarks; track mark.id) {
              <article class="great-mark" role="button" tabindex="0"
                [style.left.px]="dateToX(mark.date)"
                [style.top.px]="markTop"
                [style.--mark-color]="colorOf(mark)"
                (pointerdown)="startDrag($event, 'mark-move', mark)">
                <span class="great-mark-dot"><i [class]="greatMarkIconClass(mark)"></i></span>
                <span class="great-mark-name">{{ formatText(mark.name, mark.date, mark.date) }}</span>
                <span class="great-mark-date">{{ formatYear(mark.date) }}</span>
              </article>
            }
          </div>
          <div class="events-label" [style.top.px]="eventTopBase - 28">Eventos — arraste para posicionar; mova verticalmente para organizar em faixas</div>
          @for (event of events; track event.id) {
            <article
              class="event-bar"
              [style.left.px]="dateToX(event.startDate)"
              [style.top.px]="eventTop(event)"
              [style.width.px]="rangeWidth(event.startDate, event.endDate)"
              [style.--event-color]="colorOf(event)"
              [class]="getTextClass(colorOf(event))"
              (pointerdown)="startDrag($event, 'event-move', event)">
              <button class="range-handle start" aria-label="Alterar início do evento" (pointerdown)="startDrag($event, 'event-start', event)"></button>
              <div class="event-content">
                <div class="event-heading">{{ formatText(event.name, event.startDate, event.endDate) }}</div>
                <div class="event-meta">{{ formatText(event.date || '{AutoGenDate}', event.startDate, event.endDate) }}</div>
                @if (event.description) { <div class="event-description">{{ formatText(event.description, event.startDate, event.endDate) }}</div> }
              </div>
              <button class="range-handle end" aria-label="Alterar fim do evento" (pointerdown)="startDrag($event, 'event-end', event)"></button>
            </article>
          }
          @if (ages.length === 0 && greatMarks.length === 0 && events.length === 0) {
            <div class="timeline-empty">
              <i class="fa-solid fa-timeline text-3xl"></i>
              <span>Comece criando uma era, um marco ou um evento.</span>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styleUrl: './timeline-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineEditComponent implements OnDestroy {
  readonly AGE_RULER_TOP = 52;
  readonly AGE_RULER_HEIGHT = 38;
  readonly EVENT_ROW_HEIGHT = 82;
  axisTop = 236;
  markTop = 204;
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
  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;
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
  minDate = 0;
  maxDate = 100;
  pixelsPerYear = 8;
  canvasWidth = 1400;
  canvasHeight = 520;
  yearTicks: number[] = [0];
  private drag: TimelineDrag | null = null;
  private readonly pointerMove = (event: PointerEvent) => this.moveDrag(event);
  private readonly pointerUp = (event: PointerEvent) => this.endDrag(event);
  constructor() {
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
  }
  loadTimeline(): void {
    const id = this.timelineId();
    if (!id) return;
    this.timeline = this.timelineService.getTimelineById(id);
    this.ages = this.ageService.getAgesByTimelineId(id);
    this.greatMarks = this.greatMarkService.getGreatMarksByTimelineId(id);
    this.events = this.eventService.getEventsByTimelineId(id);
    this.refreshLayout();
  }
  timelineDescriptionChange(value: unknown): void {
    this.timeline.description = JSON.stringify(value);
    this.saveTimeline();
  }
  saveTimeline(): void {
    if (!this.timeline.id || !this.timeline.name.trim()) return;
    this.saveTask.schedule(() => {
      this.timelineService.saveTimeline(this.timeline, this.timeline.ParentWorld?.id || null);
      this.entityChangeService.notifySave('Timeline', this.timeline.id);
    });
  }
  defaultDate(): number {
    return this.ages.length || this.greatMarks.length || this.events.length ? this.maxDate : 0;
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
  eventTop(event: TimelineEvent): number {
    return this.eventTopBase + Math.max(0, event.lane || 0) * this.EVENT_ROW_HEIGHT;
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
    const range = item as Age | TimelineEvent;
    const eventStartTop = isEvent ? this.eventTop(item as TimelineEvent) : 0;
    const canvasTop = this.canvas?.nativeElement.getBoundingClientRect().top ?? 0;

    const pointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    pointerTarget?.setPointerCapture?.(event.pointerId);

    this.drag = {
      kind,
      item,
      clientX: event.clientX,
      clientY: event.clientY,
      startDate: 'startDate' in range ? range.startDate : 0,
      endDate: 'endDate' in range ? range.endDate : 0,
      date: isMark ? (item as GreatMark).date : undefined,
      lane: isEvent ? (item as TimelineEvent).lane : undefined,
      eventStartTop,
      pointerOffsetY: isEvent ? event.clientY - canvasTop - eventStartTop : 0,
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
      mark.date = Math.round((drag.date ?? mark.date) + dateDelta);
    } else {
      const item = drag.item as Age | TimelineEvent;
      if (drag.kind === 'age-start' || drag.kind === 'event-start') {
        item.startDate = Math.min(Math.round(drag.startDate + dateDelta), drag.endDate - 1);
      } else if (drag.kind === 'age-end' || drag.kind === 'event-end') {
        item.endDate = Math.max(Math.round(drag.endDate + dateDelta), drag.startDate + 1);
      } else {
        const duration = drag.endDate - drag.startDate;
        item.startDate = Math.round(drag.startDate + dateDelta);
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

  private endDrag = async (event?: PointerEvent): Promise<void> => {
    const drag = this.drag;
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;

    this.drag = null;
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    if (drag.pointerTarget?.hasPointerCapture(drag.pointerId)) {
      drag.pointerTarget.releasePointerCapture(drag.pointerId);
    }

    if (!drag.moved) {
      if (drag.kind === 'mark-move') {
        this.openGreatMarkDialog((drag.item as GreatMark).date, (drag.item as GreatMark).id);
      } else if (drag.kind === 'event-move' || drag.kind === 'event-start' || drag.kind === 'event-end') {
        this.openEventDialog((drag.item as TimelineEvent).startDate, (drag.item as TimelineEvent).id);
      } else {
        this.openAgeDialog((drag.item as Age).startDate, (drag.item as Age).id);
      }
      return;
    }

    if (drag.kind === 'mark-move') {
      const mark = drag.item as GreatMark;
      await this.greatMarkService.saveDate(mark.id, mark.date);
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

  private async persistEventPlacement(event: TimelineEvent): Promise<void> {
    await this.eventService.saveEventPlacement(event.id, event.startDate, event.endDate, event.lane);
  }
  openAgeDialog(defaultStartDate: number, ageId?: string): void {
    this.openDialog(AgeEditComponent, { id: ageId, timelineId: this.timeline.id, defaultStartDate });
  }
  openGreatMarkDialog(defaultDate: number, markId?: string): void {
    this.openDialog(GreatMarkEditComponent, { id: markId, timelineId: this.timeline.id, defaultSortOrder: defaultDate });
  }
  openEventDialog(defaultDate: number, eventId?: string): void {
    this.openDialog(TimelineEventEditComponent, { id: eventId, timelineId: this.timeline.id, defaultSortOrder: defaultDate, worldId: this.timeline.ParentWorld?.id || null }, '90vw', '980px');
  }
  private openDialog(component: unknown, data: object, width = '36rem', maxWidth = '92vw'): void {
    const ref = this.dialog.open(component as any, { panelClass: ['screen-dialog', 'overflow-visible'], width, maxWidth, data });
    ref.closed.subscribe((result: any) => {
      if (result?.saved || result?.deleted) this.zone.run(() => this.loadTimeline());
    });
  }
  private isTimelineItemChange(table: string, id: string): boolean {
    if (table === 'Timeline') return id === this.timelineId();
    if (table === 'Age') return this.ages.some(item => item.id === id);
    if (table === 'GreatMark') return this.greatMarks.some(item => item.id === id);
    return false;
  }
  private refreshLayout(): void {
    const primaryDates = [
      ...this.ages.flatMap(age => [age.startDate, age.endDate]),
      ...this.events.flatMap(event => [event.startDate, event.endDate]),
    ].map(value => Math.round(Number(value) || 0));
    const dates = primaryDates.length
      ? primaryDates
      : this.greatMarks.map(mark => Math.round(Number(mark.date) || 0));
    this.minDate = dates.length ? Math.min(...dates) : 0;
    const lastDate = dates.length ? Math.max(...dates) : 100;
    const span = Math.max(1, lastDate - this.minDate);
    this.maxDate = lastDate + Math.max(10, Math.ceil(span * .06));
    this.pixelsPerYear = span > 5000 ? 1 : span > 1000 ? 2 : span > 250 ? 4 : 8;
    this.canvasWidth = Math.max(1400, (this.maxDate - this.minDate) * this.pixelsPerYear + 140);
    this.assignAgeLanes();
    const maxEventLane = Math.max(0, ...this.events.map(event => Number(event.lane) || 0));
    const maxAgeLane = Math.max(0, ...Object.values(this.ageLanes));
    const ageHeaderBottom = this.AGE_RULER_TOP + (maxAgeLane + 1) * this.AGE_RULER_HEIGHT;
    this.axisTop = Math.max(184, ageHeaderBottom + 76);
    this.markTop = this.axisTop - 32;
    this.eventTopBase = this.axisTop + 64;
    this.canvasHeight = Math.max(520, this.eventTopBase + (maxEventLane + 1) * this.EVENT_ROW_HEIGHT + 72);
    this.yearTicks = this.buildYearTicks();
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