import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CALENDAR_TOKENS, CalendarConditionField, CalendarConditionOperator, CalendarConditionalText, CalendarFormatCondition, CalendarFormatPart, CalendarToken } from '../../models/calendar.model';

@Component({ selector: 'app-calendar-format-part', imports: [FormsModule, NgTemplateOutlet], templateUrl: './calendar-format-part.component.html', styleUrls: ['../calendar-controls.css', './calendar-format-part.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarFormatPartComponent {
  readonly part = input.required<CalendarFormatPart>(); readonly position = input.required<number>(); readonly total = input.required<number>();
  readonly changed = output<CalendarFormatPart>(); readonly moved = output<number>(); readonly removed = output<void>();
  readonly tokens = CALENDAR_TOKENS;
  readonly fields: { value: CalendarConditionField; label: string }[] = [{ value: 'day', label: 'Dia' }, { value: 'month', label: 'Número do mês' }, { value: 'year', label: 'Ano exibido' }, { value: 'weekday', label: 'Número do dia da semana' }, { value: 'dayOfYear', label: 'Dia do ano' }, { value: 'hour', label: 'Hora' }, { value: 'minute', label: 'Minuto' }, { value: 'second', label: 'Segundo' }];
  readonly operators: { value: CalendarConditionOperator; label: string }[] = [{ value: 'lt', label: 'Menor que' }, { value: 'lte', label: 'Menor ou igual a' }, { value: 'eq', label: 'Igual a' }, { value: 'neq', label: 'Diferente de' }, { value: 'gte', label: 'Maior ou igual a' }, { value: 'gt', label: 'Maior que' }, { value: 'between', label: 'Entre (inclusive)' }];
  isLiteral(part: CalendarFormatPart): part is { literal: string } { return 'literal' in part; }
  isConditional(part: CalendarFormatPart): part is { conditional: CalendarConditionalText } { return 'conditional' in part; }
  tokenLabel(token: CalendarToken): string { return ({ day: 'Dia', dayOrdinal: 'Dia ordinal (37º)', month: 'Número do mês', monthName: 'Nome do mês', monthOrdinal: 'Mês ordinal (6º)', year: 'Ano', side: 'Nome antes/depois', abbreviation: 'Abreviação antes/depois', hour: 'Hora', minute: 'Minuto', second: 'Segundo' })[token]; }
  token(token: CalendarToken, width?: number): void { this.changed.emit({ token, ...(width ? { width } : {}) }); }
  private editRule(operation: (rule: CalendarConditionalText) => void): void { const part = this.part(); if (!this.isConditional(part)) return; const rule = structuredClone(part.conditional); operation(rule); this.changed.emit({ conditional: rule }); }
  ruleText(key: 'whenTrue' | 'whenFalse' | 'whenUnknown', value: string): void { this.editRule(rule => { rule[key] = value; }); }
  mode(value: 'all' | 'any'): void { this.editRule(rule => { rule.mode = value; }); }
  updateCondition(index: number, key: keyof CalendarFormatCondition, value: string | number | null): void {
    this.editRule(rule => { const condition = rule.conditions[index]; Object.assign(condition, { [key]: value }); if (key === 'operator') { if (value === 'between') condition.end = condition.value; else delete condition.end; } });
  }
  addCondition(): void { this.editRule(rule => rule.conditions.push({ field: 'day', operator: 'lt', value: 13 })); }
  removeCondition(index: number): void { this.editRule(rule => { rule.conditions.splice(index, 1); }); }
}
