import { Injectable, Injector, inject } from '@angular/core';
import {
  parseConditionImpact,
  parseStoryMechanics,
  type StoryCharacterAction,
  type StoryMechanics,
  type StorySpeakerInput,
} from '@lorekit/ironpaw';
import { DbProvider } from '../database/db-provider.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';
import { CharacterService } from './character.service';
import { IrpwNpcCatalogService } from './irpw-npc-catalog.service';
import { IrpwCharacterSheetService } from './irpw-character-sheet.service';
import { IrpwConditionCatalogService } from './irpw-condition-catalog.service';
import { ImageService } from './image.service';
import { getImageByUsageKey, type Image } from '../models/image.model';
import { getPersonalizationValue } from '../models/personalization.model';
import {
  ATTRIBUTE_GROUP_LABEL,
  ATTRIBUTE_GROUP_SKILLS,
  SKILL_LABEL,
  type AttributeGroupCode,
  type SkillCode,
} from '../models/irpw-attributes-skills.model';
import {
  getVocationSkillMinimums,
  normalizeIrpwSkillLevel,
  parseIrpwPerceptions,
} from '../models/irpw-rules.model';
import { parseIrpwInventory } from '../models/irpw-item.model';
import {
  CONDITION_SEVERITY_LABEL,
  type ActiveConditionState,
} from '../models/irpw-conditions.model';
import { StoryClientService } from './story-client.service';

