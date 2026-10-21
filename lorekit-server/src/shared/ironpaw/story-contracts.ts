import type { ConditionImpact, RollPreview, RollResult } from './rolls';
import type { NpcDefinition } from './npcs';
import { parseNpcDefinition } from './npcs';

export const STORY_CONTRACT_VERSION = 1;
export const STORY_LIMITS = {
  title: 200,
  name: 120,
  text: 20_000,
  attachments: 4,
  imageBytes: 10 * 1024 * 1024,
  page: 100,
  actions: 100,
} as const;
export type StoryRole = 'owner' | 'participant';
export type StorySpeakerKind = 'character' | 'npc' | 'incidental';
export type StoryRollKind = 'test' | 'attack' | 'defense';
export type StorySequence = string;
export interface Story {
  version: 1;
  id: string;
  title: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  sequence: StorySequence;
}
export interface StoryMember {
  storyId: string;
  userId: string;
  name: string;
  role: StoryRole;
  readCursor: StorySequence;
  seen: Array<[StorySequence, StorySequence]>;
  preferences: { sound: boolean; external: boolean };
}
export interface StorySummary extends Story {
  role: StoryRole;
  readCursor: StorySequence;
  seen: Array<[StorySequence, StorySequence]>;
  unread: number;
  preferences: { sound: boolean; external: boolean };
}
export interface StoryDetail {
  story: Story;
  member: {
    storyId: string;
    userId: string;
    role: StoryRole;
    readCursor: StorySequence;
    seen: Array<[StorySequence, StorySequence]>;
    sound: boolean;
    external: boolean;
  };
  scenes: StoryScene[];
  speakers: StorySpeaker[];
}
export interface StoryScene {
  id: string;
  storyId: string;
  title: string;
  position: StorySequence;
  createdAt: string;
}
export interface StoryCharacterAction {
  id: string;
  name: string;
  attribute: string;
  description: string;
  skillLevel: number;
  sourceLabel: string;
  sourceValue: number;
  impacts: ConditionImpact[];
}
export type StoryMechanics =
  | { kind: 'character'; actions: StoryCharacterAction[] }
  | { kind: 'npc'; definition: NpcDefinition };
export interface StorySpeakerRevision {
  id: string;
  storyId: string;
  speakerId: string;
  number: number;
  name: string;
  color: string;
  portraitAssetId: string | null;
  mechanics: StoryMechanics | null;
  createdAt: string;
}
export interface StorySpeaker {
  id: string;
  storyId: string;
  sceneId: string | null;
  kind: StorySpeakerKind;
  publisherUserId: string;
  revision: StorySpeakerRevision;
}
export interface StoryAsset {
  id: string;
  storyId: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sizeBytes: number;
  sha256: string;
  state: 'pending' | 'ready';
  createdAt: string;
}
export interface StoryRollRecord {
  version: 1;
  rulesVersion: number;
  kind: StoryRollKind;
  actionId: string;
  actionName: string;
  formula: string;
  preview: RollPreview;
  results: RollResult[];
  target: number | null;
  targetSpeakerId: string | null;
  relatedRollMessageId: string | null;
}
export interface StoryMessage {
  version: 1;
  id: string;
  storyId: string;
  sceneId: string;
  sequence: StorySequence;
  operationId: string;
  authorUserId: string;
  authorName: string;
  speaker: StorySpeakerRevision;
  text: string;
  assets: StoryAsset[];
  roll: StoryRollRecord | null;
  createdAt: string;
  editedAt: string | null;
}
export type StoryEventType =
  | 'story.updated'
  | 'scene.created'
  | 'scene.updated'
  | 'speaker.updated'
  | 'message.created'
  | 'message.updated'
  | 'member.removed';
export interface StoryEvent {
  version: 1;
  id: string;
  storyId: string;
  sequence: StorySequence;
  type: StoryEventType;
  entityId: string;
  createdAt: string;
}
export interface StoryPage<T> {
  version: 1;
  items: T[];
  cursor: StorySequence;
  highWater: StorySequence;
  complete: boolean;
}
export interface StoryHistoryWindow {
  version: 1;
  items: StoryMessage[];
  from: StorySequence;
  through: StorySequence;
  hasOlder: boolean;
}
export interface StoryOperation<T = StoryMessage> {
  operationId: string;
  storyId: string;
  result: T;
}
export interface CreateStoryInput {
  version: 1;
  operationId: string;
  title: string;
}
export interface StorySceneInput {
  version: 1;
  operationId: string;
  title: string;
}
export interface StoryMessageInput {
  version: 1;
  operationId: string;
  sceneId: string;
  speakerId: string;
  revisionId: string;
  text: string;
  assetIds: string[];
}
export interface StoryMessageEditInput {
  version: 1;
  operationId: string;
  text: string;
}
export interface StoryRollInput {
  version: 1;
  operationId: string;
  sceneId: string;
  speakerId: string;
  revisionId: string;
  kind: StoryRollKind;
  actionId: string;
  manualModifier: number;
  competenceId: string | null;
  target: number | null;
  conditionImpacts: ConditionImpact[];
  targetSpeakerId: string | null;
  relatedRollMessageId: string | null;
}
export interface StorySpeakerInput {
  version: 1;
  operationId: string;
  sceneId: string | null;
  kind: StorySpeakerKind;
  name: string;
  color: string;
  portraitAssetId: string | null;
  mechanics: StoryMechanics | null;
}
export interface StoryInvite {
  id: string;
  storyId: string;
  expiresAt: string;
  consumedAt: string | null;
  cancelledAt: string | null;
}

