import { Injectable, inject } from '@angular/core';
import { DbProvider } from '../database/db-provider.service';
import { CalendarBinding, CalendarDate } from '../models/calendar.model';
import { DynamicField } from '../models/dynamicfields.model';
import { parseCalendarDate } from '../utils/calendar-engine';
import { parseCalendarFieldOptions } from '../utils/calendar-field-options';
import { CalendarService } from './calendar.service';

export interface CalendarFieldImpactItem { id: string; original: string; date: CalendarDate | null; worldId: string; worldIds: string[]; error: string; clearConfirmed: boolean; }
export interface CalendarFieldChangePlan { field: DynamicField; sourceJson: string; items: CalendarFieldImpactItem[]; }

@Injectable({ providedIn: 'root' })
export class CalendarFieldService {
  private readonly provider = inject(DbProvider);
  private readonly calendars = inject(CalendarService);
  private get crud() { return this.provider.getCrudHelper(); }
  requiresReview(field: DynamicField): boolean {
    const previous = this.crud.findById('DynamicField', field.id) as DynamicField | undefined;
    return previous?.fieldType === 'calendar-date' && previous.options !== field.options;
  }
  plan(field: DynamicField): CalendarFieldChangePlan {
    const previous = this.crud.findById('DynamicField', field.id);
    const config = parseCalendarFieldOptions(field.options);
    for (const [worldId, binding] of Object.entries(config.bindings)) this.calendars.resolve(binding, worldId);
    const values = this.crud.findAll('DynamicFieldValue', {}, [], { parentTable: 'DynamicField', parentId: field.id }) as Array<{ id: string; value: string }>;
    const items = values.filter(v => !!v.value).map(value => {
      const worldIds = this.calendars.worldsForEntity('DynamicFieldValue', value.id);
      let date: CalendarDate | null = null, error = '';
      try { date = parseCalendarDate(value.value); } catch (e) { error = e instanceof Error ? e.message : 'Data inválida.'; }
      const item = { id: value.id, original: value.value, date, worldId: worldIds.length === 1 ? worldIds[0] : '', worldIds, error, clearConfirmed: false };
      try { this.validate(item, field); } catch (e) { item.error = e instanceof Error ? e.message : 'Revisão necessária.'; }
      return item;
    });
    return { field: { ...field }, sourceJson: JSON.stringify(previous), items };
  }
  binding(item: CalendarFieldImpactItem, field: DynamicField): CalendarBinding | null {
    const config = parseCalendarFieldOptions(field.options);
    return config.mode === 'fixed' ? config.bindings[item.worldId] ?? null : item.date ? { calendarId: item.date.calendarId, revisionId: item.date.revisionId, countId: item.date.countId } : null;
  }
  validate(item: CalendarFieldImpactItem, field: DynamicField): void {
    if (!item.worldId || !item.worldIds.includes(item.worldId)) throw new Error('Selecione o mundo desta data.');
    if (!item.date) { if (!item.clearConfirmed) throw new Error('Informe uma data válida ou confirme sua limpeza. O valor original foi preservado.'); item.error = ''; return; }
    const config = parseCalendarFieldOptions(field.options), binding = this.binding(item, field);
    if (!binding) throw new Error('Associe um calendário a este mundo.');
    if (item.date.calendarId !== binding.calendarId || item.date.revisionId !== binding.revisionId) throw new Error('Associe a data explicitamente ao novo calendário ou revisão.');
    if (!config.allowTime && item.date.time) throw new Error('Revise esta data para remover o horário ou mantenha a permissão.');
    this.calendars.validateDate(item.date, item.worldId); item.error = '';
  }
  async commit(plan: CalendarFieldChangePlan): Promise<void> {
    const previous = this.crud.findById('DynamicField', plan.field.id);
    if (JSON.stringify(previous) !== plan.sourceJson) throw new Error('A definição mudou desde a prévia. Refaça a revisão.');
    const current = this.crud.findAll('DynamicFieldValue', {}, [], { parentTable: 'DynamicField', parentId: plan.field.id }) as Array<{ id: string; value: string }>;
    const ids = current.filter(v => !!v.value).map(v => v.id).sort();
    if (JSON.stringify(ids) !== JSON.stringify(plan.items.map(i => i.id).sort())) throw new Error('Os valores mudaram desde a prévia. Refaça a revisão.');
    for (const item of plan.items) {
      if (current.find(v => v.id === item.id)?.value !== item.original) throw new Error('Uma data mudou desde a prévia.');
      this.validate(item, plan.field);
    }
    await this.provider.runInTransaction(async () => {
      this.crud.update('DynamicField', plan.field.id, plan.field);
      for (const item of plan.items) this.crud.update('DynamicFieldValue', item.id, { value: item.date ? JSON.stringify(item.date) : '' });
    });
    await this.provider.flushPendingWrites();
  }
}