export interface StorySharingSource {
  id: string;
  kind: 'character' | 'npc';
  name: string;
}
export interface StorySharingPreview {
  source: StorySharingSource;
  color: string;
  portrait: Image | null;
  mechanics: StoryMechanics | null;
}
function object(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
function array(raw: string | null | undefined): unknown[] {
  try {
    const value: unknown = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class StorySharingService {
  private readonly injector = inject(Injector);
  private readonly provider = inject(DbProvider);
  private readonly workspace = inject(WorkspaceRuntimeService);
  private readonly client = inject(StoryClientService);

  async sources(): Promise<StorySharingSource[]> {
    if (!this.provider.ready())
      await this.workspace.initializeAuthenticatedWeb();
    this.assertWritable();
    const characters = this.injector
      .get(CharacterService)
      .getCharacters(null)
      .map((character) => ({
        id: character.id,
        kind: 'character' as const,
        name: character.name,
      }));
    const npcs = this.injector
      .get(IrpwNpcCatalogService)
      .list()
      .map((npc) => ({ id: npc.id, kind: 'npc' as const, name: npc.name }));
    return [...characters, ...npcs].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
  }

  preview(source: StorySharingSource): StorySharingPreview {
    this.assertWritable();
    const images = this.injector.get(ImageService);
    if (source.kind === 'npc') {
      const npc = this.injector.get(IrpwNpcCatalogService).get(source.id);
      if (!npc) throw new Error('PNJ não encontrado no catálogo.');
      return {
        source,
        color: npc.color,
        portrait: images.getImage('IRPWNpc', npc.id, 'portrait'),
        mechanics: {
          kind: 'npc',
          definition: { ...structuredClone(npc.definition), notes: '' },
        },
      };
    }
    const character = this.injector
      .get(CharacterService)
      .getCharacter(source.id);
    if (!character) throw new Error('Personagem não encontrado.');
    const sheet = this.injector
      .get(IrpwCharacterSheetService)
      .getSheet(source.id);
    const color = getPersonalizationValue(character, 'color');
    const result: StorySharingPreview = {
      source,
      color: color && /^#[a-f0-9]{6}$/i.test(color) ? color : '#d4d4d8',
      portrait: getImageByUsageKey(character.Images, 'profile'),
      mechanics: null,
    };
    if (!sheet) return result;
    const attrs = object(sheet.attributes) as Record<
      string,
      { value?: number; skills?: Record<string, number> }
    >;
    const minimums = getVocationSkillMinimums(
      character.ParentIRPWVocation?.attributes,
    );
    const conditions = array(sheet.conditions) as ActiveConditionState[];
    const definitions = this.injector
      .get(IrpwConditionCatalogService)
      .getDefinitions();
    const impacts = (targets: string[]) =>
      conditions.flatMap((condition) => {
        const definition = definitions.find(
          (entry) => entry.code === condition.code,
        );
        const effects =
          definition?.effects?.[condition.severity]?.conditionEffect;
        return (Array.isArray(effects) ? effects : effects ? [effects] : [])
          .map((effect) =>
            parseConditionImpact(
              effect,
              targets,
              `${condition.code}-${condition.severity}`,
              `${definition!.label} ${CONDITION_SEVERITY_LABEL[condition.severity]}`,
            ),
          )
          .filter((effect) => effect !== null);
      });
    const actions: StoryCharacterAction[] = [];
    for (const group of Object.keys(
      ATTRIBUTE_GROUP_SKILLS,
    ) as AttributeGroupCode[]) {
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group])
        actions.push({
          id: skill,
          name: SKILL_LABEL[skill],
          attribute: group,
          description: '',
          skillLevel: Math.max(
            normalizeIrpwSkillLevel(attrs[group]?.skills?.[skill]),
            minimums[skill] ?? 0,
          ),
          sourceLabel: ATTRIBUTE_GROUP_LABEL[group],
          sourceValue: Number(attrs[group]?.value) || 0,
          impacts: impacts([skill, group]),
        });
    }
    const conjuration = object(sheet.attributes)['_conjuration'] as
      { attribute?: AttributeGroupCode; level?: number } | undefined;
    if (conjuration?.attribute && ATTRIBUTE_GROUP_SKILLS[conjuration.attribute])
      actions.push({
        id: 'CONJURATION',
        name: 'Conjuração',
        attribute: conjuration.attribute,
        description: '',
        skillLevel: normalizeIrpwSkillLevel(conjuration.level),
        sourceLabel: ATTRIBUTE_GROUP_LABEL[conjuration.attribute],
        sourceValue: Number(attrs[conjuration.attribute]?.value) || 0,
        impacts: impacts(['CONJURATION', conjuration.attribute]),
      });
    const perceptions = parseIrpwPerceptions(sheet.perceptions);
    for (const [key, label] of [
      ['smell', 'Olfato'],
      ['vision', 'Visão'],
      ['hearing', 'Audição'],
    ] as const)
      actions.push({
        id: `perception:${key}`,
        name: label,
        attribute: 'PERCEPTION',
        description: '',
        skillLevel: 0,
        sourceLabel: label,
        sourceValue: perceptions[key] ?? 0,
        impacts: impacts(['PERCEPTION']),
      });
    for (const entry of parseIrpwInventory(sheet.inventory)?.entries ?? []) {
      if (entry.location !== 'equipment' || !entry.snapshot.definition.weapon)
        continue;
      const base = actions.find(
        (action) => action.id === entry.snapshot.definition.weapon!.attackSkill,
      );
      if (base)
        actions.push({
          ...base,
          id: `weapon:${entry.instanceId}`,
          name: `Ataque · ${entry.snapshot.name}`,
          description: entry.snapshot.definition.weapon.specialProperty || '',
        });
    }
    const ownAbilities = array(sheet.habilities),
      vocationAbilities = array(character.ParentIRPWVocation?.habilities);
    for (const [index, raw] of [
      ...ownAbilities,
      ...vocationAbilities,
    ].entries()) {
      if (!raw || typeof raw !== 'object') continue;
      const ability = raw as {
        id?: string;
        name?: string;
        description?: string;
        rollSkill?: SkillCode;
      };
      const base = actions.find((action) => action.id === ability.rollSkill);
      if (base)
        actions.push({
          ...base,
          id: `ability:${ability.id || index}`,
          name: ability.name || base.name,
          description: ability.description || '',
        });
    }
    result.mechanics = parseStoryMechanics({ kind: 'character', actions });
    return result;
  }

  async publish(
    preview: StorySharingPreview,
    name: string,
    color: string,
    includePortrait: boolean,
    actionIds: string[],
    sceneId: string | null,
    existingSpeakerId?: string,
  ) {
    this.client.requireOnline();
    this.assertWritable();
    const storyId = this.client.current()?.story.id;
    if (!storyId) throw new Error('Abra uma História.');
    let portraitAssetId: string | null = null;
    if (includePortrait && preview.portrait) {
      const images = this.injector.get(ImageService);
      const image = await images.readAsset(
        images.referenceFor(preview.portrait),
      );
      portraitAssetId = crypto.randomUUID();
      await this.client.api.reserve(storyId, {
        id: portraitAssetId,
        name: 'Retrato',
        mimeType: image.mimeType,
        sizeBytes: image.bytes.byteLength,
        sha256: image.sha256,
      });
      await this.client.api.upload(
        storyId,
        portraitAssetId,
        image.bytes,
        image.mimeType,
      );
    }
    const mechanics =
      preview.mechanics?.kind === 'character'
        ? {
            kind: 'character' as const,
            actions: preview.mechanics.actions.filter((action) =>
              actionIds.includes(action.id),
            ),
          }
        : preview.mechanics;
    const input: StorySpeakerInput = {
      version: 1,
      operationId: crypto.randomUUID(),
      sceneId: preview.source.kind === 'npc' ? sceneId : null,
      kind: preview.source.kind,
      name,
      color,
      portraitAssetId,
      mechanics,
    };
    const published = await this.client.api.speaker(
      storyId,
      input,
      existingSpeakerId,
    );
    await this.client.refreshCurrent();
    return published;
  }

  private assertWritable(): void {
    if (!this.provider.ready() || this.provider.readOnly())
      throw new Error(
        'Abra seu conteúdo em uma sessão com permissão de edição para disponibilizá-lo à História.',
      );
  }
}