export class StoryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryContractError';
  }
}
export function contractRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new StoryContractError('Objeto inválido.');
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !keys.includes(key)))
    throw new StoryContractError('Campo não permitido.');
  return source;
}
export function contractString(
  value: unknown,
  label: string,
  maximum: number,
  empty = false,
): string {
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    (!empty && !value.trim())
  )
    throw new StoryContractError(`${label} inválido.`);
  return value;
}
export function contractId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new StoryContractError('Identificador inválido.');
  return value;
}
export function contractInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new StoryContractError(`${label} inválido.`);
  return value;
}
export function contractSequence(value: unknown): StorySequence {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,18})$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  )
    throw new StoryContractError('Cursor inválido.');
  return value;
}
export function contractVersion(value: unknown): 1 {
  if (value !== STORY_CONTRACT_VERSION)
    throw new StoryContractError('Versão de História não suportada.');
  return 1;
}
export function assertStoryScope(
  storyId: string,
  resources: readonly { storyId: string }[],
): void {
  if (resources.some((resource) => resource.storyId !== storyId))
    throw new StoryContractError('Recurso não pertence à História.');
}
export function parseStoryMessageInput(value: unknown): StoryMessageInput {
  const input = contractRecord(value, [
    'version',
    'operationId',
    'sceneId',
    'speakerId',
    'revisionId',
    'text',
    'assetIds',
  ]);
  const text = contractString(input['text'], 'Texto', STORY_LIMITS.text, true);
  if (
    !Array.isArray(input['assetIds']) ||
    input['assetIds'].length > STORY_LIMITS.attachments
  )
    throw new StoryContractError('Anexos inválidos.');
  const assetIds = input['assetIds'].map(contractId);
  if (
    new Set(assetIds).size !== assetIds.length ||
    (!text.trim() && !assetIds.length)
  )
    throw new StoryContractError('Mensagem vazia ou anexos duplicados.');
  return {
    version: contractVersion(input['version']),
    operationId: contractId(input['operationId']),
    sceneId: contractId(input['sceneId']),
    speakerId: contractId(input['speakerId']),
    revisionId: contractId(input['revisionId']),
    text,
    assetIds,
  };
}
export function parseStoryMessageEditInput(
  value: unknown,
): StoryMessageEditInput {
  const input = contractRecord(value, ['version', 'operationId', 'text']);
  return {
    version: contractVersion(input['version']),
    operationId: contractId(input['operationId']),
    text: contractString(input['text'], 'Texto', STORY_LIMITS.text, true),
  };
}
export function parseStoryRollInput(value: unknown): StoryRollInput {
  const input = contractRecord(value, [
    'version',
    'operationId',
    'sceneId',
    'speakerId',
    'revisionId',
    'kind',
    'actionId',
    'manualModifier',
    'competenceId',
    'target',
    'targetSpeakerId',
    'relatedRollMessageId',
    'conditionImpacts',
  ]);
  const kind = input['kind'];
  if (kind !== 'test' && kind !== 'attack' && kind !== 'defense')
    throw new StoryContractError('Tipo de rolagem inválido.');
  const nullableId = (entry: unknown): string | null =>
    entry === null ? null : contractId(entry);
  return {
    version: contractVersion(input['version']),
    operationId: contractId(input['operationId']),
    sceneId: contractId(input['sceneId']),
    speakerId: contractId(input['speakerId']),
    revisionId: contractId(input['revisionId']),
    kind,
    actionId: contractString(input['actionId'], 'Ação', 120),
    manualModifier: contractInteger(input['manualModifier'], 'Ajuste', -50, 50),
    competenceId:
      input['competenceId'] === null
        ? null
        : contractString(input['competenceId'], 'Competência', 120),
    target:
      input['target'] === null
        ? null
        : contractInteger(input['target'], 'Dificuldade', -1000, 1000),
    conditionImpacts: parseConditionImpacts(input['conditionImpacts'] ?? []),
    targetSpeakerId: nullableId(input['targetSpeakerId']),
    relatedRollMessageId: nullableId(input['relatedRollMessageId']),
  };
}
export function parseCreateStoryInput(value: unknown): CreateStoryInput {
  const input = contractRecord(value, ['version', 'operationId', 'title']);
  return {
    version: contractVersion(input['version']),
    operationId: contractId(input['operationId']),
    title: contractString(input['title'], 'Título', STORY_LIMITS.title).trim(),
  };
}

