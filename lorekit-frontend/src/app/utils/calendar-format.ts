import { CALENDAR_CONDITION_FIELDS, CALENDAR_CONDITION_OPERATORS, CALENDAR_TOKENS, CalendarConditionField, CalendarConditionalText, CalendarFormatPart } from '../models/calendar.model';

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function invalid(message: string): never { throw new Error(message); }
/** Declarative comparisons only: no scripts, expressions or executable templates. */
export function validateCalendarFormatPart(part: unknown): void {
  if (!object(part)) invalid('Componente de formato inválido.');
  if (['literal', 'token', 'conditional'].filter(key => key in part).length !== 1) invalid('Escolha um único tipo para cada parte do formato.');
  if ('literal' in part) { if (typeof part['literal'] !== 'string') invalid('Texto de formato inválido.'); return; }
  if ('token' in part) {
    if (!CALENDAR_TOKENS.includes(part['token'] as typeof CALENDAR_TOKENS[number])) invalid('Componente de formato desconhecido.');
    if (part['width'] !== undefined && (!Number.isSafeInteger(part['width']) || Number(part['width']) < 1 || Number(part['width']) > 20)) invalid('Largura do componente deve estar entre 1 e 20.');
    return;
  }
  const rule = part['conditional'];
  if (!object(rule) || !['all', 'any'].includes(String(rule['mode']))) invalid('Escolha como combinar as condições.');
  if (!Array.isArray(rule['conditions']) || !rule['conditions'].length || rule['conditions'].length > 20) invalid('Use entre 1 e 20 condições por texto.');
  for (const condition of rule['conditions']) {
    if (!object(condition) || !CALENDAR_CONDITION_FIELDS.includes(condition['field'] as CalendarConditionField) || !CALENDAR_CONDITION_OPERATORS.includes(condition['operator'] as typeof CALENDAR_CONDITION_OPERATORS[number])) invalid('Campo ou comparação de condição desconhecidos.');
    const minimum = ['year'].includes(String(condition['field'])) ? Number.MIN_SAFE_INTEGER : ['hour', 'minute', 'second'].includes(String(condition['field'])) ? 0 : 1;
    if (!Number.isSafeInteger(condition['value']) || Number(condition['value']) < minimum) invalid('Informe um número inteiro válido para a condição.');
    if (condition['operator'] === 'between' && (!Number.isSafeInteger(condition['end']) || Number(condition['end']) < Number(condition['value']))) invalid('O fim do intervalo deve ser inteiro e maior ou igual ao início.');
  }
  if (typeof rule['whenTrue'] !== 'string' || typeof rule['whenFalse'] !== 'string' || (rule['whenUnknown'] !== undefined && typeof rule['whenUnknown'] !== 'string')) invalid('Informe textos válidos para os resultados da condição.');
}
export function renderConditionalText(rule: CalendarConditionalText, values: Partial<Record<CalendarConditionField, number>>): string {
  const matches = rule.conditions.map(condition => {
    const actual = values[condition.field]; if (actual === undefined) return undefined;
    switch (condition.operator) {
      case 'lt': return actual < condition.value;
      case 'lte': return actual <= condition.value;
      case 'eq': return actual === condition.value;
      case 'neq': return actual !== condition.value;
      case 'gte': return actual >= condition.value;
      case 'gt': return actual > condition.value;
      case 'between': return actual >= condition.value && actual <= condition.end!;
    }
  });
  const result = rule.mode === 'all'
    ? matches.includes(false) ? false : matches.includes(undefined) ? undefined : true
    : matches.includes(true) ? true : matches.includes(undefined) ? undefined : false;
  return result === undefined ? rule.whenUnknown ?? '' : result ? rule.whenTrue : rule.whenFalse;
}
export function portableFormatPart(part: CalendarFormatPart): CalendarFormatPart {
  if ('literal' in part) return { literal: part.literal };
  if ('token' in part) return { token: part.token, ...(part.width !== undefined ? { width: part.width } : {}) };
  return { conditional: { mode: part.conditional.mode,
    conditions: part.conditional.conditions.map(c => ({ field: c.field, operator: c.operator, value: c.value, ...(c.operator === 'between' ? { end: c.end } : {}) })),
    whenTrue: part.conditional.whenTrue, whenFalse: part.conditional.whenFalse, ...(part.conditional.whenUnknown !== undefined ? { whenUnknown: part.conditional.whenUnknown } : {}),
  } };
}
