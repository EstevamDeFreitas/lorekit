import {
  buildRollPreview,
  ConditionImpact,
  RollModifier,
  RollPreview,
} from './rolls';

export const NPC_ATTRIBUTES = [
  'BODY',
  'MIND',
  'PRESENCE',
  'TECHNIQUE',
  'PERCEPTION',
] as const;
export type NpcAttribute = (typeof NPC_ATTRIBUTES)[number];
export const NPC_DAMAGE = [
  'light',
  'moderate',
  'severe',
  'grave',
  'devastating',
] as const;
export type NpcDamage = (typeof NPC_DAMAGE)[number];
export type NpcTagType = 'competence' | 'property' | 'trigger' | 'limitation';
export interface NpcTag {
  id: string;
  name: string;
  type: NpcTagType;
  description: string;
  attribute: NpcAttribute | null;
  diceModifier: number;
  modifier: number;
  context: string;
}
export interface NpcAction {
  id: string;
  name: string;
  attribute: NpcAttribute;
  description: string;
  damage: NpcDamage | null;
  target: string;
  resistance: string;
  usage: string;
  cost: string;
  cooldown: string;
}
export interface NpcDefinition {
  version: 1;
  concept: string;
  threatLevel: number | null;
  protection: string;
  lifeAdjustment: number;
  resistanceAdjustment: number;
  tags: NpcTag[];
  actions: NpcAction[];
  signatures: NpcAction[];
  resistances: string;
  weaknesses: string;
  notes: string;
}
export const NPC_THREAT_RULES = [
  { dice: 1, modifier: 1, damage: 'moderate' },
  { dice: 1, modifier: 2, damage: 'severe' },
  { dice: 1, modifier: 3, damage: 'severe' },
  { dice: 2, modifier: 2, damage: 'grave' },
  { dice: 2, modifier: 3, damage: 'devastating' },
  { dice: 3, modifier: 3, damage: 'devastating' },
] as const;

export function createNpcDefinition(): NpcDefinition {
  return {
    version: 1,
    concept: '',
    threatLevel: null,
    protection: '',
    lifeAdjustment: 0,
    resistanceAdjustment: 0,
    tags: [],
    actions: [],
    signatures: [],
    resistances: '',
    weaknesses: '',
    notes: '',
  };
}

