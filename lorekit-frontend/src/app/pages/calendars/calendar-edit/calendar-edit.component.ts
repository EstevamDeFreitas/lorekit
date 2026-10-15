import { CalendarFormatPartComponent } from '../../../components/calendar-format-part/calendar-format-part.component';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NavButtonComponent } from '../../../components/nav-button/nav-button.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CalendarDatePickerComponent } from '../../../components/calendar-date-picker/calendar-date-picker.component';
import { CalendarBinding, CalendarDate, CalendarFormatPart, CalendarMonth, CalendarRules, CalendarSeason, CalendarWeekDay, CalendarYearCount, WorldCalendar } from '../../../models/calendar.model';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEngine, calendarStructuralKey, defaultCalendarRules, normalizeCalendarRules, parseCalendarRules, terrestrialHoursToSeconds } from '../../../utils/calendar-engine';
import { WORKSPACE_TAB_CONTEXT } from '../../../models/workspace-tab-context';
import { DISCARD_PENDING_SAVES_EVENT, FLUSH_PENDING_SAVES_EVENT, PendingSaveEventDetail, pendingSaveEventMatchesTab } from '../../../utils/pending-save-event';
import { TabManagerService } from '../../../services/tab-manager.service';

@Component({ selector: 'app-calendar-edit', imports: [FormsModule, CalendarDatePickerComponent, NavButtonComponent, CalendarFormatPartComponent], templateUrl: './calendar-edit.component.html', styleUrls: ['../../../components/calendar-controls.css', './calendar-edit.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarEditComponent {
  private readonly service = inject(CalendarService);
  private readonly route = inject(ActivatedRoute);
  private readonly context = inject(WORKSPACE_TAB_CONTEXT, { optional: true });
  private readonly tabs = inject(TabManagerService);
  readonly calendarIdInput = input('');
  readonly sections = ['Estrutura', 'Semana', 'Tempo', 'Contagem dos anos', 'Estações', 'Formatos'];
  readonly section = signal('Estrutura');
  readonly calendar = signal<WorldCalendar | null>(null);
  readonly draft = signal(defaultCalendarRules());
  readonly revisionId = signal('');
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly status = signal('');
  readonly durationInput = signal<string | null>(null);
  readonly durationError = signal('');
  readonly sample = signal<CalendarDate | null>(null);
  readonly sampleMonth = signal('');
  readonly seasonSides = [{ key: 'start' as const, label: 'Início' }, { key: 'end' as const, label: 'Fim' }];
  readonly formatVariants = [{ key: 'year' as const, label: 'Somente ano' }, { key: 'month' as const, label: 'Mês e ano' }, { key: 'day' as const, label: 'Dia completo' }, { key: 'time' as const, label: 'Horário (acrescentado à data)' }];
  serviceRevisionLabel(): number { return this.service.revision(this.revisionId())?.revision ?? 1; }
  monthError(month: CalendarMonth): string { return !month.name.trim() ? 'Informe o nome deste mês.' : !Number.isSafeInteger(month.days) || month.days < 1 ? 'Informe uma quantidade inteira positiva de dias.' : ''; }
  readonly terrestrialEquivalence = computed(() => {
    const clock = this.draft().clock;
    if (!clock.dayDurationTerrestrialSeconds || !Number.isSafeInteger(clock.hoursPerDay) || clock.hoursPerDay < 1) return '';
    const minutes = Number(clock.dayDurationTerrestrialSeconds) / 60 / clock.hoursPerDay;
    return 'Cada ' + clock.hourName + ' local equivale a ' + minutes.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) + ' minutos terrestres.';
  });
  previewMonthDays(): number { return (this.draft().months.find(m => m.id === this.sampleMonth()) ?? this.draft().months[0])?.days ?? 0; }
  readonly preview = computed(() => {
    try { return { engine: new CalendarEngine(normalizeCalendarRules(this.draft())), error: '' }; }
    catch (e) { return { engine: null, error: e instanceof Error ? e.message : 'Configuração inválida.' }; }
  });
  readonly binding = computed<CalendarBinding | null>(() => this.calendar() ? { calendarId: this.calendar()!.id, revisionId: this.revisionId() } : null);
  readonly publication = computed(() => {
    const previous = this.service.revision(this.revisionId());
    return previous && calendarStructuralKey(parseCalendarRules(previous.rulesJson)) !== calendarStructuralKey(this.draft());
  });
  readonly days = computed(() => {
    const engine = this.preview().engine;
    if (!engine) return [];
    const month = this.draft().months.find(m => m.id === this.sampleMonth()) ?? this.draft().months[0];
    const length = month?.days ?? engine.daysPerYear;
    const anchor = engine.weekday({ year: 0, monthId: month?.id, day: 1 }) ?? 0;
    return Array.from({ length: Math.min(length, 120) + anchor }, (_, i) => i < anchor ? null : i - anchor + 1);
  });
  constructor() {
    effect(() => {
      const id = this.calendarIdInput() || this.route.snapshot.paramMap.get('calendarId') || '';
      if (id) untracked(() => this.load(id));
    });
    const flush = (event: Event): void => {
      const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
      if (!pendingSaveEventMatchesTab(detail, this.context?.tabId) || !this.dirty()) return;
      this.error.set('Salve ou descarte as alterações do calendário antes de sair.');
      detail?.flushes.push(Promise.reject(new Error('Calendário com alterações não salvas.')));
    };
    const discard = (): void => { const c = this.calendar(); if (c) this.load(c.id); };
    const unload = (event: BeforeUnloadEvent): void => { if (this.dirty()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, flush); window.addEventListener(DISCARD_PENDING_SAVES_EVENT, discard); window.addEventListener('beforeunload', unload);
    inject(DestroyRef).onDestroy(() => { window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, flush); window.removeEventListener(DISCARD_PENDING_SAVES_EVENT, discard); window.removeEventListener('beforeunload', unload); });
  }
  load(id: string): void {
    const calendar = this.service.get(id);
    if (!calendar) { this.error.set('Calendário indisponível.'); return; }
    try {
      const revision = this.service.revision(calendar.latestRevisionId);
      if (!revision) throw new Error('Revisão indisponível.');
      this.calendar.set(calendar); this.revisionId.set(revision.id); this.draft.set(parseCalendarRules(revision.rulesJson)); this.dirty.set(false); this.error.set(''); this.sampleMonth.set(this.draft().months[0]?.id ?? '');
      this.sample.set({ version: 1, calendarId: calendar.id, revisionId: revision.id, precision: 'day', year: 0, ...(this.draft().months.length ? { monthId: this.draft().months[0].id } : {}), day: 1 });
      this.markDirty(false); this.durationInput.set(null); this.durationError.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível abrir o calendário.'); }
  }
  private markDirty(value: boolean): void { if (this.context) this.tabs.markDirty(this.context.tabId, value); }
  edit(operation: (rules: CalendarRules) => void): void {
    const next = structuredClone(this.draft()); operation(next); this.draft.set(next); this.dirty.set(true); this.markDirty(true); this.status.set('');
  }
  editDuration(value: string): void { this.durationInput.set(value); this.dirty.set(true); this.markDirty(true); this.status.set(''); }
  metadata(key: 'name' | 'description', value: string): void { this.calendar.update(c => c ? { ...c, [key]: value } : null); this.dirty.set(true); this.markDirty(true); }
  month(index: number, key: keyof CalendarMonth, value: string | number): void { this.edit(r => { Object.assign(r.months[index], { [key]: value }); }); }
  weekday(index: number, key: keyof CalendarWeekDay, value: string): void { this.edit(r => { Object.assign(r.week.days[index], { [key]: value }); }); }
  clock(key: keyof CalendarRules['clock'], value: string | number | undefined): void { this.edit(r => { Object.assign(r.clock, { [key]: value }); }); }
  week(key: 'enabled' | 'mode' | 'anchor', value: boolean | string | number): void { this.edit(r => { Object.assign(r.week, { [key]: value }); }); }
  annualDays(value: number): void { this.edit(r => { r.daysPerYear = value; }); }
  addMonth(): void { this.edit(r => r.months.push({ id: crypto.randomUUID(), name: 'Mês ' + (r.months.length + 1), abbreviation: 'M' + (r.months.length + 1), days: 30 })); }
  removeMonth(index: number): void { this.edit(r => r.months.splice(index, 1)); }
  monthless(enabled: boolean): void {
    this.edit(r => {
      if (enabled && r.months.length) {
        const engine = new CalendarEngine(r); r.daysPerYear = engine.daysPerYear;
        for (const count of r.counts) { const day = engine.toOrdinal({ ...count.reference, year: 0 }) + 1; count.reference = { year: count.reference.year, day }; }
        for (const season of r.seasons) { season.start = { day: engine.toOrdinal({ year: 0, ...season.start }) + 1 }; season.end = { day: engine.toOrdinal({ year: 0, ...season.end }) + 1 }; }
        r.months = [];
      } else if (!enabled && !r.months.length) {
        r.months = [{ id: crypto.randomUUID(), name: 'Primeiro mês', abbreviation: 'M1', days: r.daysPerYear }];
        for (const count of r.counts) count.reference.monthId = r.months[0].id;
        for (const season of r.seasons) { season.start.monthId = r.months[0].id; season.end.monthId = r.months[0].id; }
      }
    });
  }
  move(kind: 'month' | 'week', index: number, delta: number): void {
    this.edit(r => { const list = kind === 'month' ? r.months : r.week.days; const next = index + delta; if (next < 0 || next >= list.length) return; [list[index], list[next]] = [list[next], list[index]]; });
  }
  addWeekday(): void { this.edit(r => r.week.days.push({ id: crypto.randomUUID(), name: 'Dia ' + (r.week.days.length + 1), abbreviation: 'D' + (r.week.days.length + 1) })); }
  removeWeekday(index: number): void { this.edit(r => { r.week.days.splice(index, 1); }); }
  terrestrial(value: string, unit: string): void {
    try { this.clock('dayDurationTerrestrialSeconds', value.trim() ? unit === 'hours' ? terrestrialHoursToSeconds(value) : value : undefined); this.error.set(''); this.durationInput.set(null); this.durationError.set(''); }
    catch (e) { const error = e instanceof Error ? e.message : 'Duração inválida.'; this.error.set(error); this.durationError.set(error); }
  }
  addCount(): void { this.edit(r => r.counts.push({ id: crypto.randomUUID(), name: 'Nova referência', description: '', reference: { year: 0, ...(r.months.length ? { monthId: r.months[0].id } : {}), day: 1 }, beforeName: 'antes do marco', beforeAbbreviation: 'AM', afterName: 'após o marco', afterAbbreviation: 'PM', firstYear: 1 })); }
  count(index: number, key: keyof CalendarYearCount, value: unknown): void { this.edit(r => { Object.assign(r.counts[index], { [key]: value }); }); }
  reference(index: number, key: 'year' | 'monthId' | 'day', value: number | string): void { this.edit(r => { Object.assign(r.counts[index].reference, { [key]: value }); }); }
  removeCount(index: number): void { this.edit(r => r.counts.splice(index, 1)); }
  addSeason(): void { this.edit(r => r.seasons.push({ id: crypto.randomUUID(), name: 'Nova estação', color: '#60a5fa', start: { ...(r.months.length ? { monthId: r.months[0].id } : {}), day: 1 }, end: { ...(r.months.length ? { monthId: r.months[0].id } : {}), day: 10 } })); }
  season(index: number, key: keyof CalendarSeason, value: unknown): void { this.edit(r => { Object.assign(r.seasons[index], { [key]: value }); }); }
  seasonPoint(index: number, side: 'start' | 'end', key: 'monthId' | 'day', value: string | number): void { this.edit(r => { Object.assign(r.seasons[index][side], { [key]: value }); }); }
  removeSeason(index: number): void { this.edit(r => r.seasons.splice(index, 1)); }
  formatName(index: number, value: string): void { this.edit(r => { r.formats[index].name = value; }); }
  formatPart(index: number, variant: 'year' | 'month' | 'day' | 'time', partIndex: number, value: CalendarFormatPart): void { this.edit(r => { r.formats[index][variant][partIndex] = value; }); }
  addPart(index: number, variant: 'year' | 'month' | 'day' | 'time', token: boolean): void { this.edit(r => r.formats[index][variant].push(token ? { token: 'year' } : { literal: ' ' })); }
  movePart(index: number, variant: 'year' | 'month' | 'day' | 'time', partIndex: number, delta: number): void {
    this.edit(r => { const parts = r.formats[index][variant], next = partIndex + delta; if (next < 0 || next >= parts.length) return; [parts[partIndex], parts[next]] = [parts[next], parts[partIndex]]; });
  }
  addConditionalPart(index: number, variant: 'year' | 'month' | 'day' | 'time'): void {
    this.edit(r => r.formats[index][variant].push({ conditional: { mode: 'all', conditions: [{ field: 'day', operator: 'lt', value: 13 }], whenTrue: 'Dia de luz', whenFalse: 'Dia da noite', whenUnknown: '' } }));
  }
  removePart(index: number, variant: 'year' | 'month' | 'day' | 'time', partIndex: number): void { this.edit(r => r.formats[index][variant].splice(partIndex, 1)); }
  addFormat(): void { this.edit(r => r.formats.push({ ...structuredClone(r.formats[0]), id: crypto.randomUUID(), name: 'Novo formato' })); }
  sampleText(formatId: string): string { try { return this.sample() && this.preview().engine ? this.preview().engine!.format(this.sample()!, formatId) : 'Escolha uma data de exemplo.'; } catch { return 'Ajuste a data de exemplo para estas regras.'; } }
  async save(): Promise<void> {
    const calendar = this.calendar(); if (!calendar || this.saving()) return;
    if (this.durationInput() !== null || this.durationError()) { this.error.set('Aplique ou corrija a duração do dia antes de salvar.'); return; }
    this.saving.set(true); this.error.set('');
    try {
      const saved = await this.service.save(calendar, this.draft(), this.revisionId());
      this.calendar.set(saved.calendar); this.revisionId.set(saved.revision.id); this.draft.set(parseCalendarRules(saved.revision.rulesJson));
      this.dirty.set(false); this.markDirty(false); this.status.set(saved.published ? 'Nova revisão salva. Vínculos existentes mantêm as regras anteriores até você revisá-los.' : 'Alterações salvas.');
      if (this.context) this.tabs.updateTabTitle(this.context.tabId, saved.calendar.name);
      this.sample.update(d => d ? { ...d, revisionId: saved.revision.id } : null);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { this.saving.set(false); }
  }
  discard(): void { const c = this.calendar(); if (c) this.load(c.id); }
}
