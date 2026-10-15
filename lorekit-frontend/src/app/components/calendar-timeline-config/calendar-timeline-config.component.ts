import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarDatePickerComponent } from '../calendar-date-picker/calendar-date-picker.component';
import { CalendarBinding, CalendarDate } from '../../models/calendar.model';
import { CalendarService } from '../../services/calendar.service';
import { CalendarConversionItem, CalendarConversionPlan, CalendarTimelineService } from '../../services/calendar-timeline.service';
import { ConfirmService } from '../confirm-dialog/confirm-dialog.component';

@Component({ selector: 'app-calendar-timeline-config', imports: [FormsModule, CalendarDatePickerComponent], templateUrl: './calendar-timeline-config.component.html', styleUrls: ['../calendar-controls.css', './calendar-timeline-config.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarTimelineConfigComponent {
  readonly timelineId = input.required<string>(); readonly changed = output<void>(); readonly cancelled = output<void>();
  readonly calendars = inject(CalendarService); readonly timelines = inject(CalendarTimelineService); private readonly confirm = inject(ConfirmService);
  readonly calendarId = signal(''); readonly revisionId = signal(''); readonly countId = signal(''); readonly formatId = signal('');
  readonly step = signal(0); readonly plan = signal<CalendarConversionPlan | null>(null); readonly referenceDate = signal<CalendarDate | null>(null);
  readonly unit = signal<'year' | 'day'>('year'); readonly position = signal(0); readonly error = signal(''); readonly saving = signal(false);
  readonly labels = ['Calendário', 'Correspondência das datas', 'Eras existentes', 'Revisão final'];
  readonly timeline = computed(() => this.timelines.timeline(this.timelineId()));
  readonly worldId = computed(() => this.timeline().ParentWorld?.id ?? '');
  readonly choices = computed(() => this.calendars.list(this.worldId()));
  readonly revisions = computed(() => this.calendars.revisions(this.calendarId()));
  readonly binding = computed<CalendarBinding | null>(() => this.calendarId() && this.revisionId() ? { calendarId: this.calendarId(), revisionId: this.revisionId(), ...(this.countId() ? { countId: this.countId() } : {}), ...(this.formatId() ? { formatId: this.formatId() } : {}) } : null);
  readonly rules = computed(() => { try { return this.binding() ? this.calendars.resolve(this.binding()!, this.worldId()).engine.rules : null; } catch { return null; } });
  constructor() {
    effect(() => { const timeline = this.timeline(); untracked(() => {
      this.calendarId.set(timeline.calendarId ?? ''); this.revisionId.set(timeline.calendarRevisionId ?? ''); this.countId.set(timeline.calendarCountId ?? ''); this.formatId.set(timeline.calendarFormatId ?? '');
      if (this.binding()) this.resetReference();
    }); });
  }
  selectCalendar(id: string): void { this.calendarId.set(id); this.revisionId.set(this.calendars.get(id)?.latestRevisionId ?? ''); this.countId.set(''); this.formatId.set(''); this.resetReference(); this.plan.set(null); }
  selectRevision(id: string): void { this.revisionId.set(id); this.countId.set(''); this.formatId.set(''); this.resetReference(); this.plan.set(null); }
  presentation(key: 'countId' | 'formatId', value: string): void {
    (key === 'countId' ? this.countId : this.formatId).set(value);
    this.plan.update(plan => plan ? { ...plan, binding: { ...plan.binding, [key]: value || undefined } } : null);
  }
  resetReference(): void { const binding = this.binding(); this.referenceDate.set(binding ? { version: 1, calendarId: binding.calendarId, revisionId: binding.revisionId, precision: 'day', year: 0, ...(this.rules()?.months.length ? { monthId: this.rules()!.months[0].id } : {}), day: 1 } : null); }
  readonly previousStep = (value: number): number => Math.max(0, value - 1);
  next(): void {
    this.error.set('');
    try {
      if (!this.binding() || !this.worldId()) throw new Error('Escolha um calendário do mundo da linha do tempo.');
      if (this.step() === 0) { this.step.set(1); return; }
      if (this.step() === 1) {
        if (!this.referenceDate()) throw new Error('Defina a data de referência.');
        const plan = this.plan() ?? this.timelines.plan(this.timelineId(), this.binding()!, this.unit(), this.position(), this.referenceDate()!);
        this.plan.set(plan);
        for (const item of plan.items) this.timelines.validateItem(item, plan);
        this.step.set(2); return;
      }
      if (this.step() === 2) { const plan = this.plan()!; for (const item of plan.items) this.timelines.validateItem(item, plan); this.step.set(3); }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Revise as datas antes de continuar.'); }
  }
  generate(): void {
    try { if (!this.binding() || !this.referenceDate()) throw new Error('Defina calendário e referência.'); this.plan.set(this.timelines.plan(this.timelineId(), this.binding()!, this.unit(), this.position(), this.referenceDate()!)); this.error.set(''); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível gerar prévia.'); }
  }
  change(item: CalendarConversionItem, side: 'start' | 'end', date: CalendarDate | null): void {
    item[side] = date;
    try { this.timelines.validateItem(item, this.plan()!); } catch (e) { item.error = e instanceof Error ? e.message : 'Data inválida.'; }
  }
  text(date: CalendarDate | null): string { try { return date ? this.calendars.resolve(date).engine.format(date, this.formatId(), this.countId() || undefined) : 'Associação necessária'; } catch { return 'Data precisa de revisão'; } }
  async apply(): Promise<void> {
    const plan = this.plan(); if (!plan || this.saving()) return;
    this.saving.set(true); this.error.set('');
    try { await this.timelines.commit(plan); this.changed.emit(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { this.saving.set(false); }
  }
  async detach(): Promise<void> {
    if (!await this.confirm.ask('Voltar à cronologia livre? As datas serão preservadas para consulta e as contagens compartilhadas permanecerão no calendário.')) return;
    this.saving.set(true);
    try { await this.timelines.detach(this.timelineId()); this.changed.emit(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível remover o vínculo.'); }
    finally { this.saving.set(false); }
  }
}