/** Strictly decodes persisted/synchronized or user-published data without accepting private fields. */
export function parseNpcDefinition(value: unknown): NpcDefinition {
  const record = (entry: unknown, keys: string[]): Record<string, unknown> => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).some((key) => !keys.includes(key))
    )
      throw new Error('Definição de PNJ inválida.');
    return entry as Record<string, unknown>;
  };
  const text = (entry: unknown, maximum = 20_000): string => {
    if (typeof entry !== 'string' || entry.length > maximum)
      throw new Error('Texto de PNJ inválido.');
    return entry;
  };
  const number = (entry: unknown): number => {
    if (typeof entry !== 'number' || !Number.isSafeInteger(entry))
      throw new Error('Valor numérico de PNJ inválido.');
    return entry;
  };
  const list = (entry: unknown): unknown[] => {
    if (!Array.isArray(entry) || entry.length > 100)
      throw new Error('Lista de PNJ inválida.');
    return entry;
  };
  const attribute = (entry: unknown): NpcAttribute => {
    if (!NPC_ATTRIBUTES.includes(entry as NpcAttribute))
      throw new Error('Atributo de PNJ inválido.');
    return entry as NpcAttribute;
  };
  const input = record(value, [
    'version',
    'concept',
    'threatLevel',
    'protection',
    'lifeAdjustment',
    'resistanceAdjustment',
    'tags',
    'actions',
    'signatures',
    'resistances',
    'weaknesses',
    'notes',
  ]);
  if (input['version'] !== 1) throw new Error('Versão de PNJ não suportada.');
  const tags = list(input['tags']).map((entry): NpcTag => {
    const tag = record(entry, [
      'id',
      'name',
      'type',
      'description',
      'attribute',
      'diceModifier',
      'modifier',
      'context',
    ]);
    const type = tag['type'];
    if (
      type !== 'competence' &&
      type !== 'property' &&
      type !== 'trigger' &&
      type !== 'limitation'
    )
      throw new Error('Tipo de Tag inválido.');
    return {
      id: text(tag['id'], 120),
      name: text(tag['name'], 120),
      type,
      description: text(tag['description']),
      attribute: tag['attribute'] === null ? null : attribute(tag['attribute']),
      diceModifier: number(tag['diceModifier']),
      modifier: number(tag['modifier']),
      context: text(tag['context']),
    };
  });
  const actions = (entries: unknown): NpcAction[] =>
    list(entries).map((entry) => {
      const action = record(entry, [
        'id',
        'name',
        'attribute',
        'description',
        'damage',
        'target',
        'resistance',
        'usage',
        'cost',
        'cooldown',
      ]);
      const damage = action['damage'];
      if (damage !== null && !NPC_DAMAGE.includes(damage as NpcDamage))
        throw new Error('Severidade de PNJ inválida.');
      return {
        id: text(action['id'], 120),
        name: text(action['name'], 120),
        attribute: attribute(action['attribute']),
        description: text(action['description']),
        damage: damage as NpcDamage | null,
        target: text(action['target']),
        resistance: text(action['resistance']),
        usage: text(action['usage']),
        cost: text(action['cost']),
        cooldown: text(action['cooldown']),
      };
    });
  const definition: NpcDefinition = {
    version: 1,
    concept: text(input['concept']),
    threatLevel:
      input['threatLevel'] === null ? null : number(input['threatLevel']),
    protection: text(input['protection']),
    lifeAdjustment: number(input['lifeAdjustment']),
    resistanceAdjustment: number(input['resistanceAdjustment']),
    tags,
    actions: actions(input['actions']),
    signatures: actions(input['signatures']),
    resistances: text(input['resistances']),
    weaknesses: text(input['weaknesses']),
    notes: text(input['notes']),
  };
  const errors = validateNpcDefinition(definition);
  if (errors.length) throw new Error(errors.join('\n'));
  return definition;
}

export function validateNpcDefinition(definition: NpcDefinition): string[] {
  const errors: string[] = [];
  if (definition.version !== 1) errors.push('Versão de PNJ não suportada.');
  const na = definition.threatLevel;
  if (na !== null && (!Number.isInteger(na) || na < 1 || na > 6))
    errors.push('NA deve ser um inteiro entre 1 e 6.');
  for (const [name, value] of [
    ['Ajuste CV', definition.lifeAdjustment],
    ['Ajuste CR', definition.resistanceAdjustment],
  ] as const) {
    if (!Number.isInteger(value) || value < -5 || value > 5)
      errors.push(`${name} deve estar entre -5 e +5.`);
  }
  if (!definition.protection.trim() && definition.resistanceAdjustment !== 0)
    errors.push('CR exige proteção explícita.');
  if (definition.actions.length > 4)
    errors.push('Um PNJ pode ter até quatro ações básicas.');
  const rule = na === null ? undefined : NPC_THREAT_RULES[na - 1];
  if (rule && na !== null) {
    if (2 * na + definition.lifeAdjustment < 0)
      errors.push('CV total não pode ser negativo.');
    if (
      definition.protection.trim() &&
      na + definition.resistanceAdjustment < 0
    )
      errors.push('CR total não pode ser negativo.');
  }
  const tagIds = new Set<string>();
  for (const tag of definition.tags) {
    if (!tag.id || tagIds.has(tag.id))
      errors.push('Identidade de Tag duplicada ou ausente.');
    tagIds.add(tag.id);
    if (!tag.name.trim()) errors.push('Tag precisa de nome.');
    if (!['competence', 'property', 'trigger', 'limitation'].includes(tag.type))
      errors.push('Tipo de Tag inválido.');
    if (tag.attribute !== null && !NPC_ATTRIBUTES.includes(tag.attribute))
      errors.push('Atributo da Tag inválido.');
    if (
      ![tag.diceModifier, tag.modifier].every(
        (value) => Number.isSafeInteger(value) && Math.abs(value) <= 50,
      )
    )
      errors.push('Modificadores da Tag devem ser inteiros entre -50 e +50.');
    if (
      tag.type !== 'competence' &&
      (tag.diceModifier !== 0 || tag.modifier !== 0)
    )
      errors.push('Somente Tags de Competência têm modificadores automáticos.');
  }
  const actionIds = new Set<string>();
  for (const action of [...definition.actions, ...definition.signatures]) {
    if (
      !action.id ||
      actionIds.has(action.id) ||
      action.id.startsWith('attribute:')
    )
      errors.push('Identidade de ação duplicada, reservada ou ausente.');
    actionIds.add(action.id);
    if (!action.name.trim()) errors.push('Ação precisa de nome.');
    if (!NPC_ATTRIBUTES.includes(action.attribute))
      errors.push('Atributo da ação inválido.');
    if (action.damage !== null && !NPC_DAMAGE.includes(action.damage))
      errors.push('Severidade inválida.');
    if (
      rule &&
      action.damage !== null &&
      NPC_DAMAGE.indexOf(action.damage) > NPC_DAMAGE.indexOf(rule.damage)
    )
      errors.push(`Ação ${action.name} ultrapassa a severidade do NA.`);
  }
  return errors;
}

