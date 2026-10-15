import { CalendarBinding, CalendarDateFieldOptions } from '../models/calendar.model';

export function defaultCalendarFieldOptions(): CalendarDateFieldOptions { return { version: 1, kind: 'calendar-date', mode: 'selectable', allowTime: false, bindings: {} }; }
export function parseCalendarFieldOptions(serialized?: string | null): CalendarDateFieldOptions {
  if (!serialized) return defaultCalendarFieldOptions();
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração de data inválida.');
  const r = value as Record<string, unknown>;
  if (r['version'] !== 1 || r['kind'] !== 'calendar-date' || !['fixed', 'selectable'].includes(String(r['mode'])) || typeof r['allowTime'] !== 'boolean' || !r['bindings'] || typeof r['bindings'] !== 'object' || Array.isArray(r['bindings'])) throw new Error('Configuração de data inválida.');
  const bindings: Record<string, CalendarBinding> = {};
  for (const [worldId, binding] of Object.entries(r['bindings'] as Record<string, unknown>)) {
    if (!worldId || !binding || typeof binding !== 'object') throw new Error('Associação de calendário inválida.');
    const b = binding as Record<string, unknown>;
    if (typeof b['calendarId'] !== 'string' || !b['calendarId'] || typeof b['revisionId'] !== 'string' || !b['revisionId'] || (b['countId'] !== undefined && typeof b['countId'] !== 'string') || (b['formatId'] !== undefined && typeof b['formatId'] !== 'string')) throw new Error('Associação de calendário inválida.');
    bindings[worldId] = { calendarId: b['calendarId'], revisionId: b['revisionId'], ...(b['countId'] ? { countId: String(b['countId']) } : {}), ...(b['formatId'] ? { formatId: String(b['formatId']) } : {}) };
  }
  return { version: 1, kind: 'calendar-date', mode: r['mode'] as 'fixed' | 'selectable', allowTime: r['allowTime'], bindings, ...(typeof r['formatId'] === 'string' ? { formatId: r['formatId'] } : {}) };
}
