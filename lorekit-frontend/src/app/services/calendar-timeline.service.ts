import { Image } from '../models/image.model';
import { Personalization } from '../models/personalization.model';
import { Injectable, inject } from '@angular/core';
import { DbProvider } from '../database/db-provider.service';
import { CalendarBinding, CalendarDate, CalendarRules } from '../models/calendar.model';
import { CalendarEngine, parseCalendarDate, parseCalendarRules } from '../utils/calendar-engine';
import { Timeline } from '../models/timeline.model';
import { CalendarService } from './calendar.service';

export type CalendarTemporalTable = 'Event' | 'GreatMark' | 'Age';
export interface CalendarTemporalRecord {
  id: string; name: string; description: string; startDate: number; endDate: number;
  lane?: number; Images?: Image[]; Personalization?: Personalization | null;
  calendarStartJson?: string | null; calendarEndJson?: string | null; calendarConvertedCountId?: string | null;
}
export interface CalendarConversionItem {
  table: CalendarTemporalTable; source: CalendarTemporalRecord;
  start: CalendarDate | null; end: CalendarDate | null; error: string; convertAge: boolean;
  beforeName: string; beforeAbbreviation: string; afterName: string; afterAbbreviation: string; firstYear: 0 | 1;
}
export interface CalendarConversionPlan {
  id: string; timelineId: string; worldId: string; binding: CalendarBinding;
  signature: string; targetRulesJson: string; items: CalendarConversionItem[];
  unit: 'year' | 'day'; referencePosition: number; referenceDate: CalendarDate;
}
export interface CalendarProjection {
  version: 1; lastPlanId: string; unit: 'year' | 'day'; referencePosition: number;
  referenceOrdinal: number; daysPerYear: number; snapshot: unknown;
}