export const parseStorySceneInput = parseCreateStoryInput;

export function parseConditionImpacts(value: unknown): ConditionImpact[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new StoryContractError('Condições inválidas.');
  return value.map((entry: unknown): ConditionImpact => {
    const impact = contractRecord(entry, [
      'key',
      'label',
      'type',
      'value',
      'displayValue',
    ]);
    const type = impact['type'];
    if (type !== 'modifier' && type !== 'minus-dice' && type !== 'disadvantage')
      throw new StoryContractError('Tipo de efeito inválido.');
    return {
      key: contractString(impact['key'], 'Identidade do efeito', 200),
      label: contractString(impact['label'], 'Efeito', 200),
      type,
      value: contractInteger(
        impact['value'],
        'Valor do efeito',
        type === 'modifier' ? -50 : 0,
        50,
      ),
      displayValue: contractString(
        impact['displayValue'],
        'Descrição do efeito',
        200,
        true,
      ),
    };
  });
}

export function parseStoryMechanics(value: unknown): StoryMechanics | null {
  if (value === null) return null;
  const mechanics = contractRecord(value, ['kind', 'actions', 'definition']);
  if (mechanics['kind'] === 'npc') {
    if ('actions' in mechanics)
      throw new StoryContractError('Ações de personagem não pertencem a PNJ.');
    return {
      kind: 'npc',
      definition: parseNpcDefinition(mechanics['definition']),
    };
  }
  if (mechanics['kind'] !== 'character' || 'definition' in mechanics)
    throw new StoryContractError('Ficha compartilhada inválida.');
  if (
    !Array.isArray(mechanics['actions']) ||
    mechanics['actions'].length > STORY_LIMITS.actions
  )
    throw new StoryContractError('Lista de ações inválida.');
  const ids = new Set<string>();
  const actions = mechanics['actions'].map(
    (entry: unknown): StoryCharacterAction => {
      const action = contractRecord(entry, [
        'id',
        'name',
        'attribute',
        'description',
        'skillLevel',
        'sourceLabel',
        'sourceValue',
        'impacts',
      ]);
      const id = contractString(action['id'], 'Identidade da ação', 120);
      if (ids.has(id)) throw new StoryContractError('Ações duplicadas.');
      ids.add(id);
      const impacts = parseConditionImpacts(action['impacts']);
      return {
        id,
        name: contractString(action['name'], 'Ação', 120),
        attribute: contractString(action['attribute'], 'Atributo', 120),
        description: contractString(
          action['description'],
          'Descrição',
          20_000,
          true,
        ),
        skillLevel: contractInteger(action['skillLevel'], 'Treino', 0, 50),
        sourceLabel: contractString(action['sourceLabel'], 'Fonte', 200),
        sourceValue: contractInteger(
          action['sourceValue'],
          'Valor da fonte',
          -50,
          50,
        ),
        impacts,
      };
    },
  );
  return { kind: 'character', actions };
}

export function parseStorySpeakerInput(value: unknown): StorySpeakerInput {
  const input = contractRecord(value, [
    'version',
    'operationId',
    'sceneId',
    'kind',
    'name',
    'color',
    'portraitAssetId',
    'mechanics',
  ]);
  const kind = input['kind'];
  if (kind !== 'character' && kind !== 'npc' && kind !== 'incidental')
    throw new StoryContractError('Tipo de locutor inválido.');
  const color = contractString(input['color'], 'Cor', 7);
  if (!/^#[0-9a-f]{6}$/i.test(color))
    throw new StoryContractError('Use cor hexadecimal de seis dígitos.');
  const sceneId =
    input['sceneId'] === null ? null : contractId(input['sceneId']);
  const mechanics = parseStoryMechanics(input['mechanics']);
  if (kind === 'incidental' && (!sceneId || mechanics))
    throw new StoryContractError(
      'Locutor incidental exige cena e não possui ficha.',
    );
  if (mechanics && mechanics.kind !== kind)
    throw new StoryContractError('Ficha incompatível com o locutor.');
  return {
    version: contractVersion(input['version']),
    operationId: contractId(input['operationId']),
    sceneId,
    kind,
    name: contractString(input['name'], 'Nome', STORY_LIMITS.name).trim(),
    color,
    portraitAssetId:
      input['portraitAssetId'] === null
        ? null
        : contractId(input['portraitAssetId']),
    mechanics,
  };
}
