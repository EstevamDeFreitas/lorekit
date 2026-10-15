import { Injectable, inject } from '@angular/core';
import { DbProvider } from '../database/db-provider.service';
import { CalendarBinding, CalendarDate, CalendarRevision, CalendarRules, WorldCalendar } from '../models/calendar.model';
import { CalendarEngine, calendarStructuralKey, normalizeCalendarRules, parseCalendarRules } from '../utils/calendar-engine';

interface CalendarSaveResult { calendar: WorldCalendar; revision: CalendarRevision; published: boolean; }
export interface CalendarUse { table: string; id: string; label: string; revisionId?: string; }
function containsReference(value: unknown, calendarId: string, revisionId?: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(v => containsReference(v, calendarId, revisionId));
  const record = value as Record<string, unknown>;
  if (record['calendarId'] === calendarId && (!revisionId || record['revisionId'] === revisionId)) return true;
  return Object.values(record).some(v => containsReference(v, calendarId, revisionId));
}
function readJson(value: unknown): unknown { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return null; } }

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly provider = inject(DbProvider);
  private pendingDatabase: unknown;
  private readonly pendingSaves = new Map<string, CalendarSaveResult>();
  private get crud() { return this.provider.getCrudHelper(); }
  worldsForEntity(table: string, id: string): string[] {
    const found = new Set<string>(), seen = new Set<string>(), queue = [{ table, id }];
    while (queue.length) {
      const current = queue.shift()!; const key = current.table + ':' + current.id;
      if (seen.has(key)) continue; seen.add(key);
      if (current.table === 'World') { if (this.crud.findById('World', current.id)) found.add(current.id); continue; }
      for (const relation of this.crud.findAll('Relationship', { entityTable: current.table, entityId: current.id })) queue.push({ table: relation.parentTable, id: relation.parentId });
    }
    return [...found];
  }
  list(worldId?: string | null): WorldCalendar[] { return worldId ? this.crud.findAll('Calendar', { worldId }) : []; }
  get(id: string): WorldCalendar | null { return this.crud.findById('Calendar', id) ?? null; }
  revisions(calendarId: string): CalendarRevision[] { return this.crud.findAll('CalendarRevision', { calendarId }).sort((a: CalendarRevision, b: CalendarRevision) => b.revision - a.revision || a.id.localeCompare(b.id)); }
  revision(id: string): CalendarRevision | null { return this.crud.findById('CalendarRevision', id) ?? null; }
  resolve(binding: CalendarBinding, worldId?: string): { calendar: WorldCalendar; revision: CalendarRevision; engine: CalendarEngine } {
    const calendar = this.get(binding.calendarId), revision = this.revision(binding.revisionId);
    if (!calendar || !revision || revision.calendarId !== calendar.id) throw new Error('Calendário ou revisão indisponível. O valor foi preservado.');
    if (worldId && calendar.worldId !== worldId) throw new Error('Este calendário pertence a outro mundo.');
    const engine = new CalendarEngine(parseCalendarRules(revision.rulesJson));
    if (binding.countId) engine.count(binding.countId);
    if (binding.formatId && !engine.rules.formats.some(f => f.id === binding.formatId)) throw new Error('Formato de calendário indisponível.');
    return { calendar, revision, engine };
  }
  validateDate(date: CalendarDate, worldId?: string): CalendarEngine {
    const { engine } = this.resolve(date, worldId); engine.bounds(date); return engine;
  }
  uses(calendarId: string, revisionId?: string): CalendarUse[] {
    const uses: CalendarUse[] = [];
    for (const timeline of this.crud.findAll('Timeline', { calendarId })) {
      if (!revisionId || timeline.calendarRevisionId === revisionId) uses.push({ table: 'Timeline', id: timeline.id, label: timeline.name, revisionId: timeline.calendarRevisionId });
    }
    // Historical dates remain dependencies even after a timeline returns to free chronology.
    for (const table of ['Event', 'GreatMark', 'Age']) for (const item of this.crud.findAll(table)) {
      if ([item.calendarStartJson, item.calendarEndJson].some(v => containsReference(readJson(v), calendarId, revisionId))) uses.push({ table, id: item.id, label: item.name });
    }
    for (const field of this.crud.findAll('DynamicField')) if (containsReference(readJson(field.options), calendarId, revisionId)) uses.push({ table: 'DynamicField', id: field.id, label: field.name });
    for (const value of this.crud.findAll('DynamicFieldValue')) if (containsReference(readJson(value.value), calendarId, revisionId)) uses.push({ table: 'DynamicFieldValue', id: value.id, label: 'Data de entidade' });
    return uses;
  }
  async save(calendar: WorldCalendar, draft: CalendarRules, revisionId?: string): Promise<CalendarSaveResult> {
    if (!calendar.worldId || !this.crud.findById('World', calendar.worldId)) throw new Error('Selecione um mundo existente.');
    if (!calendar.name.trim()) throw new Error('Informe o nome do calendário.');
    const rules = normalizeCalendarRules(draft);
    const database = this.provider.getDb();
    if (this.pendingDatabase !== database) { this.pendingSaves.clear(); this.pendingDatabase = database; }
    const saveKey = JSON.stringify({ calendar, rules, revisionId });
    const pending = this.pendingSaves.get(saveKey);
    if (pending) { await this.provider.flushPendingWrites(); this.pendingSaves.delete(saveKey); return pending; }
    const existing = calendar.id ? this.get(calendar.id) : null;
    if (existing && existing.worldId !== calendar.worldId) throw new Error('Não é possível mover um calendário utilizado para outro mundo.');
    const previous = revisionId ? this.revision(revisionId) : existing ? this.revision(existing.latestRevisionId) : null;
    if (previous && previous.calendarId !== calendar.id) throw new Error('Revisão incompatível com o calendário.');
    const published = !previous || calendarStructuralKey(parseCalendarRules(previous.rulesJson)) !== calendarStructuralKey(rules);
    const id = existing?.id ?? crypto.randomUUID();
    const revision: CalendarRevision = { id: published ? crypto.randomUUID() : previous!.id, calendarId: id, revision: published ? Math.max(0, ...this.revisions(id).map(r => r.revision)) + 1 : previous!.revision, rulesJson: JSON.stringify(rules) };
    const saved = { ...calendar, id, name: calendar.name.trim(), latestRevisionId: published ? revision.id : existing?.latestRevisionId ?? revision.id };
    await this.provider.runInTransaction(async () => {
      if (published) this.crud.create('CalendarRevision', revision); else this.crud.update('CalendarRevision', revision.id, revision);
      if (existing) this.crud.update('Calendar', id, saved);
      else {
        this.crud.create('Calendar', saved);
        this.crud.create('Relationship', { parentTable: 'World', parentId: saved.worldId, entityTable: 'Calendar', entityId: id });
      }
    });
    const result = { calendar: saved, revision, published };
    this.pendingSaves.set(saveKey, result);
    await this.provider.flushPendingWrites();
    this.pendingSaves.delete(saveKey);
    return result;
  }
  async delete(calendarId: string): Promise<void> {
    const uses = this.uses(calendarId);
    if (uses.length) throw new Error('Calendário utilizado por: ' + uses.map(u => u.label).join(', ') + '. Resolva os vínculos antes de excluir.');
    await this.provider.runInTransaction(async () => {
      this.crud.deleteWhen('CalendarRevision', { calendarId });
      this.crud.delete('Calendar', calendarId, false);
    });
    await this.provider.flushPendingWrites();
  }
  async deleteRevision(id: string): Promise<void> {
    const revision = this.revision(id);
    if (!revision) return;
    if (this.get(revision.calendarId)?.latestRevisionId === id || this.uses(revision.calendarId, id).length) throw new Error('A revisão está em uso e deve ser preservada.');
    this.crud.delete('CalendarRevision', id, false);
    await this.provider.flushPendingWrites();
  }
}