@Injectable({ providedIn: 'root' })
export class CalendarTimelineService {
  private readonly provider = inject(DbProvider);
  private readonly calendars = inject(CalendarService);
  private get crud() { return this.provider.getCrudHelper(); }
  flush(): Promise<void> { return this.provider.flushPendingWrites(); }
  timeline(id: string): Timeline {
    const value = this.crud.findById('Timeline', id, [{ table: 'World', firstOnly: true, isParent: true }]) as Timeline;
    if (!value) throw new Error('Linha do tempo indisponível.');
    return value;
  }
  records(id: string, includeAppearance = false): Array<{ table: CalendarTemporalTable; source: CalendarTemporalRecord }> {
    return (['Event', 'GreatMark', 'Age'] as const).flatMap(table => (this.crud.findAll(table, {}, includeAppearance ? [{ table: 'Image', firstOnly: false }, { table: 'Personalization', firstOnly: true }] : [], { parentTable: 'Timeline', parentId: id }) as CalendarTemporalRecord[]).map(source => ({ table, source }))).sort((a, b) => a.table.localeCompare(b.table) || a.source.id.localeCompare(b.source.id));
  }
  private signature(id: string): string { return JSON.stringify({ timeline: this.timeline(id), items: this.records(id), relationships: this.crud.findAll('Relationship', { parentTable: 'Timeline', parentId: id }).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)) }); }
  plan(timelineId: string, binding: CalendarBinding, unit: 'year' | 'day', referencePosition: number, referenceDate: CalendarDate): CalendarConversionPlan {
    const timeline = this.timeline(timelineId), worldId = timeline.ParentWorld?.id;
    if (!worldId) throw new Error('Associe a linha do tempo a um mundo antes de escolher calendário.');
    const { revision, engine } = this.calendars.resolve(binding, worldId);
    if (!Number.isFinite(referencePosition)) throw new Error('Informe uma posição de referência válida.');
    this.checkDate(referenceDate, binding, engine);
    const anchor = engine.bounds(referenceDate).start.day;
    const items = this.records(timelineId).map(({ table, source }): CalendarConversionItem => {
      let start: CalendarDate | null = null, end: CalendarDate | null = null, error = '';
      try {
        const convert = (position: number, old?: string | null): CalendarDate => {
          if (timeline.calendarId && old) {
            const date = parseCalendarDate(old)!;
            if (timeline.calendarId !== binding.calendarId) throw new Error('Associe esta data manualmente ao novo calendário.');
            const proposed = { ...date, ...binding, countId: date.countId && engine.rules.counts.some(c => c.id === date.countId) ? date.countId : binding.countId };
            this.checkDate(proposed, binding, engine); return proposed;
          }
          const delta = position - referencePosition;
          if (!Number.isSafeInteger(delta)) throw new Error('Posição fracionária ou fora da faixa: associe a data manualmente.');
          const day = anchor + delta * (unit === 'year' ? engine.daysPerYear : 1);
          const point = engine.fromOrdinal(day);
          const result: CalendarDate = unit === 'year'
            ? { version: 1, ...binding, precision: 'year', year: point.year }
            : { version: 1, ...binding, precision: 'day', ...point };
          if (binding.countId) result.side = engine.countedYear(point, binding.countId).side;
          this.checkDate(result, binding, engine); return result;
        };
        start = convert(source.startDate, source.calendarStartJson); end = convert(source.endDate, source.calendarEndJson);
        engine.validateRange(start, end);
      } catch (e) { error = e instanceof Error ? e.message : 'Data inválida.'; }
      return { table, source, start, end, error, convertAge: false, beforeName: 'antes de ' + source.name, beforeAbbreviation: 'A', afterName: source.name, afterAbbreviation: 'P', firstYear: 1 };
    });
    return { id: crypto.randomUUID(), timelineId, worldId, binding: { ...binding }, signature: this.signature(timelineId), targetRulesJson: revision.rulesJson, items, unit, referencePosition, referenceDate };
  }
  validateItem(item: CalendarConversionItem, plan: CalendarConversionPlan): void {
    const { engine } = this.calendars.resolve(plan.binding, plan.worldId);
    if (!item.start || !item.end) throw new Error(item.error || 'Defina as duas datas para este item.');
    this.checkDate(item.start, plan.binding, engine); this.checkDate(item.end, plan.binding, engine);
    engine.validateRange(item.start, item.end);
    if (item.convertAge) {
      if (item.table !== 'Age') throw new Error('Somente uma era pode originar contagem.');
      if (![item.beforeName, item.beforeAbbreviation, item.afterName, item.afterAbbreviation].every(s => s.trim())) throw new Error('Informe nomes e abreviações dos dois lados da contagem.');
    }
    item.error = '';
  }
  async commit(plan: CalendarConversionPlan): Promise<void> {
    const timeline = this.timeline(plan.timelineId);
    if (this.projection(timeline)?.lastPlanId === plan.id) { await this.provider.flushPendingWrites(); return; }
    if (this.signature(plan.timelineId) !== plan.signature) throw new Error('A linha do tempo mudou desde a prévia. Refaça a revisão.');
    const resolved = this.calendars.resolve(plan.binding, plan.worldId);
    if (resolved.revision.rulesJson !== plan.targetRulesJson) throw new Error('O calendário mudou desde a prévia. Refaça a revisão.');
    const expected = this.records(plan.timelineId).map(i => i.table + ':' + i.source.id).sort();
    const actual = plan.items.map(i => i.table + ':' + i.source.id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('O plano não contém todos os itens da linha do tempo.');
    plan.items.forEach(item => this.validateItem(item, plan));
    const rules: CalendarRules = parseCalendarRules(plan.targetRulesJson);
    const converted = plan.items.filter(i => i.table === 'Age' && i.convertAge);
    for (const item of converted) {
      const reference = resolved.engine.fromOrdinal(resolved.engine.bounds(item.start!).start.day);
      rules.counts.push({ id: plan.id + '-' + item.source.id, name: item.source.name, description: item.source.description, reference, beforeName: item.beforeName, beforeAbbreviation: item.beforeAbbreviation, afterName: item.afterName, afterAbbreviation: item.afterAbbreviation, firstYear: item.firstYear, sourceAgeId: item.source.id });
    }
    const engine = new CalendarEngine(rules); engine.validateRules();
    const revisionId = converted.length ? crypto.randomUUID() : plan.binding.revisionId;
    const projection: CalendarProjection = { version: 1, lastPlanId: plan.id, unit: plan.unit, referencePosition: plan.referencePosition, referenceOrdinal: engine.bounds(plan.referenceDate).start.day, daysPerYear: engine.daysPerYear, snapshot: { timeline, items: this.records(plan.timelineId) } };
    await this.provider.runInTransaction(async () => {
      if (converted.length) {
        this.crud.create('CalendarRevision', { id: revisionId, calendarId: plan.binding.calendarId, revision: Math.max(0, ...this.calendars.revisions(plan.binding.calendarId).map(r => r.revision)) + 1, rulesJson: JSON.stringify(rules) });
        this.crud.update('Calendar', plan.binding.calendarId, { latestRevisionId: revisionId });
      }
      for (const item of plan.items) {
        const start = { ...item.start!, revisionId }, end = { ...item.end!, revisionId };
        this.crud.update(item.table, item.source.id, { calendarStartJson: JSON.stringify(start), calendarEndJson: JSON.stringify(end), ...(item.convertAge ? { calendarConvertedCountId: plan.id + '-' + item.source.id } : {}) });
      }
      this.crud.update('Timeline', plan.timelineId, { calendarId: plan.binding.calendarId, calendarRevisionId: revisionId, calendarCountId: plan.binding.countId ?? null, calendarFormatId: plan.binding.formatId ?? null, calendarMappingJson: JSON.stringify(projection) });
    });
    await this.provider.flushPendingWrites();
  }
  projection(timeline: Timeline): CalendarProjection | null {
    if (!timeline.calendarMappingJson) return null;
    try { return JSON.parse(timeline.calendarMappingJson) as CalendarProjection; } catch { return null; }
  }
  project(date: CalendarDate, timeline: Timeline): number {
    const engine = this.calendars.validateDate(date, timeline.ParentWorld?.id), map = this.projection(timeline);
    const ordinal = engine.bounds(date).start.day;
    return map ? map.referencePosition + (ordinal - map.referenceOrdinal) / (map.unit === 'year' ? map.daysPerYear : 1) : ordinal;
  }
  async detach(timelineId: string): Promise<void> {
    const timeline = this.timeline(timelineId);
    await this.provider.runInTransaction(async () => {
      for (const { table, source } of this.records(timelineId)) {
        const start = parseCalendarDate(source.calendarStartJson), end = parseCalendarDate(source.calendarEndJson);
        if (start && end) {
          const startDate = this.project(start, timeline), endDate = this.project(end, timeline);
          this.crud.update(table, source.id, { startDate, endDate, ...(table === 'GreatMark' ? { date: (startDate + endDate) / 2 } : {}), calendarConvertedCountId: null });
        }
      }
      this.crud.update('Timeline', timelineId, { calendarId: null, calendarRevisionId: null, calendarCountId: null, calendarFormatId: null });
    });
    await this.provider.flushPendingWrites();
  }
  saveItemDates(table: CalendarTemporalTable, id: string, timelineId: string, start: CalendarDate, end: CalendarDate, lane?: number): void {
    const timeline = this.timeline(timelineId);
    if (!timeline.calendarId || !timeline.calendarRevisionId) throw new Error('Associe um calendário à linha do tempo.');
    const binding = { calendarId: timeline.calendarId, revisionId: timeline.calendarRevisionId };
    const { engine } = this.calendars.resolve(binding, timeline.ParentWorld?.id);
    this.checkDate(start, binding, engine); this.checkDate(end, binding, engine); engine.validateRange(start, end);
    this.crud.update(table, id, { ...(lane !== undefined && table !== 'Age' ? { lane: Math.max(0, Math.round(lane)) } : {}), calendarStartJson: JSON.stringify(start), calendarEndJson: JSON.stringify(end), startDate: this.project(start, timeline), endDate: this.project(end, timeline) });
  }
  prepareRecord(record: CalendarTemporalRecord, timelineId: string): void {
    const timeline = this.timeline(timelineId);
    if (!timeline.calendarId || !timeline.calendarRevisionId) return;
    const binding = { calendarId: timeline.calendarId, revisionId: timeline.calendarRevisionId };
    const engine = this.calendars.resolve(binding, timeline.ParentWorld?.id).engine;
    const start = parseCalendarDate(record.calendarStartJson, engine), end = parseCalendarDate(record.calendarEndJson, engine);
    if (!start || !end) throw new Error('Escolha as datas de início e fim e confirme Usar data.');
    this.checkDate(start, binding, engine); this.checkDate(end, binding, engine); engine.validateRange(start, end);
    record.startDate = this.project(start, timeline); record.endDate = this.project(end, timeline);
  }
  private checkDate(date: CalendarDate, binding: CalendarBinding, engine: CalendarEngine): void {
    if (date.calendarId !== binding.calendarId || date.revisionId !== binding.revisionId) throw new Error('A data deve utilizar o calendário e revisão selecionados.');
    engine.bounds(date);
  }
}
