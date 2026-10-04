import { Injectable } from '@angular/core';
import {
  CONDITION_CATEGORY,
  CONDITIONS,
  ConditionCategoryCode,
  ConditionDefinition,
  ConditionSeverityCode,
} from '../models/irpw-conditions.model';
import { GlobalParameterService } from './global-parameter.service';

const CONDITION_CATALOG_KEY = 'ironpaw.condition-catalog.v1';

@Injectable({ providedIn: 'root' })
export class IrpwConditionCatalogService {
  constructor(private readonly parameters: GlobalParameterService) {}

  getDefinitions(): ConditionDefinition[] {
    const definitions = new Map<string, ConditionDefinition>(
      Object.values(CONDITIONS).map(definition => [definition.code, definition]),
    );

    try {
      const saved = this.parameters.getParameter(CONDITION_CATALOG_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        for (const candidate of parsed) {
          const definition = this.normalizeDefinition(candidate);
          if (definition) definitions.set(definition.code, definition);
        }
      }
    } catch {
      // Keep built-in rules available if a saved catalogue is malformed.
    }

    return [...definitions.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  saveDefinitions(definitions: ConditionDefinition[]): void {
    const normalized = definitions
      .map(definition => this.normalizeDefinition(definition))
      .filter((definition): definition is ConditionDefinition => !!definition);
    this.parameters.setParameter(CONDITION_CATALOG_KEY, JSON.stringify(normalized));
  }

  private normalizeDefinition(value: unknown): ConditionDefinition | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Partial<ConditionDefinition>;
    const code = typeof source.code === 'string' ? source.code.trim() : '';
    const label = typeof source.label === 'string' ? source.label.trim() : '';
    if (!code || !label || !this.isCategory(source.category)) return null;

    const effects: ConditionDefinition['effects'] = {};
    for (const severity of ['LIGHT', 'MODERATE', 'SEVERE'] as ConditionSeverityCode[]) {
      const effect = source.effects?.[severity];
      if (!effect || typeof effect !== 'object') continue;
      effects[severity] = {
        label: String(effect.label ?? this.severityLabel(severity)),
        description: String(effect.description ?? ''),
        ...(typeof effect.conditionEffect === 'string' || Array.isArray(effect.conditionEffect)
          ? { conditionEffect: effect.conditionEffect }
          : {}),
      };
    }

    return {
      code,
      label,
      category: source.category,
      description: typeof source.description === 'string' ? source.description : undefined,
      ...(Object.keys(effects).length ? { effects } : {}),
    };
  }

  private isCategory(value: unknown): value is ConditionCategoryCode {
    return typeof value === 'string' && Object.values(CONDITION_CATEGORY).includes(value as ConditionCategoryCode);
  }

  private severityLabel(severity: ConditionSeverityCode): string {
    return severity === 'LIGHT' ? 'Leve' : severity === 'MODERATE' ? 'Moderado' : 'Severo';
  }
}
