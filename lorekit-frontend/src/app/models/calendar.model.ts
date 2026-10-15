export type CalendarPrecision = 'year' | 'month' | 'day';
export type CalendarSide = 'before' | 'after';
export interface CalendarMonth { id: string; name: string; abbreviation: string; days: number; }
export interface CalendarWeekDay { id: string; name: string; abbreviation: string; }
export interface CalendarTime { hour: number; minute: number; second: number; }
export interface CalendarPoint { year: number; monthId?: string; day: number; }
export interface CalendarDate {
  version: 1; calendarId: string; revisionId: string; precision: CalendarPrecision;
  year: number; monthId?: string; day?: number; time?: CalendarTime;
  /** Clips partial dates to one side of a reference; never changes canonical coordinates. */
  countId?: string; side?: CalendarSide;
}
export interface CalendarYearCount {
  id: string; name: string; description: string; reference: CalendarPoint;
  beforeName: string; beforeAbbreviation: string; afterName: string; afterAbbreviation: string;
  firstYear: 0 | 1; sourceAgeId?: string;
}
export interface CalendarSeason {
  id: string; name: string; color: string;
  start: { monthId?: string; day: number }; end: { monthId?: string; day: number };
}
export const CALENDAR_TOKENS = ['day', 'dayOrdinal', 'month', 'monthName', 'monthOrdinal', 'year', 'side', 'abbreviation', 'hour', 'minute', 'second'] as const;
export type CalendarToken = typeof CALENDAR_TOKENS[number];
export const CALENDAR_CONDITION_FIELDS = ['day', 'month', 'year', 'weekday', 'dayOfYear', 'hour', 'minute', 'second'] as const;
export type CalendarConditionField = typeof CALENDAR_CONDITION_FIELDS[number];
export const CALENDAR_CONDITION_OPERATORS = ['lt', 'lte', 'eq', 'neq', 'gte', 'gt', 'between'] as const;
export type CalendarConditionOperator = typeof CALENDAR_CONDITION_OPERATORS[number];
export interface CalendarFormatCondition { field: CalendarConditionField; operator: CalendarConditionOperator; value: number; end?: number; }
export interface CalendarConditionalText {
  mode: 'all' | 'any'; conditions: CalendarFormatCondition[];
  whenTrue: string; whenFalse: string; whenUnknown?: string;
}
export type CalendarFormatPart = { literal: string } | { token: CalendarToken; width?: number } | { conditional: CalendarConditionalText };
export interface CalendarFormat {
  id: string; name: string;
  year: CalendarFormatPart[]; month: CalendarFormatPart[];
  day: CalendarFormatPart[]; time: CalendarFormatPart[];
}
export interface CalendarRules {
  version: 1; months: CalendarMonth[]; daysPerYear: number;
  week: { enabled: boolean; mode: 'continuous' | 'restart'; anchor: number; days: CalendarWeekDay[] };
  clock: {
    hoursPerDay: number; minutesPerHour: number; secondsPerMinute: number;
    hourName: string; minuteName: string; secondName: string;
    hourAbbreviation: string; minuteAbbreviation: string; secondAbbreviation: string;
    dayDurationTerrestrialSeconds?: string;
  };
  counts: CalendarYearCount[]; seasons: CalendarSeason[]; formats: CalendarFormat[];
}
export interface WorldCalendar { id: string; worldId: string; name: string; description: string; latestRevisionId: string; }
export interface CalendarRevision { id: string; calendarId: string; revision: number; rulesJson: string; }
export interface CalendarBinding { calendarId: string; revisionId: string; countId?: string; formatId?: string; }
export interface CalendarDateFieldOptions {
  version: 1; kind: 'calendar-date'; mode: 'fixed' | 'selectable'; allowTime: boolean;
  bindings: Record<string, CalendarBinding>; formatId?: string;
}