export function calculateNpc(definition: NpcDefinition) {
  const errors = validateNpcDefinition(definition);
  if (errors.length) throw new Error(errors.join('\n'));
  const na = definition.threatLevel;
  if (na === null) return null;
  const rule = NPC_THREAT_RULES[na - 1]!;
  const lifeBase = 2 * na;
  const resistanceBase = definition.protection.trim() ? na : 0;
  return {
    ...rule,
    lifeBase,
    resistanceBase,
    life: lifeBase + definition.lifeAdjustment,
    resistance: resistanceBase
      ? resistanceBase + definition.resistanceAdjustment
      : 0,
  };
}

export function buildNpcRoll(
  definition: NpcDefinition,
  actionId: string,
  competenceId: string | null,
  impacts: readonly ConditionImpact[] = [],
  manualModifier = 0,
): RollPreview {
  const base = calculateNpc(definition);
  if (!base) throw new Error('Defina o NA para realizar rolagens.');
  const action = npcRollActions(definition).find(
    (entry) => entry.id === actionId,
  );
  if (!action) throw new Error('Ação de PNJ não encontrada.');
  const modifiers: RollModifier[] = [
    {
      key: 'threat',
      label: `NA ${definition.threatLevel}`,
      value: base.modifier,
      category: 'source',
    },
  ];
  let dice = base.dice as number;
  if (competenceId) {
    const tag = definition.tags.find((entry) => entry.id === competenceId);
    if (
      !tag ||
      tag.type !== 'competence' ||
      (tag.attribute && tag.attribute !== action.attribute)
    )
      throw new Error('Competência não aplicável à ação.');
    dice += tag.diceModifier;
    modifiers.push({
      key: tag.id,
      label: tag.name,
      value: tag.modifier,
      category: 'source',
      displayValue: `${tag.diceModifier >= 0 ? '+' : ''}${tag.diceModifier}d10`,
    });
  }
  if (!Number.isSafeInteger(manualModifier) || Math.abs(manualModifier) > 50)
    throw new Error('Ajuste manual inválido.');
  if (manualModifier)
    modifiers.push({
      key: 'manual',
      label: 'Ajuste manual',
      value: manualModifier,
      category: 'manual',
    });
  return buildRollPreview(dice, modifiers, impacts, 4);
}

export function npcRollActions(definition: NpcDefinition): NpcAction[] {
  const labels = {
    BODY: 'Corpo',
    MIND: 'Mente',
    PRESENCE: 'Presença',
    TECHNIQUE: 'Técnica',
    PERCEPTION: 'Percepção',
  };
  return [
    ...definition.actions,
    ...definition.signatures,
    ...NPC_ATTRIBUTES.map((attribute) => ({
      id: `attribute:${attribute}`,
      name: `Teste de ${labels[attribute]}`,
      attribute,
      description: '',
      damage: null,
      target: '',
      resistance: '',
      usage: '',
      cost: '',
      cooldown: '',
    })),
  ];
}
