import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { EntityHistoryService } from '../../../services/entity-history.service';
import { CommonModule, NgClass } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { inject, DestroyRef, Component, effect, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { Character } from '../../../models/character.model';
import { IrpwCharacterSheet } from '../../../models/irpw-character-sheet.model';
import { World } from '../../../models/world.model';
import { CharacterService } from '../../../services/character.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { CurrentEntityPageStateService } from '../../../services/current-entity-page-state.service';
import { IrpwCharacterSheetService } from '../../../services/irpw-character-sheet.service';
import { IrpwItemCatalogService } from '../../../services/irpw-item-catalog.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';
import { getPersonalizationValue, getTextColorStyle, getTextClass } from '../../../models/personalization.model';
import { ATTRIBUTE_GROUP_SKILLS, ATTRIBUTE_GROUP_LABEL, ATTRIBUTE_GROUP_ICON, SKILL, SKILL_LABEL, AttributeGroupCode, SkillCode } from '../../../models/irpw-attributes-skills.model';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { getImageByUsageKey } from '../../../models/image.model';
import { Specie } from '../../../models/specie.model';
import { IrpwAbilityMechanicsComponent } from '../irpw-ability-mechanics/irpw-ability-mechanics.component';
import { normalizeAbilityMechanics, abilitySummary, changeAbilityType } from '../../../models/irpw-ability.model';
import { IrpwHabilityType, IrpwVocation, IrpwVocationAttributes, IrpwVocationHability } from '../../../models/irpw-vocation.model';
import {
  getIronpawLifeMinimum,
  getVocationSkillMinimums,
  IrpwPerceptions,
  normalizeIrpwInteger,
  parseIrpwPerceptions,
} from '../../../models/irpw-rules.model';
import { IrpwSpecieService } from '../../../services/irpw-specie.service';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';
import { SpecieService } from '../../../services/specie.service';
import { NavButtonComponent } from '../../../components/nav-button/nav-button.component';
import { IrpwInventoryComponent } from '../irpw-inventory/irpw-inventory.component';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import {
  ActiveConditionState,
  CONDITION,
  CONDITION_CATEGORY,
  CONDITION_CATEGORY_LABEL,
  CONDITION_SEVERITY,
  CONDITION_SEVERITY_LABEL,
  CONDITIONS,
  ConditionCategoryCode,
  ConditionCode,
  ConditionDefinition,
  ConditionSeverityCode,
} from '../../../models/irpw-conditions.model';
import {
  calculateDefensePointsMax,
  IRPW_EQUIPMENT_SLOT_LABEL,
  IRPW_EQUIPMENT_SLOTS,
  IrpwDefensePointsEnvelope,
  IrpwEquipmentSlot,
  IrpwInventoryEntry,
  parseIrpwDefensePoints,
  parseIrpwInventory,
  protectionContribution,
} from '../../../models/irpw-item.model';
import { IrpwConditionCatalogService } from '../../../services/irpw-condition-catalog.service';

type RollBonusSourceType = 'attribute' | 'perception';
type RollFormulaMode = 'auto' | 'manual';
type PerceptionKey = 'smell' | 'vision' | 'hearing';
type RollStatus = 'success' | 'near' | 'fail' | 'neutral';
type RollResolutionMode = 'normal' | 'disadvantage';

interface RollOption<TValue extends string> {
  id: TValue;
  name: string;
}

interface RollModifier {
  key: string;
  label: string;
  value: number;
  category: 'skill' | 'source' | 'manual' | 'condition';
  displayValue?: string;
}

interface RollPreview {
  attempts: number;
  sides: number;
  modifiers: RollModifier[];
  totalModifier: number;
  resolutionMode: RollResolutionMode;
}

interface RollResult {
  index: number;
  dieValue: number;
  rolls: number[];
  modifier: number;
  total: number;
  status: RollStatus;
  resolutionLabel: string;
}

interface ParsedConditionImpact {
  key: string;
  label: string;
  type: 'modifier' | 'minus-dice' | 'disadvantage';
  value: number;
  displayValue: string;
}

interface IrpwCharacterMark {
  name?: string | null;
  description: string;
  narrativeType?: string | null;
  weaknesses: IrpwVocationHability[];
  habilities: IrpwVocationHability[];
  attributes: IrpwVocationAttributes;
}

interface CharacterAbilityShortcut extends IrpwVocationHability {
  favoriteKey: string;
  sourceLabel: string;
  source?: 'species' | 'vocation';
}

interface InheritedCharacterHability extends CharacterAbilityShortcut {
  source: 'species' | 'vocation';
}

interface EquippedAttackShortcut {
  favoriteKey: string;
  entry: IrpwInventoryEntry;
  slot: 'primary' | 'secondary';
  slotLabel: string;
  skillCode: SkillCode;
  skillLabel: string;
}

interface EquippedEquipmentSummary {
  entry: IrpwInventoryEntry;
  slot: IrpwEquipmentSlot;
  slotLabel: string;
  effects: string;
}

type ResourceKey = 'stress' | 'mana' | 'vigor';
type ReserveResourceKey = 'mana' | 'vigor';
type StressThresholdKey = 'anxious' | 'troubled' | 'disturbed' | 'lost';
type StressStateKey = 'calm' | StressThresholdKey;

interface StressThresholdConfig {
  anxious: number;
  troubled: number;
  disturbed: number;
  lost: number;
}

interface ResourceValueState {
  currentPoints: number | null;
  maxPoints: number | null;
  stressThresholds?: StressThresholdConfig;
}

@Component({
  selector: 'irpw-character-sheet',
  imports: [IconButtonComponent, EntityHistoryContextDirective, HistoryFieldDirective, CommonModule, NgClass, FormsModule, OverlayModule, ComboBoxComponent, NavButtonComponent, AssetUrlPipe, IrpwInventoryComponent, IrpwAbilityMechanicsComponent],
  templateUrl: './irpw-character-sheet.component.html',
  styleUrl: './irpw-character-sheet.component.css',
})
export class IrpwCharacterSheetComponent implements OnInit {
  private readonly entityHistory = inject(EntityHistoryService);
  readonly readSubspecializationHistory = (): string => this.currentSheet?.subspecialization || '';
  readonly readHabilitiesHistory = (): string => this.currentSheet?.habilities || '';
  restoreSheetHistory(): void {
    this.parseAttributes();
    this.parseSubspecializations();
    this.parseHabilities();
    this.parseLifepoints();
    this.parseSeriousWounds();
    this.parseConditions();
    this.parseMarks();
  }
  private readonly destroyRef = inject(DestroyRef);
  private dialog = inject(Dialog);
  private characterService = inject(CharacterService);
  private specieService = inject(SpecieService);
  private irpwSpecieService = inject(IrpwSpecieService);
  private vocationService = inject(IrpwVocationService);
  private worldService = inject(WorldService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);
  private currentEntityPageStateService = inject(CurrentEntityPageStateService);
  private sheetService = inject(IrpwCharacterSheetService);
  private readonly conditionCatalog = inject(IrpwConditionCatalogService);
  private readonly itemCatalog = inject(IrpwItemCatalogService);

  characterIdInput = input<string>('');
  private readonly catalogChangesEffect = effect(() => {
    this.itemCatalog.changes();
    if (!this.selectedCharacterId || !this.currentSheet) return;
    const latest = this.sheetService.getSheet(this.selectedCharacterId);
    if (latest) {
      this.currentSheet.inventory = latest.inventory;
      this.currentSheet.defensepoints = latest.defensepoints;
      this.parseDefensepoints();
    }
  });

  private syncInputSelectionEffect = effect(() => {
    const characterId = this.characterIdInput().trim();
    if (!characterId || characterId === this.selectedCharacterId) {
      return;
    }

    this.selectCharacter(characterId, true);
  });

  availableWorlds: World[] = [];
  availableSpecies: Specie[] = [];
  availableVocations: IrpwVocation[] = [];
  characters: Character[] = [];
  filteredCharacters: Character[] = [];

  selectedWorldId = '';
  selectedSpecieId = '';
  selectedVocationId = '';
  searchTerm = '';
  showSidebar = true;

  currentTab = 'general';

  selectedCharacterId = '';
  selectedCharacter: Character | null = null;
  currentSheet: IrpwCharacterSheet | null = null;

  isSaving = false;
  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 600);
  isLifeSettingsOpen = false;
  pendingLifeMaxPoints: number | null = null;
  pendingLifeTemporaryPoints = 0;
  isResistanceSettingsOpen = false;
  pendingResistanceMaxPoints = 0;
  pendingResistanceTemporaryPoints = 0;
  isStressSettingsOpen = false;
  pendingStressThresholds: StressThresholdConfig = { anxious: 10, troubled: 20, disturbed: 30, lost: 40 };
  isConditionSettingsOpen = false;

  perceptionsData: IrpwPerceptions = { smell: null, vision: null, hearing: null };
  vocationSkillMinimums: Record<SkillCode, number> = {} as Record<SkillCode, number>;

  conjurationAttribute: AttributeGroupCode | null = null;
  conjurationLevel = 0;
  readonly abilitySummary = abilitySummary;
  abilityGradeTone(ability: IrpwVocationHability): string {
    if (ability.type === 'passive') return 'passive';
    if (ability.grade === 'master' || ability.grade === 'major') return 'master';
    if (ability.grade === 'intermediate' || ability.grade === 'medium') return 'intermediate';
    return 'basic';
  }
  readonly abilitySkillOptions = Object.entries(SKILL_LABEL).map(([id, name]) => ({ id: id as SkillCode, name }));

  attributesData: Record<string, { value: number | null; skills: Record<string, number> }> = {};
  subspecializationsData: string[] = [''];
  habilitiesData: IrpwVocationHability[] = [];
  inheritedHabilitiesData: InheritedCharacterHability[] = [];
  favoriteActionsData: string[] = [];
  activeAbilityDetail: { name: string; description: string } | null = null;
  marksData: IrpwCharacterMark[] = [];
  activeConditionsData: ActiveConditionState[] = [];
  pendingConditionsData: ActiveConditionState[] = [];
  seriousWoundCount = 0;
  expandedMarkIndexes = new Set<number>();
  readonly attributeGroupEntries = Object.entries(ATTRIBUTE_GROUP_SKILLS) as [AttributeGroupCode, SkillCode[]][];
  readonly attributeGroupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly attributeGroupIcon = ATTRIBUTE_GROUP_ICON;
  readonly skillLabel = SKILL_LABEL;
  readonly conditionCategories: ConditionCategoryCode[] = [
    CONDITION_CATEGORY.ATTRIBUTE,
    CONDITION_CATEGORY.SPECIAL,
    CONDITION_CATEGORY.PERSISTENT_DAMAGE,
    CONDITION_CATEGORY.CRITICAL_STATE,
  ];
  readonly conditionCategoryLabel = CONDITION_CATEGORY_LABEL;
  readonly conditionSeverityLabel = CONDITION_SEVERITY_LABEL;
  conditionDefinitions: ConditionDefinition[] = this.conditionCatalog.getDefinitions();
  readonly habilityTypeOptions: { value: IrpwHabilityType; label: string }[] = [
    { value: 'technical', label: 'Poder' },
    { value: 'magic', label: 'Magia' },
    { value: 'passive', label: 'Passiva' },
  ];
  readonly rollBonusSourceOptions: RollOption<RollBonusSourceType>[] = [
    { id: 'attribute', name: 'Atributo da perícia' },
    { id: 'perception', name: 'Percepção específica' },
  ];
  readonly rollPerceptionOptions: RollOption<PerceptionKey>[] = [
    { id: 'smell', name: 'Olfato' },
    { id: 'vision', name: 'Visão' },
    { id: 'hearing', name: 'Audição' },
  ];
  get rollSkillOptions() {
    return this.attributeGroupEntries.flatMap(([group]) => this.getAttributeSkills(group).map(skill => ({ id: skill, name: this.skillLabel[skill] + ' · ' + this.attributeGroupLabel[group] })));
  }
  private get skillToAttributeGroup(): Record<SkillCode, AttributeGroupCode> {
    const mapping = this.attributeGroupEntries.reduce((accumulator, [group, skills]) => {
    for (const skill of skills) {
      accumulator[skill] = group;
    }
    return accumulator;
  }, {} as Record<SkillCode, AttributeGroupCode>);
    if (this.conjurationAttribute) mapping.CONJURATION = this.conjurationAttribute;
    return mapping;
  }

  lifepointsData: { maxPoints: number | null; currentPoints: number | null; temporaryPoints?: number; temporaryCurrentPoints?: number } = { maxPoints: null, currentPoints: null };
  defensepointsData: IrpwDefensePointsEnvelope = parseIrpwDefensePoints(null);
  resourceData: Record<ResourceKey, ResourceValueState> = {
    stress: { currentPoints: 0, maxPoints: null },
    mana: { currentPoints: null, maxPoints: null },
    vigor: { currentPoints: null, maxPoints: null },
  };
  readonly defaultStressThresholds: StressThresholdConfig = { anxious: 10, troubled: 20, disturbed: 30, lost: 40 };

  get stressThresholds(): Array<{ key: StressThresholdKey; value: number; label: string; position: number }> {
    const thresholds = this.getStressThresholdConfig();
    const maximum = Math.max(1, thresholds.lost);
    return [
      { key: 'anxious', value: thresholds.anxious, label: 'Ansioso', position: thresholds.anxious / maximum * 100 },
      { key: 'troubled', value: thresholds.troubled, label: 'Transtornado', position: thresholds.troubled / maximum * 100 },
      { key: 'disturbed', value: thresholds.disturbed, label: 'Perturbado', position: thresholds.disturbed / maximum * 100 },
      { key: 'lost', value: thresholds.lost, label: 'Perdido', position: 100 },
    ];
  }
  get lifeSegments(): number[] {
    return Array.from({ length: this.getMaxLifePoints() }, (_, index) => index + 1);
  }
  get resistanceSegments(): number[] {
    return Array.from({ length: Math.ceil(this.getMaxDefensePoints()) }, (_, index) => index + 1);
  }

  get temporaryLifeSegments(): number[] { return Array.from({ length: this.lifepointsData.temporaryPoints ?? 0 }, (_, i) => i + 1); }
  get temporaryResistanceSegments(): number[] { return Array.from({ length: this.defensepointsData.temporaryPoints ?? 0 }, (_, i) => i + 1); }

  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;
  public getTextClass = getTextClass;
  public getImageByUsageKey = getImageByUsageKey;

  isRollPanelOpen = false;
  rollShortcutLabel = '';
  selectedRollSkill: SkillCode | null = null;
  selectedRollBonusSource: RollBonusSourceType = 'attribute';
  selectedRollPerception: PerceptionKey | null = null;
  rollManualModifier: number | null = 0;
  rollTargetValue: number | null = null;
  rollFormula = '1d10';
  rollFormulaMode: RollFormulaMode = 'auto';
  rollFormulaError = '';
  rollPreview: RollPreview = { attempts: 1, sides: 10, modifiers: [], totalModifier: 0, resolutionMode: 'normal' };
  rollResults: RollResult[] = [];
  lastRollFormula = '';

  selectTab(tab: string): void {
    if (tab === 'inventory') {
      this.saveTask.flush();
    } else if (this.currentTab === 'inventory') {
      this.refreshSheetFromStorage();
    }
    this.currentTab = tab;
    this.currentEntityPageStateService.setCurrentTab('CharacterSheet', this.selectedCharacterId || this.characterIdInput(), tab);
  }

  private refreshSheetFromStorage(): void {
    if (!this.selectedCharacterId) return;
    const latest = this.sheetService.getSheet(this.selectedCharacterId);
    if (!latest) return;
    this.currentSheet = latest;
    this.parseHabilities();
    this.parseFavoriteActions();
    this.parseLifepoints();
    this.parseSeriousWounds();
    this.parseDefensepoints();
    this.parseResources();
    this.parseConditions();
    this.parseMarks();
    this.refreshInheritedHabilities();
  }

  private restoreCurrentTab(characterId: string): void {
    this.currentTab = this.currentEntityPageStateService.getCurrentTab('CharacterSheet', characterId, 'general');
  }

  ngOnInit() {
    this.restoreCurrentTab(this.characterIdInput());
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      if (this.characterIdInput()) {
        return;
      }

      const nextWorldId = world ? world.id : '';
      if (this.selectedWorldId === nextWorldId) return;
      this.selectedWorldId = nextWorldId;
      this.loadCharacters();
    });

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.table === 'Character' || event.table === 'Species' || event.table === 'IRPWSpecie' || event.table === 'IRPWVocation' || event.table === 'Relationship') {
        this.loadCharacters();
        this.loadSpecies();
        this.loadVocations();
      }
    });

    this.availableWorlds = this.worldService.getWorlds();
    this.loadSpecies();
    this.loadVocations();
    this.loadCharacters();

    const initialCharacterId = this.characterIdInput();
    if (initialCharacterId) {
      this.selectCharacter(initialCharacterId, true);
    }

    this.syncRollFormula();
  }

  loadSpecies() {
    this.availableSpecies = this.specieService
      .getSpecies(null, this.selectedWorldId || null)
      .sort((left, right) => (left.name || 'Espécie sem nome').localeCompare(right.name || 'Espécie sem nome'));
  }

  loadVocations() {
    this.availableVocations = this.vocationService
      .getVocations()
      .sort((left, right) => (left.name || 'Vocação sem nome').localeCompare(right.name || 'Vocação sem nome'));
  }

  loadCharacters() {
    const worldFilter = this.characterIdInput() ? null : (this.selectedWorldId || null);

    this.characters = this.characterService
      .getCharacters(worldFilter)
      .sort((a, b) => a.name.localeCompare(b.name));

    this.applySearch();

    const preferredCharacterId = this.characterIdInput() || this.selectedCharacterId;

    if (preferredCharacterId && !this.characters.some(c => c.id === preferredCharacterId)) {
      if (this.characterIdInput()) {
        this.selectCharacter(preferredCharacterId, true);
        return;
      }

      this.clearSelectedCharacterState();
    } else if (preferredCharacterId) {
      this.selectedCharacterId = preferredCharacterId;
      this.selectedCharacter = this.characters.find(c => c.id === preferredCharacterId) ?? this.selectedCharacter;
      this.selectedSpecieId = this.selectedCharacter?.ParentSpecies?.id ?? '';
      if (this.selectedSpecieId) {
        this.irpwSpecieService.ensureConfig(this.selectedSpecieId);
      }
      this.selectedVocationId = this.selectedCharacter?.ParentIRPWVocation?.id ?? '';
      this.refreshVocationSkillMinimums();
      this.refreshInheritedHabilities();
    }
  }

  onWorldSelect() {
    this.loadSpecies();
    this.loadCharacters();
  }

  onSearch() {
    this.applySearch();
  }

  applySearch() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredCharacters = term
      ? this.characters.filter(c => c.name.toLowerCase().includes(term))
      : [...this.characters];
  }

  selectCharacter(characterId: string, force = false) {
    if (!force && this.selectedCharacterId === characterId) return;
    if (this.selectedCharacterId && (force || this.selectedCharacterId !== characterId)) {
      this.saveTask.flush();
    }

    this.selectedCharacterId = characterId;
    this.activeAbilityDetail = null;
    this.rollShortcutLabel = '';
    this.restoreCurrentTab(characterId);
    this.selectedCharacter = this.characters.find(c => c.id === characterId) ?? null;
    if (!this.selectedCharacter) {
      try {
        this.selectedCharacter = this.characterService.getCharacter(characterId) ?? null;
      } catch {
        this.selectedCharacter = null;
      }
    }

    if (!this.selectedCharacter) {
      this.clearSelectedCharacterState();
      return;
    }

    this.closeStressSettingsOverlay();
    this.selectedSpecieId = this.selectedCharacter?.ParentSpecies?.id ?? '';
    if (this.selectedSpecieId) {
      this.irpwSpecieService.ensureConfig(this.selectedSpecieId);
    }
    this.selectedVocationId = this.selectedCharacter?.ParentIRPWVocation?.id ?? '';
    this.refreshVocationSkillMinimums();
    this.currentSheet = this.sheetService.getSheet(characterId);

    if (!this.currentSheet) {
      this.currentSheet = new IrpwCharacterSheet(characterId);
      this.currentSheet = this.sheetService.saveSheet(characterId, this.currentSheet);
    }

    this.parsePerceptions();
    this.parseAttributes();
    this.parseSubspecializations();
    this.parseHabilities();
    this.parseFavoriteActions();
    this.parseLifepoints();
    this.parseSeriousWounds();
    this.parseDefensepoints();
    this.parseResources();
    this.parseConditions();
    this.parseMarks();
    this.refreshInheritedHabilities();
    this.syncRollFormula();
  }

  private parseFavoriteActions(): void {
    try {
      const value = this.currentSheet?.favoriteActions ? JSON.parse(this.currentSheet.favoriteActions) : [];
      this.favoriteActionsData = Array.isArray(value)
        ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
        : [];
    } catch {
      this.favoriteActionsData = [];
    }
  }

  private clearSelectedCharacterState() {
    this.selectedCharacterId = '';
    this.selectedSpecieId = '';
    this.selectedVocationId = '';
    this.vocationSkillMinimums = {} as Record<SkillCode, number>;
    this.selectedCharacter = null;
    this.currentSheet = null;
    this.subspecializationsData = [''];
    this.habilitiesData = [];
    this.inheritedHabilitiesData = [];
    this.favoriteActionsData = [];
    this.activeAbilityDetail = null;
    this.activeConditionsData = [];
    this.pendingConditionsData = [];
    this.seriousWoundCount = 0;
    this.marksData = [];
    this.lifepointsData = { maxPoints: null, currentPoints: null };
    this.defensepointsData = parseIrpwDefensePoints(null);
    this.closeStressSettingsOverlay();
    this.rollShortcutLabel = '';
    this.expandedMarkIndexes.clear();
  }

  private refreshVocationSkillMinimums(): void {
    this.vocationSkillMinimums = getVocationSkillMinimums(this.selectedCharacter?.ParentIRPWVocation?.attributes);
  }

  getSpeciesPerceptionBase(key: PerceptionKey): number | null {
    if (!this.selectedSpecieId) return null;
    const config = this.irpwSpecieService.getConfig(this.selectedSpecieId);
    return parseIrpwPerceptions(config?.perceptions)[key];
  }

  getSpeciesBaseHealthLabel(): string {
    const value = this.selectedSpecieId ? this.irpwSpecieService.getConfig(this.selectedSpecieId)?.basehealth : null;
    return value?.trim() ? `${value} CV` : 'Não definida';
  }

  getVocationBaseHealthLabel(): string {
    const value = this.selectedCharacter?.ParentIRPWVocation?.basehealth;
    return value?.trim() ? `${value} CV` : 'Não definida';
  }

  getVocationBaseDefenseLabel(): string {
    const value = this.selectedCharacter?.ParentIRPWVocation?.basedefense;
    return value?.trim() ? `${value} CR` : 'Não definida';
  }

  getVocationSkillMinimumSummary(): string {
    const minimums = Object.values(SKILL)
      .map(skill => ({ skill, level: this.vocationSkillMinimums[skill] ?? 0 }))
      .filter(item => item.level > 0)
      .map(item => `${SKILL_LABEL[item.skill]} · ${this.getSkillLevelLabel(item.level)}`);
    return minimums.length ? minimums.join(', ') : 'Sem perícias mínimas definidas';
  }

  getSpeciesPerceptionTooltip(key: PerceptionKey): string {
    const labels: Record<PerceptionKey, string> = {
      smell: 'Olfato',
      vision: 'Visão',
      hearing: 'Audição',
    };
    const base = this.getSpeciesPerceptionBase(key);
    return base === null ? '' : `${labels[key]}: mínimo da espécie ${base}`;
  }

  isSkillAtVocationMinimum(group: string, skill: string): boolean {
    const minimum = this.vocationSkillMinimums[skill as SkillCode] ?? 0;
    return minimum > 0 && this.getSkillLevel(group, skill) === minimum;
  }

  getVocationMinimumTooltip(skill: string): string {
    const minimum = this.vocationSkillMinimums[skill as SkillCode] ?? 0;
    return minimum > 0 ? `${SKILL_LABEL[skill as SkillCode]}: mínimo da vocação ${minimum}` : '';
  }

  private clampAttributesToVocationMinimums(): void {
    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        const minimum = this.vocationSkillMinimums[skill] ?? 0;
        const current = this.normalizeSkillLevel(this.attributesData[group]?.skills[skill]);
        this.attributesData[group].skills[skill] = Math.max(current, minimum);
      }
    }
  }

  private resetSkillsToVocationMinimums(): void {
    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        this.attributesData[group].skills[skill] = this.vocationSkillMinimums[skill] ?? 0;
      }
    }
  }

  private clampPerceptionsToSpeciesMinimums(): void {
    for (const key of ['smell', 'vision', 'hearing'] as PerceptionKey[]) {
      const base = this.getSpeciesPerceptionBase(key);
      const current = normalizeIrpwInteger(this.perceptionsData[key]);
      this.perceptionsData[key] = base === null ? current : Math.max(base, current ?? base);
    }
  }

  private applySpeciesPerceptionMinimums(specieId: string | null): void {
    this.perceptionsData = specieId
      ? parseIrpwPerceptions(this.irpwSpecieService.ensureConfig(specieId).perceptions)
      : { smell: null, vision: null, hearing: null };
    this.onPerceptionsChange();
  }

  private getLifeMinimum(): number {
    const vocationBaseHealth = this.selectedCharacter?.ParentIRPWVocation?.basehealth;
    const speciesBaseHealth = this.selectedSpecieId
      ? this.irpwSpecieService.getConfig(this.selectedSpecieId)?.basehealth
      : null;
    return getIronpawLifeMinimum(vocationBaseHealth, speciesBaseHealth);
  }

  private recalculateLifeMinimum(): void {
    if (!this.currentSheet) return;

    const minimum = this.getLifeMinimum();
    this.lifepointsData.maxPoints = minimum;

    this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, minimum);
    this.currentSheet.lifepoints = JSON.stringify(this.lifepointsData);
    this.scheduleAutoSave();
  }

  async openSpeciesConfig(): Promise<void> {
    if (!this.selectedSpecieId) return;

    this.irpwSpecieService.ensureConfig(this.selectedSpecieId);
    const { IrpwSpecieConfigComponent } = await import('../irpw-specie-config/irpw-specie-config.component');
    const dialogRef = this.dialog.open(IrpwSpecieConfigComponent, {
      data: { id: this.selectedSpecieId },
      panelClass: ['screen-dialog', 'ironpaw-dialog', 'max-w-none', 'max-h-none', 'overflow-hidden'],
      height: '80vh',
      width: '80vw',
      autoFocus: false,
      restoreFocus: false,
    });

    dialogRef.closed.subscribe(() => {
      this.loadSpecies();
      this.refreshInheritedHabilities();
      this.applySpeciesPerceptionMinimums(this.selectedSpecieId);
      this.recalculateLifeMinimum();
    });
  }

  createVocationForCharacter(): void {
    if (!this.selectedCharacterId || !this.selectedCharacter || this.selectedVocationId) return;

    const createdVocation = this.vocationService.saveVocation(new IrpwVocation());
    this.loadVocations();
    this.selectedVocationId = createdVocation.id;
    this.onVocationSelect();
    void this.openVocationConfig();
  }

  async openVocationConfig(): Promise<void> {
    if (!this.selectedVocationId) return;

    const { IrpwVocationConfigComponent } = await import('../irpw-vocation-config/irpw-vocation-config.component');
    const dialogRef = this.dialog.open(IrpwVocationConfigComponent, {
      data: { id: this.selectedVocationId },
      panelClass: ['screen-dialog', 'ironpaw-dialog', 'max-w-none', 'max-h-none', 'overflow-hidden'],
      height: '80vh',
      width: '80vw',
      autoFocus: false,
      restoreFocus: false,
    });

    dialogRef.closed.subscribe(() => {
      this.loadVocations();
      const latestVocation = this.vocationService.getVocation(this.selectedVocationId);
      if (latestVocation && this.selectedCharacter) {
        this.selectedCharacter = { ...this.selectedCharacter, ParentIRPWVocation: latestVocation };
      }
      this.refreshVocationSkillMinimums();
      this.refreshInheritedHabilities();
      this.recalculateLifeMinimum();
      this.parseDefensepoints();
    });
  }

  async openConditionCatalog(): Promise<void> {
    this.closeConditionSettingsOverlay();
    const { IrpwConditionsComponent } = await import('../irpw-conditions/irpw-conditions.component');
    const dialogRef = this.dialog.open(IrpwConditionsComponent, {
      panelClass: ['screen-dialog', 'ironpaw-dialog', 'max-w-none', 'max-h-none', 'overflow-hidden'],
      height: '86vh',
      width: 'min(88vw, 78rem)',
      autoFocus: false,
      restoreFocus: false,
    });

    dialogRef.closed.subscribe(saved => {
      if (!saved) return;
      this.conditionDefinitions = this.conditionCatalog.getDefinitions();
      this.activeConditionsData = this.normalizeActiveConditions(this.activeConditionsData);
      this.pendingConditionsData = this.activeConditionsData.map(condition => ({ ...condition }));
      this.updateRollFormulaIfAuto();
    });
  }

  onSpecieSelect() {
    if (!this.selectedCharacterId || !this.selectedCharacter) return;
    const previousSpecieId = this.selectedCharacter.ParentSpecies?.id ?? null;

    const normalizedSpecieId = this.selectedSpecieId || null;
    this.characterService.saveCharacterSpecie(this.selectedCharacterId, normalizedSpecieId);

    const parentSpecie = normalizedSpecieId
      ? this.availableSpecies.find(specie => specie.id === normalizedSpecieId) ?? null
      : null;

    this.selectedCharacter = {
      ...this.selectedCharacter,
      ParentSpecies: parentSpecie,
    };

    this.characters = this.characters.map(character =>
      character.id === this.selectedCharacterId
        ? { ...character, ParentSpecies: parentSpecie }
        : character
    );

    this.filteredCharacters = this.filteredCharacters.map(character =>
      character.id === this.selectedCharacterId
        ? { ...character, ParentSpecies: parentSpecie }
        : character
    );
    if (previousSpecieId !== normalizedSpecieId) {
      if (normalizedSpecieId) {
        this.irpwSpecieService.ensureConfig(normalizedSpecieId);
      }
      this.applySpeciesPerceptionMinimums(normalizedSpecieId);
      this.recalculateLifeMinimum();
    }


    this.refreshInheritedHabilities();
  }

  onVocationSelect() {
    if (!this.selectedCharacterId || !this.selectedCharacter) return;
    const previousVocationId = this.selectedCharacter.ParentIRPWVocation?.id ?? null;

    const normalizedVocationId = this.selectedVocationId || null;
    this.characterService.saveCharacterVocation(this.selectedCharacterId, normalizedVocationId);

    const parentVocation = normalizedVocationId
      ? this.availableVocations.find(vocation => vocation.id === normalizedVocationId) ?? null
      : null;

    this.selectedCharacter = {
      ...this.selectedCharacter,
      ParentIRPWVocation: parentVocation,
    };

    this.characters = this.characters.map(character =>
      character.id === this.selectedCharacterId
        ? { ...character, ParentIRPWVocation: parentVocation }
        : character
    );

    this.filteredCharacters = this.filteredCharacters.map(character =>
      character.id === this.selectedCharacterId
        ? { ...character, ParentIRPWVocation: parentVocation }
        : character
    );
    if (previousVocationId !== normalizedVocationId) {
      this.refreshVocationSkillMinimums();
      this.resetSkillsToVocationMinimums();
      this.onAttributesChange();
      this.recalculateLifeMinimum();
      this.parseDefensepoints();
    }


    this.refreshInheritedHabilities();
  }

  async openCharacterEditor() {
    if (!this.selectedCharacterId) return;

    const { CharacterEditComponent } = await import('../../characters/character-edit/character-edit.component');
    const dialogRef = this.dialog.open(CharacterEditComponent, {
      data: { id: this.selectedCharacterId },
      panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'],
      height: '80vh',
      width: '80vw',
      autoFocus: false,
      restoreFocus: false,
    });

    dialogRef.closed.subscribe(() => {
      this.loadCharacters();
    });
  }

  parsePerceptions() {
    this.perceptionsData = parseIrpwPerceptions(this.currentSheet?.perceptions);
    this.clampPerceptionsToSpeciesMinimums();
  }

  onPerceptionsChange() {
    if (this.currentSheet) {
      this.clampPerceptionsToSpeciesMinimums();
      this.currentSheet.perceptions = JSON.stringify(this.perceptionsData);
      this.scheduleAutoSave();
    }
    this.updateRollFormulaIfAuto();
  }

  parseAttributes() {
    let parsed: Record<string, { value: number | null; skills: Record<string, number> }> = {};
    try {
      parsed = this.currentSheet?.attributes ? JSON.parse(this.currentSheet.attributes) : {};
    } catch { /* ignore */ }

    const result: Record<string, { value: number | null; skills: Record<string, number> }> = {};
    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      result[group] = { value: parsed[group]?.value ?? null, skills: {} };
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        result[group].skills[skill] = this.normalizeSkillLevel(parsed[group]?.skills?.[skill]);
      }
    }
    const conjuration = (parsed as unknown as { _conjuration?: { attribute?: AttributeGroupCode; level?: number } })._conjuration;
    this.conjurationAttribute = conjuration?.attribute && Object.hasOwn(ATTRIBUTE_GROUP_SKILLS, conjuration.attribute) ? conjuration.attribute : null;
    this.conjurationLevel = this.normalizeSkillLevel(conjuration?.level);
    this.attributesData = result;
    this.clampAttributesToVocationMinimums();
  }

  onAttributesChange() {
    if (this.currentSheet) {
      this.clampAttributesToVocationMinimums();
      this.currentSheet.attributes = JSON.stringify({ ...this.attributesData, _conjuration: { attribute: this.conjurationAttribute, level: this.conjurationLevel } });
      this.scheduleAutoSave();
    }
    this.updateRollFormulaIfAuto();
  }

  parseSubspecializations() {
    if (!this.currentSheet?.subspecialization) {
      this.subspecializationsData = [''];
      return;
    }

    try {
      const parsed = JSON.parse(this.currentSheet.subspecialization);
      this.subspecializationsData = this.normalizeSubspecializations(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.subspecializationsData = [''];
    }
  }

  onSubspecializationChange(index: number, value: string) {
    const nextValues = [...this.subspecializationsData];
    nextValues[index] = value;
    this.subspecializationsData = this.normalizeSubspecializations(nextValues);

    if (this.currentSheet) {
      const filledValues = this.subspecializationsData.filter(item => item.trim().length > 0);
      this.currentSheet.subspecialization = filledValues.length ? JSON.stringify(filledValues) : null;
      this.scheduleAutoSave();
    }
  }

  parseHabilities() {
    if (!this.currentSheet?.habilities) {
      this.habilitiesData = [];
      return;
    }

    try {
      const parsed = JSON.parse(this.currentSheet.habilities);
      this.habilitiesData = Array.isArray(parsed)
        ? parsed.map((hability, index) => this.normalizeHability(hability, `character:${this.selectedCharacterId}:ability:${index}`))
        : [];
    } catch {
      this.habilitiesData = [];
    }
  }

  onHabilitiesChange() {
    this.habilitiesData = this.habilitiesData.map((hability, index) => this.normalizeHability(hability, `character:${this.selectedCharacterId}:ability:${index}`));

    if (this.currentSheet) {
      this.currentSheet.habilities = this.habilitiesData.length ? JSON.stringify(this.habilitiesData) : null;
      this.scheduleAutoSave();
    }
  }

  addHability(type: IrpwHabilityType = 'technical') {
    this.habilitiesData = [...this.habilitiesData, { ...this.createEmptyHability(), type, rollSkill: type === 'magic' ? SKILL.CONJURATION : null }];
    this.onHabilitiesChange();
  }

  setHabilityType(index: number, type: IrpwHabilityType): void {
    this.habilitiesData = this.habilitiesData.map((ability, i) => i === index ? changeAbilityType(ability, type) : ability);
    this.onHabilitiesChange();
  }

  removeHability(index: number) {
    const removed = this.habilitiesData[index];
    if (removed) this.favoriteActionsData = this.favoriteActionsData.filter(key => key !== this.getOwnedAbilityFavoriteKey(removed, index));
    this.habilitiesData = this.habilitiesData.filter((_, currentIndex) => currentIndex !== index);
    this.onHabilitiesChange();
  }

  getOwnHabilitiesByType(type: IrpwHabilityType): Array<CharacterAbilityShortcut & { index: number }> {
    return this.habilitiesData
      .map((hability, index) => ({
        ...hability,
        type: this.normalizeHabilityType(hability.type, 'technical'),
        favoriteKey: this.getOwnedAbilityFavoriteKey(hability, index),
        sourceLabel: 'Personagem',
        index,
      }))
      .filter(hability => hability.type === type);
  }

  getInheritedHabilitiesByType(type: IrpwHabilityType): InheritedCharacterHability[] {
    return this.inheritedHabilitiesData.filter(hability => hability.type === type);
  }

  getInheritedHabilitiesBySource(source: 'species' | 'vocation'): InheritedCharacterHability[] {
    return this.inheritedHabilitiesData.filter(hability => hability.source === source);
  }

  getSpeciesWeaknesses(): IrpwVocationHability[] {
    const specieId = this.selectedCharacter?.ParentSpecies?.id;
    const raw = specieId ? this.irpwSpecieService.getConfig(specieId)?.weakness : null;
    return this.parseHabilityList(raw, `species:${specieId ?? 'none'}:weakness`, 'passive');
  }

  getEquippedAttacks(): EquippedAttackShortcut[] {
    const inventory = parseIrpwInventory(this.currentSheet?.inventory);
    if (!inventory) return [];
    return (['primary', 'secondary'] as const).flatMap(slot => {
      const instanceId = inventory.equipment[slot];
      const entry = instanceId ? inventory.entries.find(candidate => candidate.instanceId === instanceId) : undefined;
      if (!entry || entry.snapshot.definition.category !== 'weapon') return [];
      const skillCode = entry.snapshot.definition.weapon?.attackSkill ?? SKILL.FIGHT;
      return [{
        favoriteKey: `attack:${entry.instanceId}`,
        entry,
        slot,
        slotLabel: IRPW_EQUIPMENT_SLOT_LABEL[slot],
        skillCode,
        skillLabel: SKILL_LABEL[skillCode],
      }];
    });
  }

  getEquippedEquipment(): EquippedEquipmentSummary[] {
    const inventory = parseIrpwInventory(this.currentSheet?.inventory);
    if (!inventory) return [];
    return IRPW_EQUIPMENT_SLOTS.flatMap(slot => {
      const instanceId = inventory.equipment[slot];
      const entry = instanceId ? inventory.entries.find(candidate => candidate.instanceId === instanceId) : undefined;
      return entry ? [{ entry, slot, slotLabel: IRPW_EQUIPMENT_SLOT_LABEL[slot], effects: this.getEquipmentEffectSummary(entry) }] : [];
    });
  }

  getEquipmentEffectSummary(entry: IrpwInventoryEntry): string {
    const definition = entry.snapshot.definition;
    const catalogEffects = !entry.snapshot.effects?.trim() && entry.sourceItemId
      ? this.itemCatalog.getItem(entry.sourceItemId)?.effects
      : null;
    const values = [
      entry.snapshot.effects || catalogEffects,
      entry.snapshot.description,
      definition.protection?.effects,
      definition.weapon?.specialProperty,
      definition.consumable?.effect,
      definition.toolPurpose,
      definition.narrativeEffect,
      ...definition.uniqueBenefits,
      ...definition.uniqueCosts,
    ];
    return [...new Set(values.map(value => value?.trim()).filter((value): value is string => !!value))].join(' · ');
  }

  getFavoriteAttacks(): EquippedAttackShortcut[] {
    return this.getEquippedAttacks().filter(attack => this.isActionFavorite(attack.favoriteKey));
  }

  getFavoriteHabilities(): CharacterAbilityShortcut[] {
    const own = this.habilitiesData.map((hability, index) => ({
      ...hability,
      type: this.normalizeHabilityType(hability.type, 'technical'),
      favoriteKey: this.getOwnedAbilityFavoriteKey(hability, index),
      sourceLabel: 'Personagem',
    }));
    return [...own, ...this.inheritedHabilitiesData].filter(hability => this.isActionFavorite(hability.favoriteKey));
  }

  isActionFavorite(key: string): boolean {
    return this.favoriteActionsData.includes(key);
  }

  toggleActionFavorite(key: string): void {
    const next = this.isActionFavorite(key)
      ? this.favoriteActionsData.filter(value => value !== key)
      : [...this.favoriteActionsData, key];
    this.favoriteActionsData = [...new Set(next)];
    if (this.currentSheet) {
      this.currentSheet.favoriteActions = this.favoriteActionsData.length ? JSON.stringify(this.favoriteActionsData) : null;
      this.scheduleAutoSave();
    }
  }

  openAttackRoll(attack: EquippedAttackShortcut): void {
    this.selectedRollSkill = attack.skillCode;
    this.selectedRollBonusSource = 'attribute';
    this.selectedRollPerception = null;
    this.rollShortcutLabel = `Ataque · ${attack.entry.snapshot.name}`;
    this.isRollPanelOpen = true;
    this.rollResults = [];
    this.updateRollFormulaIfAuto();
  }

  activateAbilityShortcut(hability: IrpwVocationHability & { sourceLabel?: string }): void {
    this.activeAbilityDetail = {
      name: hability.name || 'Habilidade sem nome',
      description: [hability.description || 'Sem descrição registrada.', abilitySummary(hability)].join('\n'),
    };
    if (hability.rollSkill === SKILL.CONJURATION && !this.conjurationAttribute) {
      this.activeAbilityDetail.description += '\nEscolha o atributo para conjurar na seção Atributos antes de preparar esta rolagem.';
      this.selectTab('general');
      return;
    }
    if (!hability.rollSkill) {
      this.selectTab('general');
      return;
    }
    this.selectedRollSkill = hability.rollSkill;
    this.selectedRollBonusSource = 'attribute';
    this.selectedRollPerception = null;
    this.rollShortcutLabel = hability.name || 'Habilidade';
    this.isRollPanelOpen = true;
    this.rollResults = [];
    this.updateRollFormulaIfAuto();
  }

  personalizeAbility(ability: IrpwVocationHability): void {
    const copy = structuredClone(ability);
    copy.id = crypto.randomUUID();
    this.habilitiesData = [...this.habilitiesData, copy];
    this.onHabilitiesChange();
  }

  getHabilityTypeLabel(type: IrpwHabilityType | null | undefined): string {
    return this.habilityTypeOptions.find(option => option.value === type)?.label ?? 'Poder';
  }

  getHabilityTypeIcon(type: IrpwHabilityType | null | undefined): string {
    return type === 'magic' ? 'fa-wand-magic-sparkles' : type === 'passive' ? 'fa-shield-heart' : 'fa-gears';
  }

  dismissAbilityDetail(): void {
    this.activeAbilityDetail = null;
  }

  getOwnedAbilityFavoriteKey(hability: IrpwVocationHability, index: number): string {
    return `ability:character:${this.selectedCharacterId}:${hability.id || `index-${index}`}`;
  }

  getAttributeSkills(group: AttributeGroupCode): SkillCode[] {
    return this.conjurationAttribute === group ? [...ATTRIBUTE_GROUP_SKILLS[group], SKILL.CONJURATION] : ATTRIBUTE_GROUP_SKILLS[group];
  }

  onConjurationAttributeChange(value: AttributeGroupCode | null): void {
    this.conjurationAttribute = value;
    if (!value && this.selectedRollSkill === SKILL.CONJURATION) this.selectedRollSkill = null;
    this.onAttributesChange();
  }

  getSkillLevel(group: string, skill: string): number {
    if (skill === SKILL.CONJURATION) return this.conjurationLevel;
    const storedLevel = this.normalizeSkillLevel(this.attributesData[group]?.skills[skill]);
    const minimumLevel = this.vocationSkillMinimums[skill as SkillCode] ?? 0;
    return Math.max(storedLevel, minimumLevel);
  }

  onCircleClick(event: Event, group: string, skill: string, level: number) {
    event.preventDefault();
    const current = this.getSkillLevel(group, skill);
    if (skill === SKILL.CONJURATION) this.conjurationLevel = current === level ? 0 : this.normalizeSkillLevel(level);
    else this.attributesData[group].skills[skill] = current === level ? 0 : this.normalizeSkillLevel(level);
    this.onAttributesChange();
  }

  getSkillLevelLabel(level: number): string {
    return ['Sem habilidade', 'Treinado', 'Intermediario', 'Mestre'][this.normalizeSkillLevel(level)];
  }

  getSkillRollSummary(group: string, skill: string): string {
    const level = this.getSkillLevel(group, skill);
    const attributeValue = Number(this.attributesData[group]?.value ?? 0);
    const diceCount = level >= 2 ? level : 1;
    const flatBonus = level >= 1 ? 1 : 0;
    const modifiers: string[] = [];

    if (flatBonus > 0) {
      modifiers.push('+ 1');
    }

    if (attributeValue !== 0) {
      modifiers.push(attributeValue > 0 ? `+ ${attributeValue}` : `- ${Math.abs(attributeValue)}`);
    }

    return `${diceCount}d10${modifiers.length ? ' ' + modifiers.join(' ') : ''}`;
  }

  private normalizeSkillLevel(value: number | null | undefined): number {
    if (value == null) return 0;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.min(3, Math.max(0, Math.trunc(numericValue)));
  }

  parseLifepoints() {
    try {
      const parsed = this.currentSheet?.lifepoints
        ? JSON.parse(this.currentSheet.lifepoints)
        : { maxPoints: null, currentPoints: null };
      const maxPoints = Math.max(this.normalizeLifeMaxPoints(parsed.maxPoints) ?? 0, this.getLifeMinimum());
      this.lifepointsData = {
        maxPoints,
        temporaryPoints: this.normalizeTemporaryCount(parsed.temporaryPoints),
        temporaryCurrentPoints: Math.min(this.normalizeTemporaryCount(parsed.temporaryPoints), this.normalizeTemporaryCount(parsed.temporaryCurrentPoints)),
        currentPoints: this.normalizeLifeCurrentPoints(parsed.currentPoints, maxPoints),
      };
    } catch {
      this.lifepointsData = { maxPoints: this.getLifeMinimum(), currentPoints: null };
    }
  }

  private parseSeriousWounds(): void {
    const value = Number(this.currentSheet?.seriousWoundCount ?? 0);
    this.seriousWoundCount = Number.isFinite(value)
      ? Math.min(3, Math.max(0, Math.trunc(value)))
      : 0;
  }

  addSeriousWound(): void {
    if (!this.currentSheet || this.seriousWoundCount >= 3) {
      return;
    }

    this.seriousWoundCount += 1;
    this.onSeriousWoundCountChange();
  }

  removeSeriousWound(): void {
    if (!this.currentSheet || this.seriousWoundCount <= 0) {
      return;
    }

    this.seriousWoundCount -= 1;
    this.onSeriousWoundCountChange();
  }

  private onSeriousWoundCountChange(): void {
    if (!this.currentSheet) {
      return;
    }

    this.currentSheet.seriousWoundCount = this.seriousWoundCount;
    if (this.syncLifeCriticalConditionState()) {
      this.updateRollFormulaIfAuto();
    }
    this.scheduleAutoSave();
  }

  onLifepointsChange() {
    if (this.currentSheet) {
      const maxPoints = Math.max(this.normalizeLifeMaxPoints(this.lifepointsData.maxPoints) ?? 0, this.getLifeMinimum());
      this.lifepointsData.maxPoints = maxPoints;
      this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, maxPoints);
      this.currentSheet.lifepoints = JSON.stringify(this.lifepointsData);
      if (this.syncLifeCriticalConditionState()) {
        this.updateRollFormulaIfAuto();
      }
      this.scheduleAutoSave();
    }
  }

  getLifeFillHalves(segment: number): number {
    const currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, this.getMaxLifePoints()) ?? 0;
    const pointsWithinSegment = Math.max(0, Math.min(1, currentPoints - segment + 1));
    return Math.max(0, Math.min(2, Math.floor(pointsWithinSegment * 2 + 0.0001)));
  }

  setLifePoints(segment: number, half: number) {
    const nextValue = segment - 1 + half * 0.5;
    this.lifepointsData.currentPoints = this.lifepointsData.currentPoints === nextValue ? Math.max(0, nextValue - 0.5) : this.normalizeLifeCurrentPoints(nextValue, this.getMaxLifePoints());
    this.onLifepointsChange();
  }

  setLifePointsToZero(): void {
    this.lifepointsData.currentPoints = 0;
    this.onLifepointsChange();
  }

  formatLifeValue(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return '0';
    const normalizedValue = Math.round(Number(value) * 2) / 2;
    return Number.isInteger(normalizedValue) ? `${normalizedValue}` : `${normalizedValue}`.replace('.', ',');
  }

  getLifeStatusLabel(): string {
    switch (this.getLifeStatus()) {
      case 'healthy': return 'Saudável';
      case 'injured': return 'Ferido';
      case 'critical': return 'Crítico';
      case 'critically-injured': return 'Criticamente ferido';
      default: return 'Sem vida definida';
    }
  }

  getLifeStatusClass(): string {
    switch (this.getLifeStatus()) {
      case 'healthy': return 'is-healthy';
      case 'injured': return 'is-injured';
      case 'critical': return 'is-critical';
      case 'critically-injured': return 'is-critically-injured';
      default: return 'is-undefined';
    }
  }

  getLifeStatusDescription(): string {
    switch (this.getLifeStatus()) {
      case 'healthy': return 'Saudável: acima da metade das caixas de vida.';
      case 'injured': return 'Ferido: com metade ou menos das caixas de vida. Recebe Exaustão Leve até sair deste estado.';
      case 'critical': return 'Crítico: resta 1 caixa de vida. Testes para evitar uma Ferida Grave recebem -2.';
      case 'critically-injured': return this.seriousWoundCount > 0
        ? 'Sem caixas de vida e com Ferida Grave: recebe Morrendo.'
        : 'Sem caixas de vida e sem Ferida Grave: recebe Desmaiando.';
      default: return 'Defina a vida atual para acompanhar o estado do personagem.';
    }
  }

  private getLifeStatus(): 'healthy' | 'injured' | 'critical' | 'critically-injured' | 'undefined' {
    const current = this.lifepointsData.currentPoints;
    if (current == null || !Number.isFinite(current)) return 'undefined';
    if (current <= 0) return 'critically-injured';
    if (current <= 1 && current < this.getMaxLifePoints()) return 'critical';
    if (current <= this.getMaxLifePoints() / 2) return 'injured';
    return 'healthy';
  }

  getResistanceFillState(segment: number): 0 | 2 {
    const current = this.defensepointsData.currentPoints ?? 0;
    if (current >= segment) return 2;
    return 0;
  }

  setDefensePoints(segment: number): void {
    const next = segment;
    this.defensepointsData.currentPoints = this.defensepointsData.currentPoints === next ? Math.max(0, next - 1) : Math.min(this.getMaxDefensePoints(), Math.max(0, next));
    this.onDefensepointsChange();
  }

  getMaxDefensePoints(): number {
    return calculateDefensePointsMax(this.defensepointsData);
  }

  toggleLifeSettingsOverlay() {
    if (this.isLifeSettingsOpen) {
      this.closeLifeSettingsOverlay();
      return;
    }
    this.openLifeSettingsOverlay();
  }

  openLifeSettingsOverlay() {
    this.pendingLifeMaxPoints = this.getMaxLifePoints();
    this.pendingLifeTemporaryPoints = this.lifepointsData.temporaryPoints ?? 0;
    this.isLifeSettingsOpen = true;
  }

  closeLifeSettingsOverlay() {
    this.isLifeSettingsOpen = false;
  }

  saveLifeMaxPoints() {
    const maxPoints = Math.max(this.normalizeLifeMaxPoints(this.pendingLifeMaxPoints) ?? 0, this.getLifeMinimum());
    this.lifepointsData.maxPoints = maxPoints;
    const nextTemporary = this.normalizeTemporaryCount(this.pendingLifeTemporaryPoints);
    this.lifepointsData.temporaryCurrentPoints = this.resizeTemporary(this.lifepointsData.temporaryPoints, this.lifepointsData.temporaryCurrentPoints, nextTemporary);
    this.lifepointsData.temporaryPoints = nextTemporary;
    this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, maxPoints);
    this.onLifepointsChange();
    this.closeLifeSettingsOverlay();
  }

  private normalizeTemporaryCount(value: unknown): number { return Math.min(100, Math.max(0, Math.trunc(Number(value) || 0))); }

  private resizeTemporary(previous: number | undefined, current: number | undefined, next: number): number {
    return Math.min(next, Math.max(0, (current ?? 0) + Math.max(0, next - (previous ?? 0))));
  }

  toggleTemporaryLife(segment: number): void {
    const current = this.lifepointsData.temporaryCurrentPoints ?? 0;
    this.lifepointsData.temporaryCurrentPoints = current === segment ? segment - 1 : segment;
    this.onLifepointsChange();
  }

  getTemporaryResistanceFill(segment: number): number {
    return (this.defensepointsData.temporaryCurrentPoints ?? 0) >= segment ? 2 : 0;
  }

  setTemporaryResistance(segment: number): void {
    const next = Math.min(this.defensepointsData.temporaryPoints ?? 0, Math.max(0, Math.trunc(segment)));
    this.defensepointsData.temporaryCurrentPoints = this.defensepointsData.temporaryCurrentPoints === next ? Math.max(0, next - 1) : next;
    this.onDefensepointsChange();
  }

  toggleResistanceSettings(): void {
    this.pendingResistanceMaxPoints = this.getMaxDefensePoints();
    this.pendingResistanceTemporaryPoints = this.defensepointsData.temporaryPoints ?? 0;
    this.isResistanceSettingsOpen = !this.isResistanceSettingsOpen;
  }

  saveResistanceSettings(): void {
    const maximum = this.normalizeTemporaryCount(this.pendingResistanceMaxPoints);
    this.defensepointsData.manualAdjustment = maximum - this.defensepointsData.vocationContribution - this.defensepointsData.protectionContribution;
    const nextTemporary = this.normalizeTemporaryCount(this.pendingResistanceTemporaryPoints);
    this.defensepointsData.temporaryCurrentPoints = this.resizeTemporary(this.defensepointsData.temporaryPoints, this.defensepointsData.temporaryCurrentPoints, nextTemporary);
    this.defensepointsData.temporaryPoints = nextTemporary;
    this.onDefensepointsChange();
    this.isResistanceSettingsOpen = false;
  }

  toggleStressSettingsOverlay(): void {
    if (this.isStressSettingsOpen) {
      this.closeStressSettingsOverlay();
      return;
    }
    this.openStressSettingsOverlay();
  }

  openStressSettingsOverlay(): void {
    this.pendingStressThresholds = { ...this.getStressThresholdConfig() };
    this.isStressSettingsOpen = true;
  }

  closeStressSettingsOverlay(): void {
    this.isStressSettingsOpen = false;
  }

  saveStressThresholds(): void {
    const thresholds = this.normalizeStressThresholds(this.pendingStressThresholds, null);
    this.resourceData.stress.stressThresholds = thresholds;
    this.resourceData.stress.maxPoints = thresholds.lost;
    this.resourceData.stress.currentPoints = Math.min(
      this.resourceData.stress.currentPoints ?? 0,
      thresholds.lost,
    );
    this.onResourceChange();
    this.closeStressSettingsOverlay();
  }

  private getMaxLifePoints(): number {
    return Math.max(this.normalizeLifeMaxPoints(this.lifepointsData.maxPoints) ?? 0, this.getLifeMinimum());
  }

  private normalizeLifeMaxPoints(value: number | null | undefined): number | null {
    if (value == null) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
    return Math.trunc(numericValue);
  }

  private normalizeLifeCurrentPoints(value: number | null | undefined, maxPoints: number | null): number | null {
    if (value == null) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;

    const roundedToQuarter = Math.round(numericValue * 2) / 2;
    const clampedValue = Math.max(0, maxPoints == null ? roundedToQuarter : Math.min(roundedToQuarter, maxPoints));
    return clampedValue === 0 ? 0 : clampedValue;
  }

  toggleConditionSettingsOverlay() {
    if (this.isConditionSettingsOpen) {
      this.closeConditionSettingsOverlay();
      return;
    }

    this.openConditionSettingsOverlay();
  }

  openConditionSettingsOverlay() {
    this.pendingConditionsData = this.activeConditionsData.map(condition => ({ ...condition }));
    this.isConditionSettingsOpen = true;
  }

  closeConditionSettingsOverlay() {
    this.isConditionSettingsOpen = false;
  }

  saveConditions() {
    this.activeConditionsData = this.normalizeActiveConditions(this.pendingConditionsData);
    this.onConditionsChange();
    this.closeConditionSettingsOverlay();
  }

  parseConditions() {
    if (!this.currentSheet?.conditions) {
      this.activeConditionsData = [];
    } else {
      try {
        this.activeConditionsData = this.normalizeActiveConditions(JSON.parse(this.currentSheet.conditions));
      } catch {
        this.activeConditionsData = [];
      }
    }

    const changed = this.syncLifeCriticalConditionState();
    this.pendingConditionsData = this.activeConditionsData.map(condition => ({ ...condition }));
    if (changed && this.currentSheet) {
      this.currentSheet.conditions = JSON.stringify(this.activeConditionsData);
      this.scheduleAutoSave();
      this.updateRollFormulaIfAuto();
    }
  }

  onConditionsChange() {
    this.activeConditionsData = this.normalizeActiveConditions(this.activeConditionsData);
    this.syncLifeCriticalConditionState();
    this.pendingConditionsData = this.activeConditionsData.map(condition => ({ ...condition }));
    this.rollResults = [];

    if (this.currentSheet) {
      this.currentSheet.conditions = this.activeConditionsData.length
        ? JSON.stringify(this.activeConditionsData)
        : null;
      this.scheduleAutoSave();
    }

    this.updateRollFormulaIfAuto();
  }

  getConditionDefinitionsByCategory(category: ConditionCategoryCode): ConditionDefinition[] {
    return this.conditionDefinitions.filter(definition => definition.category === category);
  }

  getSortedActiveConditions(): ActiveConditionState[] {
    return [...this.activeConditionsData].sort((left, right) => {
      const leftDefinition = this.getConditionDefinition(left.code);
      const rightDefinition = this.getConditionDefinition(right.code);
      return leftDefinition.label.localeCompare(rightDefinition.label);
    });
  }

  getConditionDefinition(code: ConditionCode): ConditionDefinition {
    return this.conditionDefinitions.find(definition => definition.code === code)
      ?? CONDITIONS[code]
      ?? { code, label: code, category: CONDITION_CATEGORY.SPECIAL };
  }

  getConditionDefinitionSummary(definition: ConditionDefinition): string {
    return definition.description ?? 'Escolha a severidade para ver o efeito atual.';
  }

  getConditionEffectDescription(condition: ActiveConditionState): string {
    const definition = this.getConditionDefinition(condition.code);
    return definition.effects?.[condition.severity]?.description
      ?? definition.description
      ?? 'Sem descrição adicional.';
  }

  getConditionSeverityText(condition: ActiveConditionState): string {
    const definition = this.getConditionDefinition(condition.code);
    const availableSeverities = this.getAvailableConditionSeverities(definition);
    if (availableSeverities.length === 1 && !definition.effects?.[availableSeverities[0]]) {
      return 'Ativa';
    }

    return this.conditionSeverityLabel[condition.severity];
  }

  getConditionTooltip(condition: ActiveConditionState): string {
    const definition = this.getConditionDefinition(condition.code);
    return `${definition.label} - ${this.getConditionSeverityText(condition)}\n${this.getConditionEffectDescription(condition)}`;
  }

  getConditionSeverityClass(severity: ConditionSeverityCode): string {
    switch (severity) {
      case CONDITION_SEVERITY.MODERATE:
        return 'border-orange-500/35 bg-orange-950/35 text-orange-100';
      case CONDITION_SEVERITY.SEVERE:
        return 'border-rose-500/35 bg-rose-950/35 text-rose-100';
      default:
        return 'border-amber-500/35 bg-amber-950/35 text-amber-100';
    }
  }

  isPendingConditionActive(code: ConditionCode): boolean {
    return this.pendingConditionsData.some(condition => condition.code === code);
  }

  getPendingConditionSeverity(code: ConditionCode): ConditionSeverityCode {
    const pendingCondition = this.pendingConditionsData.find(condition => condition.code === code);
    if (pendingCondition) {
      return pendingCondition.severity;
    }

    return this.getAvailableConditionSeverities(this.getConditionDefinition(code))[0];
  }

  onPendingConditionToggle(code: ConditionCode, isActive: boolean) {
    if (isActive) {
      if (this.isPendingConditionActive(code)) {
        return;
      }

      const severity = this.getAvailableConditionSeverities(this.getConditionDefinition(code))[0];
      this.pendingConditionsData = this.normalizeActiveConditions([
        ...this.pendingConditionsData,
        { code, severity },
      ]);
      return;
    }

    this.pendingConditionsData = this.pendingConditionsData.filter(condition => condition.code !== code);
  }

  onPendingConditionSeverityChange(code: ConditionCode, severity: ConditionSeverityCode) {
    this.pendingConditionsData = this.normalizeActiveConditions(
      this.pendingConditionsData.map(condition =>
        condition.code === code
          ? { ...condition, severity }
          : condition
      )
    );
  }

  getAvailableConditionSeverities(definition: ConditionDefinition): ConditionSeverityCode[] {
    const severities = definition.effects
      ? (Object.keys(definition.effects) as ConditionSeverityCode[])
      : [];
    const order: ConditionSeverityCode[] = [
      CONDITION_SEVERITY.LIGHT,
      CONDITION_SEVERITY.MODERATE,
      CONDITION_SEVERITY.SEVERE,
    ];

    return severities.length
      ? order.filter(severity => severities.includes(severity))
      : [CONDITION_SEVERITY.LIGHT];
  }

  private createEmptyMark(): IrpwCharacterMark {
    return {
      name: null,
      description: '',
      narrativeType: null,
      weaknesses: [],
      habilities: [],
      attributes: this.createDefaultMarkAttributes(),
    };
  }

  private createEmptyHability(): IrpwVocationHability {
    return { id: crypto.randomUUID(), name: null, description: '', type: 'technical', rollSkill: null };
  }

  private createDefaultMarkAttributes(): IrpwVocationAttributes {
    const result = {} as IrpwVocationAttributes;

    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      result[group] = { value: null, skills: {} };
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        result[group].skills[skill] = 0;
      }
    }

    return result;
  }

  private normalizeMark(value: unknown): IrpwCharacterMark {
    if (!value || typeof value !== 'object') {
      return this.createEmptyMark();
    }

    const source = value as Partial<IrpwCharacterMark>;
    const rawWeaknesses = (value as { weaknesses?: unknown }).weaknesses;
    const normalizedWeaknesses = Array.isArray(rawWeaknesses)
      ? rawWeaknesses.map(weakness => this.normalizeHability(weakness))
      : (typeof rawWeaknesses === 'string' && rawWeaknesses.trim())
        ? [{ name: null, description: rawWeaknesses.trim() }]
        : [];

    return {
      name: this.normalizeOptionalText(source.name),
      description: typeof source.description === 'string' ? source.description : '',
      narrativeType: this.normalizeOptionalText(source.narrativeType),
      weaknesses: normalizedWeaknesses,
      habilities: Array.isArray(source.habilities)
        ? source.habilities.map(hability => this.normalizeHability(hability))
        : [],
      attributes: this.normalizeMarkAttributes(source.attributes),
    };
  }

  private normalizeHability(value: unknown, fallbackId?: string, defaultType: IrpwHabilityType = 'technical'): IrpwVocationHability {
    if (!value || typeof value !== 'object') {
      return { ...this.createEmptyHability(), id: fallbackId ?? crypto.randomUUID(), type: defaultType };
    }

    const source = value as Partial<IrpwVocationHability>;
    const type = this.normalizeHabilityType(source.type, defaultType);
    const rollSkill = source.rollSkill && Object.values(SKILL).includes(source.rollSkill) ? source.rollSkill : null;
    return {
      id: this.normalizeOptionalText(source.id) || fallbackId || null,
      name: this.normalizeOptionalText(source.name),
      description: typeof source.description === 'string' ? source.description : '',
      type,
      rollSkill,
      ...normalizeAbilityMechanics({ ...source, description: source.description ?? '', type }),
    };
  }

  private normalizeHabilityType(value: unknown, fallback: IrpwHabilityType): IrpwHabilityType {
    return value === 'technical' || value === 'magic' || value === 'passive' ? value : fallback;
  }

  private normalizeMarkAttributes(value: Partial<IrpwVocationAttributes> | undefined): IrpwVocationAttributes {
    const attributes = this.createDefaultMarkAttributes();

    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      attributes[group].value = this.normalizeAttributeValue(value?.[group]?.value);
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        attributes[group].skills[skill] = this.normalizeSkillLevel(value?.[group]?.skills?.[skill]);
      }
    }

    return attributes;
  }

  private normalizeAttributeValue(value: number | null | undefined): number | null {
    if (value == null) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return Math.trunc(numericValue);
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue ? normalizedValue : null;
  }

  private normalizeSubspecializations(values: unknown[]): string[] {
    const normalizedValues = values
      .map(value => typeof value === 'string' ? value.trim() : '')
      .filter(value => value.length > 0);

    return [...normalizedValues, ''];
  }

  private refreshInheritedHabilities() {
    const inheritedFromSpecies = this.getInheritedSpeciesHabilities();
    const inheritedFromVocation = this.getInheritedVocationHabilities();

    this.inheritedHabilitiesData = [...inheritedFromSpecies, ...inheritedFromVocation];
  }

  private getInheritedSpeciesHabilities(): InheritedCharacterHability[] {
    const specieId = this.selectedCharacter?.ParentSpecies?.id;
    if (!specieId) {
      return [];
    }

    const specieConfig = this.irpwSpecieService.getConfig(specieId);
    return this.parseHabilityList(specieConfig?.passive, `species:${specieId}:passive`, 'passive')
      .map((hability, index) => ({
        ...hability,
        id: hability.id || `species:${specieId}:passive:${index}`,
        type: 'passive' as const,
        source: 'species' as const,
        sourceLabel: 'Espécie',
        favoriteKey: `ability:species:${specieId}:${hability.id || index}`,
      }));
  }

  private getInheritedVocationHabilities(): InheritedCharacterHability[] {
    const vocation = this.selectedCharacter?.ParentIRPWVocation;
    if (!vocation?.id) return [];
    const passive = this.parseSingleHability(vocation.passive, `vocation:${vocation.id}:passive`, 'passive');
    const powers = this.parseHabilityList(vocation.habilities, `vocation:${vocation.id}:power`, 'technical');
    return [...(passive ? [passive] : []), ...powers].map((hability, index) => {
      const id = hability.id || `vocation:${vocation.id}:power:${index}`;
      return {
        ...hability,
        id,
        type: this.normalizeHabilityType(hability.type, 'technical'),
        source: 'vocation' as const,
        sourceLabel: 'Vocação',
        favoriteKey: `ability:vocation:${vocation.id}:${id}`,
      };
    });
  }

  private parseSingleHability(rawValue: string | null | undefined, fallbackId: string, defaultType: IrpwHabilityType): IrpwVocationHability | null {
    if (!rawValue?.trim()) return null;
    try {
      return this.normalizeHability(JSON.parse(rawValue), fallbackId, defaultType);
    } catch {
      return null;
    }
  }

  private parseHabilityList(rawValue: string | null | undefined, fallbackPrefix = 'hability', defaultType: IrpwHabilityType = 'technical'): IrpwVocationHability[] {
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => this.normalizeHability(item, `${fallbackPrefix}:${index}`, defaultType));
      }

      return parsed && typeof parsed === 'object'
        ? [this.normalizeHability(parsed, `${fallbackPrefix}:0`, defaultType)]
        : [];
    } catch {
      return [];
    }
  }

  parseDefensepoints() {
    const inventory = parseIrpwInventory(this.currentSheet?.inventory);
    const vocationContribution = Math.max(0, Math.trunc(Number(this.selectedCharacter?.ParentIRPWVocation?.basedefense) || 0));
    this.defensepointsData = parseIrpwDefensePoints(
      this.currentSheet?.defensepoints,
      vocationContribution,
      inventory ? protectionContribution(inventory) : 0,
    );
    this.defensepointsData.vocationContribution = vocationContribution;
    this.defensepointsData.protectionContribution = inventory ? protectionContribution(inventory) : 0;
    if (this.defensepointsData.currentPoints !== null) {
      this.defensepointsData.currentPoints = Math.min(this.defensepointsData.currentPoints, this.getMaxDefensePoints());
    }
  }

  onDefensepointsChange() {
    if (this.currentSheet) {
      if (this.defensepointsData.currentPoints !== null) {
        this.defensepointsData.currentPoints = Math.min(this.getMaxDefensePoints(), Math.max(0, Math.round(this.defensepointsData.currentPoints)));
      }
      this.currentSheet.defensepoints = JSON.stringify(this.defensepointsData);
      this.scheduleAutoSave();
    }
  }

  parseResources() {
    const keys: ResourceKey[] = ['stress', 'mana', 'vigor'];
    for (const key of keys) {
      const defaultCurrent = key === 'stress' ? 0 : null;
      let parsed: Partial<ResourceValueState> | null = null;
      try {
        parsed = this.currentSheet?.[key]
          ? JSON.parse(this.currentSheet[key] as string)
          : null;
      } catch {
        parsed = null;
      }

      const currentPoints = this.normalizeResourcePoints(parsed?.currentPoints) ?? defaultCurrent;
      const configuredMaximum = this.normalizeResourcePoints(parsed?.maxPoints);
      const stressThresholds = key === 'stress'
        ? this.normalizeStressThresholds(parsed?.stressThresholds, configuredMaximum)
        : undefined;
      const maxPoints = key === 'stress' ? stressThresholds?.lost ?? null : configuredMaximum;
      this.resourceData[key] = {
        currentPoints: currentPoints !== null && maxPoints !== null
          ? Math.min(currentPoints, maxPoints)
          : currentPoints,
        maxPoints,
        stressThresholds,
      };
    }
  }

  onResourceChange() {
    if (this.currentSheet) {
      for (const key of ['stress', 'mana', 'vigor'] as const) {
        const resource = this.resourceData[key];
        resource.currentPoints = this.normalizeResourcePoints(resource.currentPoints);
        if (key === 'stress') {
          resource.stressThresholds = this.normalizeStressThresholds(resource.stressThresholds, resource.maxPoints);
          resource.maxPoints = resource.stressThresholds.lost;
        } else {
          resource.maxPoints = this.normalizeResourcePoints(resource.maxPoints);
        }
        const maximum = key === 'stress' ? resource.maxPoints : this.getReserveMaximum(key);
        if (resource.currentPoints !== null && maximum !== null) {
          resource.currentPoints = Math.min(resource.currentPoints, maximum);
        }
      }
      this.currentSheet.stress = JSON.stringify(this.resourceData['stress']);
      this.currentSheet.mana = JSON.stringify(this.resourceData['mana']);
      this.currentSheet.vigor = JSON.stringify(this.resourceData['vigor']);
      this.scheduleAutoSave();
    }
  }

  setResourceMaximum(key: ReserveResourceKey, value: unknown): void {
    this.resourceData[key].maxPoints = this.normalizeResourcePoints(value);
    this.onResourceChange();
  }

  adjustResource(key: ResourceKey, amount: number): void {
    const resource = this.resourceData[key];
    const current = resource.currentPoints ?? 0;
    const maximum = key === 'stress' ? this.getStressMaximum() : this.getReserveMaximum(key);
    const next = Math.max(0, current + amount);
    resource.currentPoints = maximum === null ? next : Math.min(maximum, next);
    this.onResourceChange();
  }

  canAdjustResource(key: ResourceKey, amount: number): boolean {
    const resource = this.resourceData[key];
    const current = resource.currentPoints ?? 0;
    if (amount < 0) return current > 0;
    const maximum = key === 'stress' ? this.getStressMaximum() : this.getReserveMaximum(key);
    return maximum === null || current < maximum;
  }

  getStressTrackValue(): number {
    return Math.min(this.getStressMaximum(), this.resourceData.stress.currentPoints ?? 0);
  }

  getStressMaximum(): number {
    return this.getStressThresholdConfig().lost;
  }

  getStressFillPercentage(): number {
    const maximum = this.getStressMaximum();
    return maximum <= 0 ? 0 : Math.min(100, this.getStressTrackValue() / maximum * 100);
  }

  getStressProgressText(): string {
    const current = this.resourceData.stress.currentPoints ?? 0;
    return `${current} de ${this.getStressMaximum()} pontos de Estresse; estado ${this.getStressStateLabel()}.`;
  }

  getStressToneClass(): string {
    return `resource-meter-fill--stress-${this.getStressStateKey()}`;
  }

  getStressCardClass(): string {
    return `stress-card--${this.getStressStateKey()}`;
  }

  getStressStateKey(): StressStateKey {
    const current = this.resourceData.stress.currentPoints ?? 0;
    const thresholds = this.getStressThresholdConfig();
    if (current >= thresholds.lost) return 'lost';
    if (current >= thresholds.disturbed) return 'disturbed';
    if (current >= thresholds.troubled) return 'troubled';
    if (current >= thresholds.anxious) return 'anxious';
    return 'calm';
  }

  getStressStateLabel(): string {
    const labels: Record<StressStateKey, string> = {
      calm: 'Calmo',
      anxious: 'Ansioso',
      troubled: 'Transtornado',
      disturbed: 'Perturbado',
      lost: 'Perdido',
    };
    return labels[this.getStressStateKey()];
  }

  private getStressThresholdConfig(): StressThresholdConfig {
    return this.normalizeStressThresholds(
      this.resourceData.stress.stressThresholds,
      this.resourceData.stress.maxPoints,
    );
  }

  private normalizeStressThresholds(value: unknown, configuredMaximum: number | null): StressThresholdConfig {
    const source = value && typeof value === 'object'
      ? value as Partial<StressThresholdConfig>
      : {};
    const fallback = this.defaultStressThresholds;
    const anxiousCandidate = this.normalizeResourcePoints(source.anxious) ?? fallback.anxious;
    const troubledCandidate = this.normalizeResourcePoints(source.troubled) ?? fallback.troubled;
    const disturbedCandidate = this.normalizeResourcePoints(source.disturbed) ?? fallback.disturbed;
    const lostCandidate = this.normalizeResourcePoints(source.lost) ?? configuredMaximum ?? fallback.lost;
    const lost = Math.max(4, lostCandidate);
    const disturbed = Math.max(3, Math.min(disturbedCandidate, lost - 1));
    const troubled = Math.max(2, Math.min(troubledCandidate, disturbed - 1));
    const anxious = Math.max(1, Math.min(anxiousCandidate, troubled - 1));
    return { anxious, troubled, disturbed, lost };
  }

  getReserveFillPercentage(key: ReserveResourceKey): number {
    const { currentPoints } = this.resourceData[key];
    const maxPoints = this.getReserveMaximum(key);
    if (maxPoints === null || maxPoints <= 0) return 0;
    return Math.max(0, Math.min(100, (currentPoints ?? 0) / maxPoints * 100));
  }

  getReserveTrackValue(key: ReserveResourceKey): number {
    const { currentPoints } = this.resourceData[key];
    const maxPoints = this.getReserveMaximum(key);
    return maxPoints === null ? 0 : Math.max(0, Math.min(maxPoints, currentPoints ?? 0));
  }

  getReserveProgressText(key: ReserveResourceKey): string {
    const { currentPoints } = this.resourceData[key];
    const maxPoints = this.getReserveMaximum(key);
    return `${currentPoints ?? 0} de ${maxPoints ?? 0} pontos de ${key === 'vigor' ? 'Vigor' : 'Mana'}.`;
  }

  getReserveMaximum(key: ReserveResourceKey): number | null {
    const configuredMaximum = this.resourceData[key].maxPoints;
    if (configuredMaximum !== null) return configuredMaximum;
    if (key !== 'vigor') return null;

    const body = Number(this.attributesData['BODY']?.value ?? 0);
    const technique = Number(this.attributesData['TECHNIQUE']?.value ?? 0);
    const bodyValue = Number.isFinite(body) ? Math.trunc(body) : 0;
    const techniqueValue = Number.isFinite(technique) ? Math.trunc(technique) : 0;
    return 3 + Math.max(bodyValue, techniqueValue);
  }

  private normalizeResourcePoints(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return Math.max(0, Math.trunc(numericValue));
  }

  parseMarks() {
    if (!this.currentSheet?.marks) {
      this.marksData = [];
      this.expandedMarkIndexes.clear();
      return;
    }

    try {
      const parsed = JSON.parse(this.currentSheet.marks);
      this.marksData = Array.isArray(parsed)
        ? parsed.map(mark => this.normalizeMark(mark))
        : [];
    } catch {
      this.marksData = [];
    }

    this.expandedMarkIndexes = new Set(this.marksData.map((_, index) => index));
  }

  onMarksChange() {
    this.marksData = this.marksData.map(mark => this.normalizeMark(mark));

    if (this.currentSheet) {
      this.currentSheet.marks = this.marksData.length ? JSON.stringify(this.marksData) : null;
      this.scheduleAutoSave();
    }
  }

  addMark() {
    this.entityHistory.invalidate({ table: 'IRPWCharacterSheet', id: this.selectedCharacterId });
    this.marksData = [...this.marksData, this.createEmptyMark()];
    this.expandedMarkIndexes.add(this.marksData.length - 1);
    this.onMarksChange();
  }

  removeMark(index: number) {
    this.entityHistory.invalidate({ table: 'IRPWCharacterSheet', id: this.selectedCharacterId });
    this.marksData = this.marksData.filter((_, currentIndex) => currentIndex !== index);
    this.expandedMarkIndexes = new Set(
      [...this.expandedMarkIndexes]
        .filter(currentIndex => currentIndex !== index)
        .map(currentIndex => currentIndex > index ? currentIndex - 1 : currentIndex)
    );
    this.onMarksChange();
  }

  isMarkExpanded(index: number): boolean {
    return this.expandedMarkIndexes.has(index);
  }

  toggleMarkExpanded(index: number) {
    if (this.expandedMarkIndexes.has(index)) {
      this.expandedMarkIndexes.delete(index);
      return;
    }

    this.expandedMarkIndexes.add(index);
  }

  addMarkHability(markIndex: number) {
    this.entityHistory.invalidate({ table: 'IRPWCharacterSheet', id: this.selectedCharacterId });
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.habilities = [...mark.habilities, this.createEmptyHability()];
    this.onMarksChange();
  }

  addMarkWeakness(markIndex: number) {
    this.entityHistory.invalidate({ table: 'IRPWCharacterSheet', id: this.selectedCharacterId });
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.weaknesses = [...mark.weaknesses, this.createEmptyHability()];
    this.onMarksChange();
  }

  removeMarkHability(markIndex: number, habilityIndex: number) {
    this.entityHistory.invalidate({ table: 'IRPWCharacterSheet', id: this.selectedCharacterId });
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.habilities = mark.habilities.filter((_, currentIndex) => currentIndex !== habilityIndex);
    this.onMarksChange();
  }

  removeMarkWeakness(markIndex: number, weaknessIndex: number) {
    this.entityHistory.invalidate({ table: 'IRPWCharacterSheet', id: this.selectedCharacterId });
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.weaknesses = mark.weaknesses.filter((_, currentIndex) => currentIndex !== weaknessIndex);
    this.onMarksChange();
  }

  getMarkSkillLevel(mark: IrpwCharacterMark, group: string, skill: string): number {
    return this.normalizeSkillLevel(mark.attributes[group as AttributeGroupCode]?.skills[skill]);
  }

  getMarkActiveSkillsSummary(mark: IrpwCharacterMark): string[] {
    const summaries: string[] = [];

    for (const [group, skills] of this.attributeGroupEntries) {
      for (const skill of skills) {
        const level = this.getMarkSkillLevel(mark, group, skill);
        if (level > 0) {
          summaries.push(`${this.skillLabel[skill]} ${level}`);
        }
      }
    }

    return summaries;
  }

  onMarkCircleClick(event: Event, mark: IrpwCharacterMark, group: string, skill: string, level: number) {
    event.preventDefault();
    const attributeGroup = mark.attributes[group as AttributeGroupCode];
    const currentLevel = this.getMarkSkillLevel(mark, group, skill);
    attributeGroup.skills[skill] = currentLevel === level ? 0 : this.normalizeSkillLevel(level);
    this.onMarksChange();
  }

  scheduleAutoSave() {
    this.isSaving = true;
    this.saveTask.schedule(() => {
      if (this.selectedCharacterId && this.currentSheet) {
        this.sheetService.saveSheet(this.selectedCharacterId, this.currentSheet);
      }
      this.isSaving = false;
    });
  }

  toggleRollPanel() {
    this.isRollPanelOpen = !this.isRollPanelOpen;
    this.updateRollFormulaIfAuto();
  }

  onRollSkillChange() {
    this.rollShortcutLabel = '';
    this.rollResults = [];
    this.updateRollFormulaIfAuto();
  }

  onRollBonusSourceChange() {
    if (this.selectedRollBonusSource !== 'perception') {
      this.selectedRollPerception = null;
    }
    this.rollResults = [];
    this.updateRollFormulaIfAuto();
  }

  onRollPerceptionChange() {
    this.rollResults = [];
    this.updateRollFormulaIfAuto();
  }

  onRollManualModifierChange() {
    this.rollResults = [];
    this.updateRollFormulaIfAuto();
  }

  onRollFormulaInputChange(value: string) {
    this.rollFormulaMode = 'manual';
    this.rollFormula = value;
    this.rollFormulaError = '';
    this.refreshRollPreviewFromFormula();
  }

  resetRollFormulaToAuto() {
    this.rollFormulaMode = 'auto';
    this.syncRollFormula();
  }

  rollDice() {
    if (this.rollFormulaMode === 'auto') {
      this.rollPreview = this.buildAutoRollPreview();
      const preview = this.rollPreview;

      if (preview.resolutionMode === 'disadvantage') {
        const rolls = [this.rollDie(10), this.rollDie(10)];
        const dieValue = Math.min(...rolls);
        const total = dieValue + preview.totalModifier;
        this.rollResults = [{
          index: 1,
          dieValue,
          rolls,
          modifier: preview.totalModifier,
          total,
          status: this.getRollStatus(total),
          resolutionLabel: '2d10 pior',
        }];
        this.lastRollFormula = this.rollFormula;
        return;
      }

      this.rollResults = Array.from({ length: preview.attempts }, (_, index) => {
        const dieValue = this.rollDie(10);
        const total = dieValue + preview.totalModifier;
        return {
          index: index + 1,
          dieValue,
          rolls: [dieValue],
          modifier: preview.totalModifier,
          total,
          status: this.getRollStatus(total),
          resolutionLabel: '1d10',
        };
      });
      this.lastRollFormula = this.rollFormula;
      return;
    }

    this.refreshRollPreviewFromFormula();
    if (this.rollFormulaError) {
      this.rollResults = [];
      return;
    }

    const parsedFormula = this.parseRollFormula(this.rollFormula);
    if (!parsedFormula) {
      this.rollFormulaError = 'Use de 1 a 50 dados d4, d6, d10 ou d20 e um ajuste inteiro. Ex.: 2d6+3.';
      this.rollResults = [];
      return;
    }

    this.rollResults = Array.from({ length: parsedFormula.attempts }, (_, index) => {
      const dieValue = this.rollDie(parsedFormula.sides);
      const total = dieValue + parsedFormula.modifier;
      return {
        index: index + 1,
        dieValue,
        rolls: [dieValue],
        modifier: parsedFormula.modifier,
        total,
        status: this.getRollStatus(total),
        resolutionLabel: `1d${parsedFormula.sides}`,
      };
    });
    this.lastRollFormula = this.rollFormula;
  }

  getRollPreviewDescription(): string {
    if (this.rollPreview.resolutionMode === 'disadvantage') {
      return `1 tentativa com desvantagem e modificador total ${this.formatSignedValue(this.rollPreview.totalModifier)}`;
    }

    const { attempts, sides, totalModifier } = this.rollPreview;
    return `${attempts} ${attempts === 1 ? 'tentativa' : 'tentativas'} de d${sides}, cada uma ${this.formatSignedValue(totalModifier)}`;
  }

  formatSignedValue(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  getRollStatusLabel(status: RollStatus): string {
    switch (status) {
      case 'success': return 'Sucesso';
      case 'near': return 'Por pouco';
      case 'fail': return 'Falha';
      default: return 'Sem alvo';
    }
  }

  private syncRollFormula() {
    this.rollPreview = this.buildAutoRollPreview();
    if (this.rollFormulaMode === 'auto') {
      this.rollFormula = this.buildRollFormula(this.rollPreview);
      this.rollFormulaError = '';
    } else {
      this.refreshRollPreviewFromFormula();
    }
  }

  private updateRollFormulaIfAuto() {
    if (this.rollFormulaMode === 'auto') {
      this.rollPreview = this.buildAutoRollPreview();
      this.rollFormula = this.buildRollFormula(this.rollPreview);
      this.rollFormulaError = '';
    }
  }

  private refreshRollPreviewFromFormula() {
    const parsedFormula = this.parseRollFormula(this.rollFormula);
    if (!parsedFormula) {
      this.rollPreview = { attempts: 1, sides: 10, modifiers: [], totalModifier: 0, resolutionMode: 'normal' };
      this.rollFormulaError = 'Use de 1 a 50 dados d4, d6, d10 ou d20 e um ajuste inteiro. Ex.: 2d6+3.';
      return;
    }

    this.rollPreview = {
      attempts: parsedFormula.attempts,
      sides: parsedFormula.sides,
      modifiers: [{ key: 'manual-formula', label: 'Fórmula manual', value: parsedFormula.modifier, category: 'manual' }],
      totalModifier: parsedFormula.modifier,
      resolutionMode: 'normal',
    };
    this.rollFormulaError = '';
  }

  private buildAutoRollPreview(): RollPreview {
    const modifiers: RollModifier[] = [];
    const baseAttempts = this.getAutoRollAttempts();
    const skillModifier = this.getSkillTrainingModifier();
    if (skillModifier !== 0) {
      modifiers.push({ key: 'skill-training', label: 'Treino da perícia', value: skillModifier, category: 'skill' });
    }

    const sourceModifier = this.getSelectedSourceModifier();
    if (sourceModifier) {
      modifiers.push(sourceModifier);
    }

    const manualModifier = this.normalizeIntegerValue(this.rollManualModifier);
    if (manualModifier !== 0) {
      modifiers.push({ key: 'manual-adjustment', label: 'Ajuste manual', value: manualModifier, category: 'manual' });
    }

    let attempts = baseAttempts;
    let resolutionMode: RollResolutionMode = 'normal';
    let minusDice = 0;

    for (const impact of this.getApplicableConditionImpacts()) {
      if (impact.type === 'modifier') {
        modifiers.push({
          key: impact.key,
          label: impact.label,
          value: impact.value,
          category: 'condition',
          displayValue: impact.displayValue,
        });
        continue;
      }

      if (impact.type === 'minus-dice') {
        minusDice += impact.value;
        modifiers.push({
          key: impact.key,
          label: impact.label,
          value: 0,
          category: 'condition',
          displayValue: impact.displayValue,
        });
        continue;
      }

      resolutionMode = 'disadvantage';
      modifiers.push({
        key: impact.key,
        label: impact.label,
        value: 0,
        category: 'condition',
        displayValue: impact.displayValue,
      });
    }

    attempts -= minusDice;
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

    if (resolutionMode === 'disadvantage') {
      attempts = 1;
    }

    const totalModifier = modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
    return { attempts, sides: 10, modifiers, totalModifier, resolutionMode };
  }

  private buildRollFormula(preview: RollPreview): string {
    const modifierText = preview.totalModifier === 0 ? '' : this.formatSignedValue(preview.totalModifier);
    if (preview.resolutionMode === 'disadvantage') {
      return `2d10${modifierText} (desvantagem)`;
    }

    return `${preview.attempts}d10${modifierText}`;
  }

  private getAutoRollAttempts(): number {
    if (!this.selectedRollSkill) return 1;
    const group = this.skillToAttributeGroup[this.selectedRollSkill];
    if (!group) return 1;
    const skillLevel = this.getSkillLevel(group, this.selectedRollSkill);
    return skillLevel >= 2 ? skillLevel : 1;
  }

  private getSkillTrainingModifier(): number {
    if (!this.selectedRollSkill) return 0;
    const group = this.skillToAttributeGroup[this.selectedRollSkill];
    if (!group) return 0;
    return this.getSkillLevel(group, this.selectedRollSkill) >= 1 ? 1 : 0;
  }

  private getSelectedSourceModifier(): RollModifier | null {
    if (this.selectedRollBonusSource === 'perception') {
      if (!this.selectedRollPerception) return null;
      return {
        key: `perception-${this.selectedRollPerception}`,
        label: `Percepção: ${this.getPerceptionLabel(this.selectedRollPerception)}`,
        value: this.normalizeIntegerValue(this.perceptionsData[this.selectedRollPerception]),
        category: 'source',
      };
    }

    if (!this.selectedRollSkill) return null;
    const group = this.skillToAttributeGroup[this.selectedRollSkill];
    if (!group) return null;
    return {
      key: `attribute-${group}`,
      label: `Atributo: ${this.attributeGroupLabel[group]}`,
      value: this.normalizeIntegerValue(this.attributesData[group]?.value),
      category: 'source',
    };
  }

  private getPerceptionLabel(perception: PerceptionKey): string {
    return this.rollPerceptionOptions.find(option => option.id === perception)?.name ?? perception;
  }

  private getApplicableConditionImpacts(): ParsedConditionImpact[] {
    const impacts: ParsedConditionImpact[] = [];

    for (const condition of this.activeConditionsData) {
      const definition = this.getConditionDefinition(condition.code);
      const severityEffect = definition.effects?.[condition.severity];
      const rawEffects = severityEffect?.conditionEffect;
      if (!rawEffects) {
        continue;
      }

      const effectEntries = Array.isArray(rawEffects) ? rawEffects : [rawEffects];
      for (const effectEntry of effectEntries) {
        const parsedImpact = this.parseConditionImpact(definition, condition.severity, effectEntry);
        if (parsedImpact) {
          impacts.push(parsedImpact);
        }
      }
    }

    return impacts;
  }

  private parseConditionImpact(
    definition: ConditionDefinition,
    severity: ConditionSeverityCode,
    effectEntry: string,
  ): ParsedConditionImpact | null {
    const [rawTarget, rawValue] = effectEntry.split(':');
    if (!rawTarget || !rawValue) {
      return null;
    }

    const target = rawTarget.trim().toUpperCase();
    if (!this.matchesConditionTarget(target)) {
      return null;
    }

    const valueText = rawValue.trim().toUpperCase();
    const label = `${definition.label} ${this.conditionSeverityLabel[severity]}`;
    const keyBase = `${definition.code}-${severity}-${target}`.toLowerCase();

    if (/^-?\d+$/.test(valueText)) {
      const value = Number(valueText);
      return {
        key: `${keyBase}-modifier`,
        label,
        type: 'modifier',
        value,
        displayValue: this.formatSignedValue(value),
      };
    }

    const minusDiceMatch = valueText.match(/^MINUS\s+(\d+)D10$/i);
    if (minusDiceMatch) {
      const value = Number(minusDiceMatch[1]);
      return {
        key: `${keyBase}-minus-dice`,
        label,
        type: 'minus-dice',
        value,
        displayValue: `-${value}d10`,
      };
    }

    if (valueText === 'DISADVANTAGE') {
      return {
        key: `${keyBase}-disadvantage`,
        label,
        type: 'disadvantage',
        value: 0,
        displayValue: 'Desvantagem',
      };
    }

    return null;
  }

  private matchesConditionTarget(target: string): boolean {
    if (this.selectedRollSkill) {
      if (target === this.selectedRollSkill) {
        return true;
      }

      const attributeGroup = this.skillToAttributeGroup[this.selectedRollSkill];
      if (attributeGroup && target === attributeGroup) {
        return true;
      }
    }

    return this.selectedRollBonusSource === 'perception' && target === 'PERCEPTION';
  }

  private parseRollFormula(formula: string): { attempts: number; sides: number; modifier: number } | null {
    const match = formula.trim().match(/^(\d+)\s*d\s*(4|6|10|20)\s*([+-]\s*\d+)?$/i);
    if (!match) return null;

    const attempts = Number(match[1]);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 50) return null;

    const sides = Number(match[2]);
    const modifier = match[3] ? Number(match[3].replace(/\s+/g, '')) : 0;
    if (!Number.isSafeInteger(modifier)) return null;

    return { attempts, sides, modifier };
  }

  private normalizeIntegerValue(value: number | null | undefined): number {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
  }

  private normalizeActiveConditions(value: unknown): ActiveConditionState[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedConditions = new Map<ConditionCode, ActiveConditionState>();

    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const rawCode = (entry as { code?: unknown }).code;
      if (!this.isConditionCode(rawCode)) {
        continue;
      }

      const definition = this.getConditionDefinition(rawCode);
      const availableSeverities = this.getAvailableConditionSeverities(definition);
      const rawSeverity = (entry as { severity?: unknown }).severity;
      const severity = this.isConditionSeverityCode(rawSeverity) && availableSeverities.includes(rawSeverity)
        ? rawSeverity
        : availableSeverities[0];
      const source: 'life' | undefined = (entry as { source?: unknown }).source === 'life' ? 'life' : undefined;

      normalizedConditions.set(rawCode, { code: rawCode, severity, ...(source ? { source } : {}) });
    }

    return [...normalizedConditions.values()].sort((left, right) => {
      const leftDefinition = this.getConditionDefinition(left.code);
      const rightDefinition = this.getConditionDefinition(right.code);
      return leftDefinition.label.localeCompare(rightDefinition.label);
    });
  }

  private syncLifeCriticalConditionState(): boolean {
    const currentPoints = this.lifepointsData.currentPoints;
    const isAtZero = currentPoints !== null && currentPoints <= 0;
    const targetCode = this.seriousWoundCount >= 3
      ? CONDITION.DYING
      : isAtZero
        ? this.seriousWoundCount > 0 ? CONDITION.DYING : CONDITION.FAINTING
        : null;

    const nextConditions = targetCode
      ? this.activeConditionsData.filter(condition =>
          condition.source !== 'life' && condition.code !== CONDITION.FAINTING && condition.code !== CONDITION.DYING)
      : this.activeConditionsData.filter(condition => condition.source !== 'life');

    if (targetCode) {
      nextConditions.push({
        code: targetCode,
        severity: CONDITION_SEVERITY.LIGHT,
        source: 'life',
      });
    }

    const normalized = this.normalizeActiveConditions(nextConditions);
    const changed = JSON.stringify(normalized) !== JSON.stringify(this.activeConditionsData);
    this.activeConditionsData = normalized;
    if (changed) {
      this.pendingConditionsData = normalized.map(condition => ({ ...condition }));
    }
    if (changed && this.currentSheet) {
      this.currentSheet.conditions = normalized.length ? JSON.stringify(normalized) : null;
    }
    return changed;
  }

  private isConditionCode(value: unknown): value is ConditionCode {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isConditionSeverityCode(value: unknown): value is ConditionSeverityCode {
    return typeof value === 'string' && Object.values(CONDITION_SEVERITY).includes(value as ConditionSeverityCode);
  }

  private getRollStatus(total: number): RollStatus {
    if (this.rollTargetValue == null || !Number.isFinite(Number(this.rollTargetValue))) {
      return 'neutral';
    }

    const target = Number(this.rollTargetValue);
    if (total >= target) return 'success';
    if (total === target - 1) return 'near';
    return 'fail';
  }

  private rollDie(sides: number): number {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return (values[0] % sides) + 1;
    }

    return Math.floor(Math.random() * sides) + 1;
  }
}
