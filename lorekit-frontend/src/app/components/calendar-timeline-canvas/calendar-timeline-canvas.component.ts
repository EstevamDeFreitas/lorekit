import { buildImageRecordUrl, getImageByUsageKey } from '../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../models/personalization.model';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarDatePickerComponent } from '../calendar-date-picker/calendar-date-picker.component';
import { CalendarBinding, CalendarDate } from '../../models/calendar.model';
import { Timeline } from '../../models/timeline.model';
import { CalendarService } from '../../services/calendar.service';
import { CalendarTemporalRecord, CalendarTemporalTable, CalendarTimelineService } from '../../services/calendar-timeline.service';
import { CalendarEngine, compareCalendarInstants, parseCalendarDate } from '../../utils/calendar-engine';
import { CalendarScale, availableCalendarScales, calendarTicks, moveCalendarDates, shiftCalendarDate } from '../../utils/calendar-timeline-layout';

import { WORKSPACE_TAB_CONTEXT } from '../../models/workspace-tab-context';
import { FLUSH_PENDING_SAVES_EVENT, PendingSaveEventDetail, pendingSaveEventMatchesTab } from '../../utils/pending-save-event';

interface CalendarCanvasItem { table: CalendarTemporalTable; source: CalendarTemporalRecord; start: CalendarDate; end: CalendarDate; left: number; right: number; }
interface CalendarCanvasGroup { key: string; items: CalendarCanvasItem[]; day: number; row: number; }
@Component({ selector: 'app-calendar-timeline-canvas', imports: [FormsModule, CalendarDatePickerComponent], templateUrl: './calendar-timeline-canvas.component.html', styleUrls: ['../calendar-controls.css', '../timeline-items.css', './calendar-timeline-canvas.component.css'], changeDetection: ChangeDetectionStrategy.OnPush, host: { class: 'scrollbar-dark' } })
export class CalendarTimelineCanvasComponent {
  readonly timeline = input.required<Timeline>(); readonly refresh = input(0);
  readonly editItem = output<{ table: CalendarTemporalTable; id: string }>();
  readonly createItem = output<{ table: CalendarTemporalTable; date: CalendarDate }>();
  readonly updated = output<void>();
  private readonly calendars = inject(CalendarService); private readonly timelines = inject(CalendarTimelineService);
  readonly Math = Math; readonly getTextClass = getTextClass;
  readonly selectedId = input<string | null>(null);
  private initializedKey = '';
  private readonly context = inject(WORKSPACE_TAB_CONTEXT, { optional: true });
  private pendingWrite: Promise<void> | null = null;
  private needsFlush = false;
  readonly start = signal(0); readonly span = signal(3600); readonly width = signal(1000);
  readonly scale = signal<CalendarScale | 'auto'>('auto'); readonly snap = signal<'day' | 'week' | 'month' | 'year'>('day');
  readonly error = signal(''); readonly group = signal<CalendarCanvasGroup | null>(null); readonly showGoTo = signal(false); readonly showSeasons = signal(false); readonly quickDate = signal<CalendarDate | null>(null); readonly movePreview = signal('');
  plot?: ElementRef<HTMLElement>;
  @ViewChild('plot') set plotElement(element: ElementRef<HTMLElement> | undefined) {
    this.observer?.disconnect(); this.plot = element;
    if (element) { this.observer = new ResizeObserver(entries => this.width.set(Math.max(200, entries[0].contentRect.width))); this.observer.observe(element.nativeElement); }
  }
  private observer?: ResizeObserver;
  private drag: { item: CalendarCanvasItem; origin: number; originY: number; mode: 'move' | 'start' | 'end'; lane: number; moved: boolean; next: { start: CalendarDate; end: CalendarDate } | null } | null = null;
  readonly binding = computed<CalendarBinding>(() => ({ calendarId: this.timeline().calendarId!, revisionId: this.timeline().calendarRevisionId!, countId: this.timeline().calendarCountId ?? undefined, formatId: this.timeline().calendarFormatId ?? undefined }));
  readonly state = computed(() => { this.refresh(); try { return { engine: this.calendars.resolve(this.binding(), this.timeline().ParentWorld?.id).engine, error: '' }; } catch (e) { return { engine: null, error: e instanceof Error ? e.message : 'Calendário indisponível.' }; } });
  readonly scales = computed(() => this.state().engine ? availableCalendarScales(this.state().engine!) : []);
  readonly activeScale = computed<CalendarScale>(() => {
    const engine = this.state().engine; if (!engine) return 'year';
    if (this.scale() !== 'auto') return this.scale() as CalendarScale;
    const years = this.span() / engine.daysPerYear;
    if (years > 200) return 'century'; if (years > 20) return 'decade'; if (years > 2) return 'year';
    if (this.span() > 80 && engine.rules.months.length) return 'month'; if (this.span() > 30 && engine.rules.week.enabled) return 'week'; return 'day';
  });
  readonly ticks = computed(() => this.state().engine ? calendarTicks(this.state().engine!, this.start(), this.start() + this.span(), this.activeScale(), this.binding().countId, Math.max(4, Math.floor(this.width() / 90))) : []);
  readonly placementPreview = signal<{ table: CalendarTemporalTable; id: string; start: CalendarDate; end: CalendarDate; lane: number } | null>(null);
  readonly items = computed(() => {
    this.refresh(); const engine = this.state().engine; if (!engine) return [];
    const items: CalendarCanvasItem[] = [];
    for (const { table, source: storedSource } of this.timelines.records(this.timeline().id, true)) {
      const preview = this.placementPreview();
      const active = preview?.table === table && preview.id === storedSource.id ? preview : null;
      const source = active ? { ...storedSource, lane: active.lane } : storedSource;
      if (table === 'Age' && source.calendarConvertedCountId) continue;
      try {
        const start = active?.start ?? parseCalendarDate(source.calendarStartJson, engine), end = active?.end ?? parseCalendarDate(source.calendarEndJson, engine);
        if (!start || !end || start.calendarId !== this.binding().calendarId || start.revisionId !== this.binding().revisionId || end.calendarId !== start.calendarId || end.revisionId !== start.revisionId) continue;
        const a = engine.bounds(start), b = engine.bounds(end);
        const left = a.start.day + a.start.second / engine.secondsPerDay, right = b.end.day + b.end.second / engine.secondsPerDay;
        if (right >= this.start() && left <= this.start() + this.span()) items.push({ table, source, start, end, left, right });
      } catch { /* Errors are exposed by unresolvedItems instead of reinterpreting data. */ }
    }
    return items.sort((a, b) => a.left - b.left || a.source.id.localeCompare(b.source.id));
  });
  readonly convertedPeriods = computed(() => { this.refresh(); return this.timelines.records(this.timeline().id, true).filter(item => item.table === 'Age' && !!item.source.calendarConvertedCountId); });
  readonly unresolvedItems = computed(() => {
    this.refresh(); const engine = this.state().engine; if (!engine) return [];
    return this.timelines.records(this.timeline().id, true).filter(item => {
      try { const a = parseCalendarDate(item.source.calendarStartJson, engine), b = parseCalendarDate(item.source.calendarEndJson, engine); return !a || !b || a.calendarId !== this.binding().calendarId || a.revisionId !== this.binding().revisionId || b.calendarId !== a.calendarId || b.revisionId !== a.revisionId; } catch { return true; }
    });
  });
  readonly groups = computed(() => {
    const groups = new Map<string, CalendarCanvasGroup>();
    for (const item of this.items()) {
      const row = item.table === 'Age' ? 0 : item.table === 'GreatMark' ? 1 : 2;
      const key = row + ':' + Math.max(0, item.source.lane || 0) + ':' + Math.floor(Math.max(0, this.x(item.left)) / 100);
      const current = groups.get(key);
      if (current) current.items.push(item); else groups.set(key, { key, items: [item], day: item.left, row });
    }
    return [...groups.values()];
  });
  readonly seasonTicks = computed(() => {
    const engine = this.state().engine; if (!engine || !this.showSeasons()) return [];
    const ticks = calendarTicks(engine, this.start(), this.start() + this.span(), this.activeScale(), this.binding().countId, 120);
    return ticks.map(tick => ({ day: tick.day, names: engine.seasons(engine.fromOrdinal(tick.day)).map(s => s.name).join(', ') })).filter(t => !!t.names);
  });
  readonly rangeLabel = computed(() => { const engine = this.state().engine; if (!engine) return ''; const a = this.dateAt(this.start(), 'day'), b = this.dateAt(this.start() + this.span() - 1, 'day'); return engine.format(a, this.binding().formatId, this.binding().countId) + ' a ' + engine.format(b, this.binding().formatId, this.binding().countId); });
  constructor() {
    effect(() => {
      const engine = this.state().engine, timelineId = this.timeline().id;
      if (!engine) return;
      const key = timelineId + ':' + this.binding().calendarId + ':' + this.binding().revisionId;
      if (key === this.initializedKey) return;
      this.initializedKey = key;
      untracked(() => {
        const first = this.timelines.records(timelineId).map(r => { try { return parseCalendarDate(r.source.calendarStartJson, engine); } catch { return null; } }).find(d => !!d);
        this.start.set(first ? engine.bounds(first).start.day - engine.daysPerYear : -engine.daysPerYear); this.span.set(engine.daysPerYear * 10);
      });
    });
    const move = (event: PointerEvent) => this.onMove(event), up = () => { void this.onUp().catch(() => undefined); };
    const flush = (event: Event): void => {
      const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
      if (pendingSaveEventMatchesTab(detail, this.context?.tabId) && (this.drag || this.pendingWrite || this.needsFlush)) detail?.flushes.push(this.onUp());
    };
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, flush);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    inject(DestroyRef).onDestroy(() => { this.observer?.disconnect(); window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, flush); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); });
  }
  x(day: number): number { return (day - this.start()) / this.span() * this.width(); }
  itemWidth(item: CalendarCanvasItem): number { return Math.max(16, Math.min(this.width() - Math.max(0, this.x(item.left)), this.x(item.right) - Math.max(0, this.x(item.left)))); }
  readonly periodLanes = computed(() => {
    const ends: number[] = [], lanes: Record<string, number> = {};
    for (const item of this.items().filter(i => i.table === 'Age')) {
      let lane = ends.findIndex(end => end < item.left); if (lane < 0) lane = ends.length;
      ends[lane] = item.right; lanes[item.source.id] = lane;
    }
    return lanes;
  });
  readonly markBase = computed(() => 184 + Math.max(0, ...Object.values(this.periodLanes())) * 38);
  readonly eventBase = computed(() => this.markBase() + 90 + Math.max(0, ...this.items().filter(i => i.table === 'GreatMark').map(i => i.source.lane || 0)) * 56);
  readonly plotHeight = computed(() => Math.max(520, this.eventBase() + 154 + Math.max(0, ...this.items().filter(i => i.table === 'Event').map(i => i.source.lane || 0)) * 82));
  top(item: CalendarCanvasItem): number { return (item.table === 'Age' ? 52 : item.table === 'GreatMark' ? this.markBase() : this.eventBase()) + Math.max(0, item.table === 'Age' ? this.periodLanes()[item.source.id] || 0 : item.source.lane || 0) * (item.table === 'Age' ? 38 : item.table === 'GreatMark' ? 56 : 82); }
  compact(item: CalendarCanvasItem): boolean { return JSON.stringify(item.start) === JSON.stringify(item.end) || this.itemWidth(item) <= 24; }
  color(item: CalendarCanvasItem): string { return getPersonalizationValue(item.source, 'color') || '#52525B'; }
  icon(item: CalendarCanvasItem): string { return 'fa-solid ' + (getPersonalizationValue(item.source, 'icon') || 'fa-question'); }
  background(item: CalendarCanvasItem): string | null {
    const url = buildImageRecordUrl(getImageByUsageKey(item.source.Images, 'default'));
    return url ? 'linear-gradient(105deg, rgb(9 9 11 / .65), rgb(9 9 11 / .8)), url("' + url.replaceAll('"', '\\"') + '")' : null;
  }
  text(item: CalendarCanvasItem, value: string): string { return (value || '').replaceAll('{AutoGenStartDate}', this.formatted(item.start)).replaceAll('{AutoGenEndDate}', this.formatted(item.end)).replaceAll('{AutoGenDate}', this.formatted(item.start)); }
  open(item: CalendarCanvasItem): void { this.editItem.emit({ table: item.table, id: item.source.id }); }
  itemKey(item: CalendarCanvasItem): string { return (item.table === 'Age' ? 'age' : item.table === 'GreatMark' ? 'mark' : 'event') + ':' + item.source.id; }
  keydown(event: KeyboardEvent, item: CalendarCanvasItem): void { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.open(item); } }
  focusItem(table: CalendarTemporalTable, id: string): void {
    const record = this.timelines.records(this.timeline().id).find(i => i.table === table && i.source.id === id);
    if (!record) return;
    try {
      const date = parseCalendarDate(record.source.calendarStartJson, this.state().engine!);
      if (!date || record.source.calendarConvertedCountId) { this.editItem.emit({ table, id }); return; }
      this.goTo(date);
      const group = this.groups().find(group => group.items.some(item => item.source.id === id && item.table === table));
      this.group.set(group && group.items.length > 1 ? group : null);
    } catch { this.editItem.emit({ table, id }); return; }
    requestAnimationFrame(() => this.plot?.nativeElement.querySelector<HTMLElement>('[data-item-id="' + CSS.escape(id) + '"]')?.focus());
  }
  typeLabel(table: CalendarTemporalTable): string { return table === 'Age' ? 'Período' : table === 'GreatMark' ? 'Marco' : 'Evento'; }
  formatted(date: CalendarDate): string { try { return this.state().engine!.format(date, this.binding().formatId, this.binding().countId); } catch { return 'Data indisponível'; } }
  scaleLabel(scale: CalendarScale): string { return ({ century: 'Séculos', decade: 'Décadas', year: 'Anos', month: 'Meses', week: 'Semanas', day: 'Dias' })[scale]; }
  selectScale(scale: CalendarScale | 'auto'): void {
    const engine = this.state().engine; if (!engine) return;
    this.scale.set(scale); const size = scale === 'century' ? engine.daysPerYear * 500 : scale === 'decade' ? engine.daysPerYear * 50 : scale === 'year' ? engine.daysPerYear * 10 : scale === 'month' ? engine.daysPerYear : scale === 'week' ? Math.max(40, engine.rules.week.days.length * 10) : 20;
    if (scale !== 'auto') { const center = this.start() + this.span() / 2; this.span.set(size); this.start.set(center - size / 2); }
  }
  zoom(factor: number, fraction = .5): void { const anchor = this.start() + this.span() * fraction; const span = Math.max(4, Math.min(this.state().engine!.daysPerYear * 1_000_000, this.span() * factor)); this.scale.set('auto'); this.span.set(span); this.start.set(anchor - span * fraction); }
  pan(direction: number): void { this.start.update(start => Math.round(start + this.span() * .6 * direction)); this.quickDate.set(null); }
  wheel(event: WheelEvent): void {
    if (event.ctrlKey) { event.preventDefault(); const rect = this.plot!.nativeElement.getBoundingClientRect(); this.zoom(event.deltaY < 0 ? .7 : 1.4, Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))); }
    else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { event.preventDefault(); this.start.update(start => Math.round(start + (event.deltaX || event.deltaY) / this.width() * this.span())); }
  }
  dateAt(day: number, precision: 'year' | 'month' | 'day'): CalendarDate {
    const engine = this.state().engine!, point = engine.fromOrdinal(Math.floor(day));
    const date: CalendarDate = { version: 1, calendarId: this.binding().calendarId, revisionId: this.binding().revisionId, precision, year: point.year,
      ...(precision !== 'year' && point.monthId ? { monthId: point.monthId } : {}), ...(precision === 'day' ? { day: point.day } : {}) };
    if (this.binding().countId) { date.countId = this.binding().countId; date.side = engine.countedYear(point, date.countId).side; }
    return date;
  }
  plotClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget || !this.plot) return;
    const day = this.start() + (event.clientX - this.plot.nativeElement.getBoundingClientRect().left) / this.width() * this.span();
    const scale = this.activeScale(), precision = ['century', 'decade', 'year'].includes(scale) ? 'year' : scale === 'month' ? 'month' : 'day';
    this.quickDate.set(this.dateAt(day, precision)); this.group.set(null);
  }
  goTo(date: CalendarDate | null): void { if (!date) return; const bounds = this.state().engine!.bounds(date); this.start.set(Math.round(bounds.start.day - this.span() / 2)); this.showGoTo.set(false); }
  openGroup(group: CalendarCanvasGroup): void { if (group.items.length === 1) this.editItem.emit({ table: group.items[0].table, id: group.items[0].source.id }); else this.group.set(group); }
  startDrag(event: PointerEvent, item: CalendarCanvasItem, mode: 'move' | 'start' | 'end' = 'move'): void {
    if (event.button !== 0 || this.pendingWrite || this.needsFlush) return;
    event.preventDefault(); event.stopPropagation(); this.error.set('');
    this.drag = { item, origin: event.clientX, originY: event.clientY, mode, lane: Math.max(0, item.source.lane || 0), moved: false, next: null };
  }
  private onMove(event: PointerEvent): void {
    const drag = this.drag; if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.origin) < 6 && Math.abs(event.clientY - drag.originY) < 6) return;
    drag.moved = true;
    try {
      const engine = this.state().engine!, raw = (event.clientX - drag.origin) / this.width() * this.span();
      const step = this.snap() === 'year' ? engine.daysPerYear : this.snap() === 'week' ? engine.rules.week.days.length || 1 : this.snap() === 'month' ? engine.rules.months.find(m => m.id === drag.item.start.monthId)?.days ?? engine.daysPerYear : 1;
      const days = Math.round(raw / step) * step;
      if (drag.mode === 'move') {
        drag.next = moveCalendarDates(engine, drag.item.start, drag.item.end, days);
        if (drag.item.table !== 'Age') drag.lane = Math.max(0, Math.round((drag.item.source.lane || 0) + (event.clientY - drag.originY) / (drag.item.table === 'Event' ? 82 : 56)));
      } else {
        const date = drag.mode === 'start' ? drag.item.start : drag.item.end;
        let shifted = shiftCalendarDate(engine, date, days);
        const other = drag.mode === 'start' ? drag.item.end : drag.item.start;
        const order = compareCalendarInstants(engine.bounds(shifted).start, engine.bounds(other).start);
        if (drag.mode === 'start' ? order > 0 : order < 0) shifted = { ...other };
        drag.next = { start: drag.mode === 'start' ? shifted : drag.item.start, end: drag.mode === 'end' ? shifted : drag.item.end };
        engine.validateRange(drag.next.start, drag.next.end);
      }
      this.error.set('');
      this.placementPreview.set({ table: drag.item.table, id: drag.item.source.id, ...drag.next, lane: drag.lane });
      this.movePreview.set(this.formatted(drag.next.start) + ' a ' + this.formatted(drag.next.end));
    } catch (e) { drag.next = null; this.placementPreview.set(null); this.movePreview.set(''); this.error.set(e instanceof Error ? e.message : 'Movimento inválido.'); }
  }
  private onUp(): Promise<void> {
    if (this.pendingWrite) return this.pendingWrite;
    const drag = this.drag; this.drag = null; this.movePreview.set(''); this.placementPreview.set(null);
    if (drag && !drag.moved) this.open(drag.item);
    if (drag?.next) {
      try { this.timelines.saveItemDates(drag.item.table, drag.item.source.id, this.timeline().id, drag.next.start, drag.next.end, drag.lane); this.needsFlush = true; }
      catch (e) { this.error.set(e instanceof Error ? e.message : 'Movimento inválido.'); return Promise.reject(e); }
    }
    if (!this.needsFlush) return Promise.resolve();
    this.pendingWrite = this.timelines.flush().then(() => {
      this.needsFlush = false; this.error.set(''); this.updated.emit();
    }).catch(e => { this.error.set(e instanceof Error ? e.message : 'Não foi possível salvar o movimento.'); throw e; }).finally(() => { this.pendingWrite = null; });
    return this.pendingWrite;
  }
}
