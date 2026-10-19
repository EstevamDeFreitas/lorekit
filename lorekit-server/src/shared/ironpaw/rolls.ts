export const IRONPAW_RULES_VERSION = 1;
export type RollStatus = 'success' | 'near' | 'fail' | 'neutral';
export type RollResolutionMode = 'normal' | 'disadvantage';
export interface RollModifier {
  key: string;
  label: string;
  value: number;
  category: 'skill' | 'source' | 'manual' | 'condition';
  displayValue?: string;
}
export interface RollPreview {
  attempts: number;
  sides: number;
  modifiers: RollModifier[];
  totalModifier: number;
  resolutionMode: RollResolutionMode;
}
export interface RollResult {
  index: number;
  dieValue: number;
  rolls: number[];
  modifier: number;
  total: number;
  status: RollStatus;
  resolutionLabel: string;
}
export interface ConditionImpact {
  key: string;
  label: string;
  type: 'modifier' | 'minus-dice' | 'disadvantage';
  value: number;
  displayValue: string;
}
export interface ParsedRollFormula {
  attempts: number;
  sides: number;
  modifier: number;
}
export type RollDie = (sides: number) => number;

export function signedValue(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function normalizeRollInteger(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

export function parseRollFormula(formula: string): ParsedRollFormula | null {
  const match = formula
    .trim()
    .match(/^(\d+)\s*d\s*(4|6|10|20)\s*([+-]\s*\d+)?$/i);
  if (!match) return null;
  const attempts = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3].replace(/\s+/g, '')) : 0;
  if (
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 50 ||
    !Number.isSafeInteger(modifier)
  )
    return null;
  return { attempts, sides, modifier };
}

export function buildRollFormula(preview: RollPreview): string {
  const modifier =
    preview.totalModifier === 0 ? '' : signedValue(preview.totalModifier);
  return preview.resolutionMode === 'disadvantage'
    ? `2d10${modifier} (desvantagem)`
    : `${preview.attempts}d10${modifier}`;
}

export function buildRollPreview(
  baseAttempts: number,
  initialModifiers: readonly RollModifier[],
  impacts: readonly ConditionImpact[],
  maximumDice = 50,
): RollPreview {
  const modifiers = initialModifiers.map((modifier) => ({ ...modifier }));
  let attempts = baseAttempts;
  let resolutionMode: RollResolutionMode = 'normal';
  for (const impact of impacts) {
    modifiers.push({
      key: impact.key,
      label: impact.label,
      value: impact.type === 'modifier' ? impact.value : 0,
      category: 'condition',
      displayValue: impact.displayValue,
    });
    if (impact.type === 'minus-dice') attempts -= impact.value;
    if (impact.type === 'disadvantage') resolutionMode = 'disadvantage';
  }
  if (attempts <= 0) {
    attempts = 1;
    modifiers.push({
      key: 'condition-dice-floor',
      label: 'Sem dados restantes',
      value: -3,
      category: 'condition',
      displayValue: '1d10-3',
    });
  }
  attempts =
    resolutionMode === 'disadvantage' ? 1 : Math.min(maximumDice, attempts);
  return {
    attempts,
    sides: 10,
    modifiers,
    totalModifier: modifiers.reduce((sum, modifier) => sum + modifier.value, 0),
    resolutionMode,
  };
}

export function parseConditionImpact(
  effect: string,
  targets: readonly string[],
  keyPrefix: string,
  label: string,
): ConditionImpact | null {
  const [rawTarget, rawValue] = effect.split(':');
  if (!rawTarget || !rawValue) return null;
  const target = rawTarget.trim().toUpperCase();
  if (!targets.includes(target)) return null;
  const valueText = rawValue.trim().toUpperCase();
  const key = `${keyPrefix}-${target}`.toLowerCase();
  if (/^-?\d+$/.test(valueText)) {
    const value = Number(valueText);
    if (!Number.isSafeInteger(value)) return null;
    return {
      key: `${key}-modifier`,
      label,
      type: 'modifier',
      value,
      displayValue: signedValue(value),
    };
  }
  const minusDice = valueText.match(/^MINUS\s+(\d+)D10$/i);
  if (minusDice) {
    const value = Number(minusDice[1]);
    if (!Number.isSafeInteger(value)) return null;
    return {
      key: `${key}-minus-dice`,
      label,
      type: 'minus-dice',
      value,
      displayValue: `-${value}d10`,
    };
  }
  return valueText === 'DISADVANTAGE'
    ? {
        key: `${key}-disadvantage`,
        label,
        type: 'disadvantage',
        value: 0,
        displayValue: 'Desvantagem',
      }
    : null;
}

export function getRollStatus(
  total: number,
  target: number | null | undefined,
): RollStatus {
  if (target == null || !Number.isFinite(Number(target))) return 'neutral';
  if (total >= Number(target)) return 'success';
  return total === Number(target) - 1 ? 'near' : 'fail';
}

export function executeRoll(
  preview: RollPreview,
  rollDie: RollDie,
  target?: number | null,
): RollResult[] {
  if (
    !Number.isInteger(preview.attempts) ||
    preview.attempts < 1 ||
    preview.attempts > 50 ||
    ![4, 6, 10, 20].includes(preview.sides) ||
    !Number.isSafeInteger(preview.totalModifier)
  ) {
    throw new Error('Fórmula de rolagem inválida.');
  }
  const next = (): number => {
    const value = rollDie(preview.sides);
    if (!Number.isInteger(value) || value < 1 || value > preview.sides)
      throw new Error('Resultado do dado inválido.');
    return value;
  };
  return Array.from(
    {
      length: preview.resolutionMode === 'disadvantage' ? 1 : preview.attempts,
    },
    (_, index) => {
      const rolls =
        preview.resolutionMode === 'disadvantage' ? [next(), next()] : [next()];
      const dieValue = Math.min(...rolls);
      const total = dieValue + preview.totalModifier;
      return {
        index: index + 1,
        dieValue,
        rolls,
        modifier: preview.totalModifier,
        total,
        status: getRollStatus(total, target),
        resolutionLabel:
          preview.resolutionMode === 'disadvantage'
            ? `2d${preview.sides} pior`
            : `1d${preview.sides}`,
      };
    },
  );
}
