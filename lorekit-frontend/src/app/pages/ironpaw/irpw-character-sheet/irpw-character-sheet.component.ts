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
import { getPersonalizationValue, getTextColorStyle } from '../../../models/personalization.model';
import { ATTRIBUTE_GROUP_SKILLS, ATTRIBUTE_GROUP_LABEL, SKILL, SKILL_LABEL, AttributeGroupCode, SkillCode } from '../../../models/irpw-attributes-skills.model';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { getImageByUsageKey } from '../../../models/image.model';
import { Specie } from '../../../models/specie.model';
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

@Component({
  selector: 'irpw-character-sheet',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, CommonModule, NgClass, FormsModule, OverlayModule, ComboBoxComponent, NavButtonComponent, AssetUrlPipe, IrpwInventoryComponent],
  template: `
    <div [historyEntity]="{ table: 'IRPWCharacterSheet', id: selectedCharacterId }" [historyModel]="currentSheet" (historyRestored)="restoreSheetHistory()" class="irpw-sheet entity-edit-shell flex flex-col relative"
      [style.--entity-glass-color]="selectedCharacter ? (getPersonalizationValue(selectedCharacter, 'color') || '#a1a1aa') : '#a1a1aa'">
      <div class="irpw-sheet-row flex flex-row gap-4 relative">

        @if (!characterIdInput()) {

        <!-- Sidebar -->
        <div class="transition-all duration-300 overflow-clip shrink-0" [ngClass]="showSidebar ? 'w-80' : 'w-0'">
          <div class="w-80 entity-properties-panel bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
            <h2 class="text-base mb-4">Ficha de Personagem</h2>

            <!-- World filter -->
            <div class="mb-3">
              <app-combo-box
                class="w-full"
                label="Filtro de mundo"
                [items]="availableWorlds"
                compareProp="id"
                displayProp="name"
                [(comboValue)]="selectedWorldId"
                (comboValueChange)="onWorldSelect()">
              </app-combo-box>
            </div>

            <!-- Search -->
            <div class="mb-4">
              <input
                type="text"
                class="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                placeholder="Buscar personagem..."
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch()">
            </div>

            <!-- Character list -->
            <div class="flex flex-col gap-3 w-full">
              @for (character of filteredCharacters; track character.id) {
                <button
                  type="button"
                  class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                  [ngClass]="selectedCharacterId === character.id ? 'text-yellow-300' : 'text-zinc-400'"
                  [ngStyle]="{'color': getTextColorStyle(getPersonalizationValue(character, 'color'))}"
                  (click)="selectCharacter(character.id)">
                  <i class="fa-solid" [ngClass]="getPersonalizationValue(character, 'icon') || 'fa-user'"></i>
                  <h2 [title]="character.name" class="text-xs truncate">{{ character.name }}</h2>
                </button>
              }

              @if (filteredCharacters.length === 0) {
                <p class="text-xs text-zinc-500">Nenhum personagem encontrado.</p>
              }
            </div>
          </div>
        </div>

        <!-- Toggle sidebar button -->
        <small
          class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer"
          [ngClass]="showSidebar ? 'start-92' : 'start-12'"
          (click)="showSidebar = !showSidebar">
          <i class="fa-solid text-zinc-400" [ngClass]="showSidebar ? 'fa-angles-left' : 'fa-angles-right'"></i>
        </small>
        }

        <!-- Sheet view -->
        <div class="irpw-sheet-view flex-1 min-h-[60vh] p-4 flex flex-col">
          @if (selectedCharacter) {
            <div class="character-overview">
              <div class="character-overview-card character-identity-card entity-properties-panel rounded-md bg-zinc-925 border border-zinc-800 p-3">
                <div class="character-identity-body flex flex-row gap-3">
                  @if(getImageByUsageKey(selectedCharacter.Images, 'profile') != null){
                    @let profileImg = getImageByUsageKey(selectedCharacter.Images, 'profile');
                    <img [src]="profileImg | assetUrl" class="character-profile-image h-[12vh] object-cover rounded-md">
                  }
                  @else {
                    <div class="character-profile-image h-[12vh] w-[12vh] bg-zinc-800 rounded-md flex items-center justify-center text-zinc-500">
                      <i class="fa-solid fa-user text-2xl"></i>
                    </div>
                  }
                  <div class="flex-1 flex flex-col gap-2">
                    <button
                      type="button"
                      class="w-fit text-sm mb-1 text-left transition hover:text-yellow-300 hover:underline cursor-pointer"
                      (click)="openCharacterEditor()">
                      {{ selectedCharacter.name }}
                    </button>
                    <div class="flex items-end gap-2">
                      <app-combo-box
                        class="min-w-0 flex-1"
                        label="Espécie"
                        [items]="availableSpecies"
                        compareProp="id"
                        displayProp="name"
                        [clearable]="true"
                        [(comboValue)]="selectedSpecieId"
                        (comboValueChange)="onSpecieSelect()">
                      </app-combo-box>
                      @if (selectedSpecieId) {
                        <button
                          type="button"
                          class="mb-0.5 h-8 w-8 shrink-0 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                          title="Configurar espécie Ironpaw"
                          aria-label="Configurar espécie Ironpaw"
                          (click)="openSpeciesConfig()">
                          <i class="fa-solid fa-gear text-xs"></i>
                        </button>
                      }
                    </div>
                    <div class="flex items-end gap-2">
                      <app-combo-box
                        class="min-w-0 flex-1"
                        label="Vocação"
                        [items]="availableVocations"
                        compareProp="id"
                        displayProp="name"
                        [clearable]="true"
                        [(comboValue)]="selectedVocationId"
                        (comboValueChange)="onVocationSelect()">
                      </app-combo-box>
                      @if (selectedVocationId) {
                        <button
                          type="button"
                          class="mb-0.5 h-8 w-8 shrink-0 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-yellow-500 hover:text-yellow-300"
                          title="Configurar vocação Ironpaw"
                          aria-label="Configurar vocação Ironpaw"
                          (click)="openVocationConfig()">
                          <i class="fa-solid fa-gear text-xs"></i>
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="mb-0.5 h-8 w-8 shrink-0 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-yellow-500 hover:text-yellow-300"
                          title="Criar nova vocação"
                          aria-label="Criar nova vocação"
                          (click)="createVocationForCharacter()">
                          <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                      }
                    </div>
                  </div>
                </div>

              </div>
              <!-- Lifepoints & Defensepoints -->
              <div class="character-overview-card character-resources-card entity-properties-panel rounded-md bg-zinc-925 border border-zinc-800 p-3 flex flex-col gap-3">
                <div>
                  <div class="flex items-center justify-between gap-3 mb-2">
                    <div class="flex items-center gap-2">
                      <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Vida</h2>
                      <span class="text-[10px] text-zinc-500">{{ formatLifeValue(lifepointsData.currentPoints) }}/{{ formatLifeValue(lifepointsData.maxPoints) }}</span>
                    </div>
                    <div class="life-controls flex items-center gap-2">
                      <span class="life-status" [ngClass]="getLifeStatusClass()" [title]="getLifeStatusDescription()">{{ getLifeStatusLabel() }}</span>
                      <button
                        type="button"
                        class="life-zero-button"
                        [disabled]="lifepointsData.currentPoints === 0"
                        (click)="setLifePointsToZero()"
                        aria-label="Definir vida em zero"
                        title="Definir vida em zero">0 CV</button>
                      <span class="serious-wound-count" [class.has-wounds]="seriousWoundCount > 0" [attr.aria-label]="'Feridas graves: ' + seriousWoundCount + ' de 3'">
                        <i class="fa-solid fa-heart-crack" aria-hidden="true"></i>
                        {{ seriousWoundCount }}/3
                      </span>
                      <button
                        type="button"
                        class="serious-wound-add"
                        [disabled]="seriousWoundCount >= 3"
                        (click)="addSeriousWound()"
                        aria-label="Adicionar Ferida Grave"
                        title="Adicionar Ferida Grave">
                        <i class="fa-solid fa-plus" aria-hidden="true"></i>
                        <span>Ferida Grave</span>
                      </button>
                      @if (seriousWoundCount > 0) {
                        <button
                          type="button"
                          class="serious-wound-remove"
                          (click)="removeSeriousWound()"
                          aria-label="Remover uma Ferida Grave"
                          title="Remover uma Ferida Grave">
                          <i class="fa-solid fa-minus" aria-hidden="true"></i>
                        </button>
                      }
                      <button
                        type="button"
                        class="px-1 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                        cdkOverlayOrigin
                        #lifeSettingsOrigin="cdkOverlayOrigin"
                        (click)="toggleLifeSettingsOverlay()"
                        aria-label="Configurar vida máxima"
                        title="Configurar vida máxima">
                        <i class="fa-solid fa-gear text-xs"></i>
                      </button>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    @for (lifeSegment of lifeSegments; track lifeSegment) {
                      <div class="life-square" [attr.aria-label]="'Caixa de vida ' + lifeSegment">
                        @for (lifeQuarter of [1, 2, 3, 4]; track lifeQuarter) {
                          <button
                            type="button"
                            class="life-square-quarter"
                            [class.is-active]="getLifeFillQuarters(lifeSegment) >= lifeQuarter"
                            (click)="setLifePoints(lifeSegment, lifeQuarter)"
                            [attr.aria-label]="'Definir vida em ' + formatLifeValue(lifeSegment - 1 + lifeQuarter * 0.25)">
                          </button>
                        }
                      </div>
                    }

                    @if (lifeSegments.length === 0) {
                      <button
                        type="button"
                        class="text-[11px] text-zinc-500 hover:text-zinc-300"
                        (click)="openLifeSettingsOverlay()">
                        Defina a vida máxima para exibir a barra.
                      </button>
                    }
                  </div>

                  <ng-template
                    cdkConnectedOverlay
                    [cdkConnectedOverlayOrigin]="lifeSettingsOrigin"
                    [cdkConnectedOverlayOpen]="isLifeSettingsOpen"
                    [cdkConnectedOverlayHasBackdrop]="true"
                    [cdkConnectedOverlayOffsetY]="8"
                    (backdropClick)="closeLifeSettingsOverlay()"
                    (overlayOutsideClick)="closeLifeSettingsOverlay()">
                    <div class="w-56 rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                      <div class="flex items-center justify-between gap-2 mb-3">
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Vida máxima</h3>
                        <button
                          type="button"
                          class="text-zinc-500 transition hover:text-zinc-200"
                          (click)="closeLifeSettingsOverlay()"
                          aria-label="Fechar">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <label class="flex flex-col gap-1 text-[11px] text-zinc-500 mb-3">
                        Quantidade de quadrados
                        <input
                          type="number"
                          min="0"
                          step="1"
                          class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white outline-none focus:border-zinc-500"
                          [(ngModel)]="pendingLifeMaxPoints">
                      </label>
                      <div class="flex justify-end gap-2">
                        <button
                          type="button"
                          class="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                          (click)="closeLifeSettingsOverlay()">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-yellow-700 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200 transition hover:bg-yellow-500/20"
                          (click)="saveLifeMaxPoints()">
                          Salvar
                        </button>
                      </div>
                    </div>
                  </ng-template>
                </div>
                <div class="character-resource-row flex flex-row gap-6">
                  <div class="min-w-0">
                    <div class="mb-2 flex items-center gap-2">
                      <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Resistência</h2>
                      <span class="text-[10px] text-zinc-500">{{ formatLifeValue(defensepointsData.currentPoints) }}/{{ formatLifeValue(getMaxDefensePoints()) }}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      @for (resistanceSegment of resistanceSegments; track resistanceSegment) {
                        <div class="resistance-square" [attr.aria-label]="'Caixa de resistência ' + resistanceSegment">
                          <button
                            type="button"
                            class="resistance-square-half left"
                            [class.is-active]="getResistanceFillState(resistanceSegment) >= 1"
                            (click)="setDefensePoints(resistanceSegment, false)"
                            [attr.aria-label]="'Definir resistência em ' + formatLifeValue(resistanceSegment - 0.5)">
                          </button>
                          <button
                            type="button"
                            class="resistance-square-half right"
                            [class.is-active]="getResistanceFillState(resistanceSegment) === 2"
                            (click)="setDefensePoints(resistanceSegment, true)"
                            [attr.aria-label]="'Definir resistência em ' + formatLifeValue(resistanceSegment)">
                          </button>
                        </div>
                      }
                      @if (resistanceSegments.length === 0) {
                        <span class="text-[10px] text-zinc-500">Sem caixas disponíveis</span>
                      }
                    </div>
                  </div>
                  @for (stat of resourceStats; track stat.key) {
                    <div>
                      <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{{ stat.label }}</h2>
                      <div class="flex flex-col items-center w-fit">
                        <span class="text-[10px] text-zinc-500 mb-0.5">Atual</span>
                        <input type="number" class="w-14 text-center bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                          [(ngModel)]="resourceData[stat.key].currentPoints"
                          (ngModelChange)="onResourceChange()">
                      </div>
                    </div>
                  }
                </div>
              </div>
              <!-- Condições -->
              <div class="character-overview-card character-conditions-card entity-properties-panel rounded-md bg-zinc-925 border border-zinc-800 p-3 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Condições</h2>
                    <p class="text-[10px] text-zinc-500">{{ activeConditionsData.length }} ativa(s)</p>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="px-1 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                      (click)="openConditionCatalog()"
                      aria-label="Editar e criar condições"
                      title="Editar e criar condições">
                      <i class="fa-solid fa-list-check text-xs"></i>
                    </button>
                    <button
                      type="button"
                      class="px-1 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                      cdkOverlayOrigin
                      #conditionSettingsOrigin="cdkOverlayOrigin"
                      (click)="toggleConditionSettingsOverlay()"
                      aria-label="Ativar condições"
                      title="Ativar condições">
                      <i class="fa-solid fa-gear text-xs"></i>
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  @for (condition of getSortedActiveConditions(); track condition.code) {
                    <div
                      class="condition-chip"
                      [ngClass]="getConditionSeverityClass(condition.severity)"
                      [title]="getConditionTooltip(condition)">
                      <span class="font-medium">{{ getConditionDefinition(condition.code).label }}</span>
                      <span class="text-[10px] uppercase tracking-wide opacity-80">{{ getConditionSeverityText(condition) }}</span>
                    </div>
                  }

                  @if (activeConditionsData.length === 0) {
                    <p class="text-[11px] text-zinc-500">Nenhuma condição ativa.</p>
                  }
                </div>

                <ng-template
                  cdkConnectedOverlay
                  [cdkConnectedOverlayOrigin]="conditionSettingsOrigin"
                  [cdkConnectedOverlayOpen]="isConditionSettingsOpen"
                  [cdkConnectedOverlayHasBackdrop]="true"
                  [cdkConnectedOverlayOffsetY]="8"
                  (backdropClick)="closeConditionSettingsOverlay()"
                  (overlayOutsideClick)="closeConditionSettingsOverlay()">
                  <div class="w-[28rem] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-xl scrollbar-dark">
                    <div class="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Condições ativas</h3>
                        <p class="text-[11px] text-zinc-500">Selecione as condições e a severidade vigente.</p>
                      </div>
                      <button
                        type="button"
                        class="text-zinc-500 transition hover:text-zinc-200"
                        (click)="closeConditionSettingsOverlay()"
                        aria-label="Fechar">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <div class="flex flex-col gap-4">
                      @for (category of conditionCategories; track category) {
                        <section class="rounded-md border border-zinc-800 bg-zinc-950/30 p-3">
                          <h4 class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">{{ conditionCategoryLabel[category] }}</h4>
                          <div class="flex flex-col gap-2">
                            @for (definition of getConditionDefinitionsByCategory(category); track definition.code) {
                              <div class="rounded-md border border-zinc-800 bg-zinc-900/80 p-2.5">
                                <div class="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    class="mt-0.5 h-4 w-4 accent-yellow-400"
                                    [checked]="isPendingConditionActive(definition.code)"
                                    (change)="onPendingConditionToggle(definition.code, $any($event.target).checked)">

                                  <div class="flex-1 min-w-0">
                                    <div class="flex items-start justify-between gap-3">
                                      <div>
                                        <p class="text-sm text-zinc-100">{{ definition.label }}</p>
                                        <p class="text-[11px] leading-5 text-zinc-500">{{ getConditionDefinitionSummary(definition) }}</p>
                                      </div>

                                      <select
                                        class="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white outline-none focus:border-zinc-500"
                                        [ngModel]="getPendingConditionSeverity(definition.code)"
                                        (ngModelChange)="onPendingConditionSeverityChange(definition.code, $event)"
                                        [disabled]="!isPendingConditionActive(definition.code)">
                                        @for (severity of getAvailableConditionSeverities(definition); track severity) {
                                          <option [ngValue]="severity">{{ getConditionSeverityText({ code: definition.code, severity }) }}</option>
                                        }
                                      </select>
                                    </div>

                                    @if (isPendingConditionActive(definition.code)) {
                                      <p class="mt-2 text-[11px] leading-5 text-zinc-300">{{ getConditionEffectDescription({ code: definition.code, severity: getPendingConditionSeverity(definition.code) }) }}</p>
                                    }
                                  </div>
                                </div>
                              </div>
                            }
                          </div>
                        </section>
                      }
                    </div>

                    <div class="flex justify-end gap-2 mt-4">
                      <button
                        type="button"
                        class="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                        (click)="closeConditionSettingsOverlay()">
                        Cancelar
                      </button>
                      <button
                        type="button"
                        class="rounded-md border border-yellow-700 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200 transition hover:bg-yellow-500/20"
                        (click)="saveConditions()">
                        Salvar
                      </button>
                    </div>
                  </div>
                </ng-template>
              </div>
            </div>
            <div class="character-workspace">
                  <div class="character-stats-column flex flex-col h-full">
                    <div class="entity-properties-panel flex flex-col rounded-md bg-zinc-925 border border-zinc-800 p-3 mb-2">
                      <h1 class="text-center mb-2">Percepções</h1>
                      <div class="flex flex-row justify-center gap-6">
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-xs text-zinc-400">Olfato
                            @if (getSpeciesPerceptionBase('smell') !== null) { <i class="fa-solid fa-paw ms-1 text-[9px] text-sky-300" [title]="getSpeciesPerceptionTooltip('smell')" [attr.aria-label]="getSpeciesPerceptionTooltip('smell')"></i> }
                          </span>
                          <input type="number" class="w-12 text-center bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                            [(ngModel)]="perceptionsData.smell"
                            (ngModelChange)="onPerceptionsChange()">
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-xs text-zinc-400">Visão
                            @if (getSpeciesPerceptionBase('vision') !== null) { <i class="fa-solid fa-paw ms-1 text-[9px] text-sky-300" [title]="getSpeciesPerceptionTooltip('vision')" [attr.aria-label]="getSpeciesPerceptionTooltip('vision')"></i> }
                          </span>
                          <input type="number" class="w-12 text-center bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                            [(ngModel)]="perceptionsData.vision"
                            (ngModelChange)="onPerceptionsChange()">
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-xs text-zinc-400">Audição
                            @if (getSpeciesPerceptionBase('hearing') !== null) { <i class="fa-solid fa-paw ms-1 text-[9px] text-sky-300" [title]="getSpeciesPerceptionTooltip('hearing')" [attr.aria-label]="getSpeciesPerceptionTooltip('hearing')"></i> }
                          </span>
                          <input type="number" class="w-12 text-center bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                            [(ngModel)]="perceptionsData.hearing"
                            (ngModelChange)="onPerceptionsChange()">
                        </div>
                      </div>
                    </div>
                    <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3  overflow-y-auto mb-2">
                      <h1 class="text-center mb-3">Atributos</h1>
                      <div class="flex flex-col gap-4">
                        @for (entry of attributeGroupEntries; track entry[0]) {
                          <div>
                            <div class="flex items-center justify-between mb-2">
                              <span class="text-xs font-semibold text-zinc-200 uppercase tracking-wide">{{ attributeGroupLabel[entry[0]] }}</span>
                              <input type="number"
                                class="w-12 text-center bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-white outline-none focus:border-zinc-500"
                                [(ngModel)]="attributesData[entry[0]].value"
                                (ngModelChange)="onAttributesChange()">
                            </div>
                            <div class="flex flex-col gap-1.5 pl-1">
                              @for (skill of entry[1]; track skill) {
                                <div class="flex items-center justify-between">
                                  <span class="text-xs text-zinc-400">{{ skillLabel[skill] }}
                                    @if (isSkillAtVocationMinimum(entry[0], skill)) {
                                      <i class="fa-solid fa-lock ms-1 text-[9px] text-sky-300" [title]="getVocationMinimumTooltip(skill)" [attr.aria-label]="getVocationMinimumTooltip(skill)"></i>
                                    }
                                  </span>
                                  <div class="flex items-center gap-3">
                                    <span class="text-[11px] text-zinc-500 whitespace-nowrap">
                                      {{ getSkillRollSummary(entry[0], skill) }}
                                    </span>
                                    <div class="flex gap-1.5">
                                    @for (level of [0,1,2,3]; track level) {
                                      <input
                                        type="checkbox"
                                        class="circle-checkbox level-{{level}}"
                                        [checked]="getSkillLevel(entry[0], skill) >= level"
                                        [title]="getSkillLevelLabel(level)"
                                        (click)="onCircleClick($event, entry[0], skill, level)">
                                    }
                                    </div>
                                  </div>
                                </div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                    <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3">
                      <h1 class="text-center mb-3">Subespecializações</h1>
                      <div class="flex flex-col gap-2">
                        @for (subspecialization of subspecializationsData; track $index; let subspecializationIndex = $index) {
                          <input [historyField]="{ column: 'subspecialization', label: 'Subespecializações' }" [historyRead]="readSubspecializationHistory"
                            type="text"
                            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                            [ngModel]="subspecialization"
                            (ngModelChange)="onSubspecializationChange(subspecializationIndex, $event)"
                            [placeholder]="subspecializationIndex === subspecializationsData.length - 1 ? 'Adicionar subespecialização...' : 'Subespecialização'">
                        }
                      </div>
                    </div>
                  </div>
                  <div class="character-tabs-column p-3">
                    <div class="flex-4 flex flex-col">
                      <div class="character-tabs flex flex-row flex-wrap items-end gap-1 ms-1">
                        <app-nav-button [label]="'Geral'" size="sm" [active]="currentTab === 'general'" (click)="selectTab('general')"></app-nav-button>
                        <app-nav-button [label]="'Marcos'" size="sm" [active]="currentTab === 'marks'" (click)="selectTab('marks')"></app-nav-button>
                        <app-nav-button [label]="'Inventário'" size="sm" [active]="currentTab === 'inventory'" (click)="selectTab('inventory')"></app-nav-button>
                        <app-nav-button [label]="'Poderes'" size="sm" [active]="currentTab === 'skills'" (click)="selectTab('skills')"></app-nav-button>
                      </div>
                      <div class="character-tab-content entity-properties-panel p-4 pb-10 rounded-lg mt-2 flex-1 flex flex-col">
                          @switch (currentTab) {
                            @case ('general') {
                              <div class="flex flex-col gap-4">
                                @if (activeAbilityDetail; as detail) {
                                  <section class="ironpaw-ability-detail" aria-live="polite">
                                    <div class="flex items-start justify-between gap-3">
                                      <div>
                                        <h2>{{ detail.name }}</h2>
                                        <p>{{ detail.description }}</p>
                                      </div>
                                      <button type="button" (click)="dismissAbilityDetail()" aria-label="Fechar detalhe da habilidade">
                                        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                                      </button>
                                    </div>
                                  </section>
                                }
                                <section class="ironpaw-overview-section ironpaw-overview-shortcuts" aria-labelledby="overview-shortcuts-title">
                                  <div class="mb-3 flex items-start justify-between gap-3">
                                    <div>
                                      <h2 id="overview-shortcuts-title" class="text-sm font-semibold text-zinc-100">Atalhos favoritos</h2>
                                      <p class="mt-1 text-xs text-zinc-500">Armas equipadas e poderes favoritos ficam prontos para abrir daqui.</p>
                                    </div>
                                    <button type="button" class="text-xs text-yellow-300 transition hover:text-yellow-200" (click)="selectTab('skills')">Ver poderes</button>
                                  </div>
                                  <div class="flex flex-wrap gap-2">
                                    @for (attack of getFavoriteAttacks(); track attack.favoriteKey) {
                                      <button type="button" class="ironpaw-shortcut" (click)="openAttackRoll(attack)" [title]="attack.skillLabel + ' · ' + attack.entry.snapshot.name">
                                        <i class="fa-solid fa-burst text-rose-300" aria-hidden="true"></i>
                                        <span>{{ attack.entry.snapshot.name }}</span>
                                        <small>{{ attack.skillLabel }}</small>
                                      </button>
                                    }
                                    @for (hability of getFavoriteHabilities(); track hability.favoriteKey) {
                                      <button type="button" class="ironpaw-shortcut" (click)="activateAbilityShortcut(hability)" [title]="hability.description || hability.sourceLabel">
                                        <i class="fa-solid" [ngClass]="getHabilityTypeIcon(hability.type)" aria-hidden="true"></i>
                                        <span>{{ hability.name || 'Habilidade sem nome' }}</span>
                                        <small>{{ hability.sourceLabel }}</small>
                                      </button>
                                    }
                                    @if (getFavoriteAttacks().length === 0 && getFavoriteHabilities().length === 0) {
                                      <p class="rounded-lg border border-dashed border-zinc-700 px-3 py-3 text-xs text-zinc-500">Use a estrela nos ataques e habilidades para montar seus atalhos.</p>
                                    }
                                  </div>
                                </section>

                                <section class="ironpaw-overview-section" aria-labelledby="overview-attacks-title">
                                  <div class="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                      <h2 id="overview-attacks-title" class="text-sm font-semibold text-zinc-100">Ataques equipados</h2>
                                      <p class="mt-1 text-xs text-zinc-500">As armas ativas do inventário aparecem automaticamente.</p>
                                    </div>
                                    <button type="button" class="text-xs text-zinc-400 transition hover:text-zinc-100" (click)="selectTab('inventory')">Inventário</button>
                                  </div>
                                  <div class="flex flex-col gap-2">
                                    @for (attack of getEquippedAttacks(); track attack.favoriteKey) {
                                      <article class="ironpaw-overview-row">
                                        <div class="min-w-0 flex-1">
                                          <div class="flex flex-wrap items-center gap-2">
                                            <h3 class="truncate text-sm font-medium text-zinc-100">{{ attack.entry.snapshot.name }}</h3>
                                            <span class="rounded-full border border-zinc-700/80 px-2 py-0.5 text-[10px] text-zinc-400">{{ attack.slotLabel }}</span>
                                            <span class="text-[10px] text-zinc-500">{{ attack.skillLabel }}</span>
                                          </div>
                                          <p class="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{{ getEquipmentEffectSummary(attack.entry) || attack.entry.snapshot.definition.weapon?.specialProperty || 'Sem efeito adicional descrito.' }}</p>
                                        </div>
                                        <div class="flex shrink-0 items-center gap-1.5">
                                          <button type="button" class="ironpaw-favorite-button" [class.is-favorite]="isActionFavorite(attack.favoriteKey)" [attr.aria-pressed]="isActionFavorite(attack.favoriteKey)" [attr.aria-label]="isActionFavorite(attack.favoriteKey) ? 'Remover ataque dos favoritos' : 'Adicionar ataque aos favoritos'" (click)="toggleActionFavorite(attack.favoriteKey)">
                                            <i class="fa-solid fa-star" aria-hidden="true"></i>
                                          </button>
                                          <button type="button" class="ironpaw-action-button" (click)="openAttackRoll(attack)">Rolar</button>
                                        </div>
                                      </article>
                                    }
                                    @if (getEquippedAttacks().length === 0) {
                                      <p class="rounded-lg border border-dashed border-zinc-700 px-3 py-4 text-center text-xs text-zinc-500">Equipe uma arma nos espaços primário ou secundário para criar atalhos de ataque.</p>
                                    }
                                  </div>
                                </section>

                                <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                  <section class="ironpaw-overview-section" aria-labelledby="overview-species-title">
                                    <h2 id="overview-species-title" class="text-sm font-semibold text-zinc-100">Espécie · {{ selectedCharacter.ParentSpecies?.name || 'Não definida' }}</h2>
                                    <p class="mt-1 text-xs leading-5 text-zinc-400">{{ selectedCharacter.ParentSpecies?.description || selectedCharacter.ParentSpecies?.concept || 'Sem descrição registrada para esta espécie.' }}</p>
                                    <div class="ironpaw-summary-facts mt-3">
                                      <span><small>Vida base</small>{{ getSpeciesBaseHealthLabel() }}</span>
                                      <span><small>Olfato</small>{{ getSpeciesPerceptionBase('smell') ?? '—' }}</span>
                                      <span><small>Visão</small>{{ getSpeciesPerceptionBase('vision') ?? '—' }}</span>
                                      <span><small>Audição</small>{{ getSpeciesPerceptionBase('hearing') ?? '—' }}</span>
                                    </div>
                                    <div class="mt-3 flex flex-col gap-2">
                                      @for (hability of getInheritedHabilitiesBySource('species'); track hability.favoriteKey) {
                                        <div class="ironpaw-summary-item">
                                          <span class="text-xs font-medium text-zinc-200">{{ hability.name || 'Passiva da espécie' }}</span>
                                          <p class="mt-0.5 whitespace-pre-line text-xs leading-5 text-zinc-400">{{ hability.description || 'Sem descrição.' }}</p>
                                        </div>
                                      }
                                      @for (weakness of getSpeciesWeaknesses(); track weakness.id) {
                                        <div class="ironpaw-summary-item ironpaw-summary-item--muted">
                                          <span class="text-xs font-medium text-zinc-300">{{ weakness.name || 'Fraqueza' }}</span>
                                          <p class="mt-0.5 whitespace-pre-line text-xs leading-5 text-zinc-500">{{ weakness.description }}</p>
                                        </div>
                                      }
                                      @if (getInheritedHabilitiesBySource('species').length === 0 && getSpeciesWeaknesses().length === 0) {
                                        <p class="text-xs text-zinc-500">Nenhuma característica cadastrada.</p>
                                      }
                                    </div>
                                  </section>

                                  <section class="ironpaw-overview-section" aria-labelledby="overview-vocation-title">
                                    <h2 id="overview-vocation-title" class="text-sm font-semibold text-zinc-100">Vocação · {{ selectedCharacter.ParentIRPWVocation?.name || 'Não definida' }}</h2>
                                    <p class="mt-1 text-xs leading-5 text-zinc-400">{{ selectedCharacter.ParentIRPWVocation?.description || 'Sem descrição registrada para esta vocação.' }}</p>
                                    <div class="ironpaw-summary-facts mt-3">
                                      <span><small>Vida base</small>{{ getVocationBaseHealthLabel() }}</span>
                                      <span><small>Defesa base</small>{{ getVocationBaseDefenseLabel() }}</span>
                                    </div>
                                    <p class="mt-2 text-[11px] leading-5 text-zinc-400"><span class="text-zinc-500">Perícias iniciais · </span>{{ getVocationSkillMinimumSummary() }}</p>
                                    <div class="mt-3 flex flex-col gap-2">
                                      @for (hability of getInheritedHabilitiesBySource('vocation'); track hability.favoriteKey) {
                                        <div class="ironpaw-summary-item">
                                          <div class="flex items-center justify-between gap-2">
                                            <span class="text-xs font-medium text-zinc-200">{{ hability.name || (hability.type === 'passive' ? 'Passiva da vocação' : 'Poder da vocação') }}</span>
                                            <span class="text-[10px] text-zinc-500">{{ getHabilityTypeLabel(hability.type) }}</span>
                                          </div>
                                          <p class="mt-0.5 whitespace-pre-line text-xs leading-5 text-zinc-400">{{ hability.description || 'Sem descrição.' }}</p>
                                        </div>
                                      }
                                      @if (getInheritedHabilitiesBySource('vocation').length === 0) {
                                        <p class="text-xs text-zinc-500">Nenhuma característica cadastrada.</p>
                                      }
                                    </div>
                                  </section>
                                </div>

                                <section class="ironpaw-overview-section" aria-labelledby="overview-equipment-title">
                                  <div class="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                      <h2 id="overview-equipment-title" class="text-sm font-semibold text-zinc-100">Equipamentos em uso</h2>
                                      <p class="mt-1 text-xs text-zinc-500">Resumo dos efeitos descritos nos espaços equipados.</p>
                                    </div>
                                    <button type="button" class="text-xs text-zinc-400 transition hover:text-zinc-100" (click)="selectTab('inventory')">Gerenciar</button>
                                  </div>
                                  <div class="flex flex-col gap-2">
                                    @for (equipment of getEquippedEquipment(); track equipment.entry.instanceId) {
                                      <div class="ironpaw-equipment-summary">
                                        <div class="flex shrink-0 items-center gap-2">
                                          <i class="fa-solid fa-shield-halved text-xs text-zinc-500" aria-hidden="true"></i>
                                          <span class="text-xs text-zinc-500">{{ equipment.slotLabel }}</span>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                          <span class="text-xs font-medium text-zinc-200">{{ equipment.entry.snapshot.name }}</span>
                                          <p class="mt-0.5 whitespace-pre-line text-xs leading-5 text-zinc-400">{{ equipment.effects || 'Sem efeito adicional descrito.' }}</p>
                                        </div>
                                        @if (equipment.slot === 'reserve') {
                                          <span class="text-[10px] text-zinc-500">Reserva</span>
                                        }
                                      </div>
                                    }
                                    @if (getEquippedEquipment().length === 0) {
                                      <p class="rounded-lg border border-dashed border-zinc-700 px-3 py-4 text-center text-xs text-zinc-500">Nenhum equipamento está vestido ou equipado.</p>
                                    }
                                  </div>
                                </section>
                              </div>
                            }
                            @case ('marks') {
                              <div class="flex items-center justify-between gap-3 mb-4">
                                <div>
                                  <h2 class="text-sm text-zinc-100">Marcos narrativos</h2>
                                  <p class="text-xs text-zinc-500">Cada marco usa JSON próprio com tipo, habilidades e atributos/perícias.</p>
                                </div>
                                <button
                                  type="button"
                                  class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                  (click)="addMark()">
                                  Adicionar marco
                                </button>
                              </div>

                              <div class="flex flex-col gap-4">
                                @for (mark of marksData; track $index; let markIndex = $index) {
                                  <div class="rounded-md border border-zinc-800 bg-zinc-925/80 p-4">
                                    <div class="flex items-start justify-between gap-3">
                                      <button
                                        type="button"
                                        class="flex-1 text-left"
                                        (click)="toggleMarkExpanded(markIndex)">
                                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                                          <h3 class="text-sm text-zinc-100">{{ mark.name || ('Marco ' + (markIndex + 1)) }}</h3>
                                          <span class="text-[10px] uppercase tracking-wide text-zinc-500">{{ mark.narrativeType || 'Sem tipo' }}</span>
                                        </div>
                                        <p class="text-xs text-zinc-400 line-clamp-2">{{ mark.description || 'Sem descrição.' }}</p>
                                        <div class="mt-3 flex flex-wrap gap-2">
                                          @for (skillSummary of getMarkActiveSkillsSummary(mark); track skillSummary) {
                                            <span class="rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-300">
                                              {{ skillSummary }}
                                            </span>
                                          }

                                          @if (getMarkActiveSkillsSummary(mark).length === 0) {
                                            <span class="rounded-full border border-dashed border-zinc-700 px-2 py-1 text-[11px] text-zinc-500">
                                              Sem perícias treinadas
                                            </span>
                                          }
                                        </div>
                                      </button>

                                      <div class="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          class="rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                          (click)="toggleMarkExpanded(markIndex)">
                                          {{ isMarkExpanded(markIndex) ? 'Recolher' : 'Expandir' }}
                                        </button>
                                        <button
                                          type="button"
                                          class="rounded-md border border-red-900/70 bg-red-950/40 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-950/70"
                                          (click)="removeMark(markIndex)">
                                          Remover
                                        </button>
                                      </div>
                                    </div>

                                    @if (isMarkExpanded(markIndex)) {
                                      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4 border-t border-zinc-800 pt-4">
                                        <div class="xl:col-span-2 flex flex-col gap-4">
                                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                              Nome
                                              <input [historyField]="{ column: 'marks', path: [markIndex, 'name'], trim: true, label: 'Marco: nome' }"
                                                type="text"
                                                class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                [(ngModel)]="mark.name"
                                                (ngModelChange)="onMarksChange()"
                                                placeholder="Ex.: Juramento da Vigília">
                                            </label>

                                            <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                              Tipo de marco narrativo
                                              <input [historyField]="{ column: 'marks', path: [markIndex, 'narrativeType'], trim: true, label: 'Marco: tipo narrativo' }"
                                                type="text"
                                                class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                [(ngModel)]="mark.narrativeType"
                                                (ngModelChange)="onMarksChange()"
                                                placeholder="Ex.: Revelação, Trauma, Ascensão">
                                            </label>

                                            <label class="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-400">
                                              Descrição
                                              <textarea [historyField]="{ column: 'marks', path: [markIndex, 'description'], trim: false, label: 'Marco: descrição' }"
                                                class="min-h-28 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                [(ngModel)]="mark.description"
                                                (ngModelChange)="onMarksChange()"
                                                placeholder="Descreva o impacto narrativo deste marco."></textarea>
                                            </label>

                                          </div>

                                          <div class="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                                            <div class="flex items-center justify-between gap-3 mb-3">
                                              <h4 class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Habilidades</h4>
                                              <button
                                                type="button"
                                                class="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                                (click)="addMarkHability(markIndex)">
                                                Adicionar habilidade
                                              </button>
                                            </div>

                                            <div class="flex flex-col gap-3">
                                              @for (hability of mark.habilities; track $index; let habilityIndex = $index) {
                                                <div class="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
                                                  <div class="flex items-center justify-between gap-2 mb-3">
                                                    <span class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Habilidade {{ habilityIndex + 1 }}</span>
                                                    <button
                                                      type="button"
                                                      class="rounded-md border border-red-900/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 transition hover:bg-red-950/70"
                                                      (click)="removeMarkHability(markIndex, habilityIndex)">
                                                      Remover
                                                    </button>
                                                  </div>

                                                  <div class="grid grid-cols-1 gap-3">
                                                    <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                      Nome
                                                      <input [historyField]="{ column: 'marks', path: [markIndex, 'habilities', habilityIndex, 'name'], trim: true, label: 'Habilidade do marco' }"
                                                        type="text"
                                                        class="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                        [(ngModel)]="hability.name"
                                                        (ngModelChange)="onMarksChange()"
                                                        placeholder="Opcional">
                                                    </label>

                                                    <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                      Descrição
                                                      <textarea [historyField]="{ column: 'marks', path: [markIndex, 'habilities', habilityIndex, 'description'], trim: false, label: 'Habilidade do marco' }"
                                                        class="min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                        [(ngModel)]="hability.description"
                                                        (ngModelChange)="onMarksChange()"
                                                        placeholder="Efeito da habilidade."></textarea>
                                                    </label>
                                                  </div>
                                                </div>
                                              }

                                              @if (mark.habilities.length === 0) {
                                                <div class="rounded-md border border-dashed border-zinc-700 px-4 py-4 text-center text-xs text-zinc-500">
                                                  Nenhuma habilidade cadastrada para este marco.
                                                </div>
                                              }
                                            </div>
                                          </div>

                                          <div class="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                                            <div class="flex items-center justify-between gap-3 mb-3">
                                              <h4 class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Fraquezas</h4>
                                              <button
                                                type="button"
                                                class="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                                (click)="addMarkWeakness(markIndex)">
                                                Adicionar fraqueza
                                              </button>
                                            </div>

                                            <div class="flex flex-col gap-3">
                                              @for (weakness of mark.weaknesses; track $index; let weaknessIndex = $index) {
                                                <div class="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
                                                  <div class="flex items-center justify-between gap-2 mb-3">
                                                    <span class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Fraqueza {{ weaknessIndex + 1 }}</span>
                                                    <button
                                                      type="button"
                                                      class="rounded-md border border-red-900/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 transition hover:bg-red-950/70"
                                                      (click)="removeMarkWeakness(markIndex, weaknessIndex)">
                                                      Remover
                                                    </button>
                                                  </div>

                                                  <div class="grid grid-cols-1 gap-3">
                                                    <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                      Nome
                                                      <input [historyField]="{ column: 'marks', path: [markIndex, 'weaknesses', weaknessIndex, 'name'], trim: true, label: 'Fraqueza: nome' }"
                                                        type="text"
                                                        class="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                        [(ngModel)]="weakness.name"
                                                        (ngModelChange)="onMarksChange()"
                                                        placeholder="Opcional">
                                                    </label>

                                                    <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                      Descrição
                                                      <textarea [historyField]="{ column: 'marks', path: [markIndex, 'weaknesses', weaknessIndex, 'description'], trim: false, label: 'Fraqueza: descrição' }"
                                                        class="min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                        [(ngModel)]="weakness.description"
                                                        (ngModelChange)="onMarksChange()"
                                                        placeholder="Limitação, custo ou vulnerabilidade."></textarea>
                                                    </label>
                                                  </div>
                                                </div>
                                              }

                                              @if (mark.weaknesses.length === 0) {
                                                <div class="rounded-md border border-dashed border-zinc-700 px-4 py-4 text-center text-xs text-zinc-500">
                                                  Nenhuma fraqueza cadastrada para este marco.
                                                </div>
                                              }
                                            </div>
                                          </div>
                                        </div>

                                        <div class="rounded-md border border-zinc-800 bg-zinc-950/30 p-3 overflow-y-auto">
                                          <h4 class="text-center mb-3 text-sm text-zinc-100">Atributos e perícias</h4>
                                          <div class="flex flex-col gap-4">
                                            @for (entry of attributeGroupEntries; track entry[0]) {
                                              <div>
                                                <div class="flex items-center justify-between mb-2">
                                                  <span class="text-xs font-semibold text-zinc-200 uppercase tracking-wide">{{ attributeGroupLabel[entry[0]] }}</span>
                                                  <input
                                                    type="number"
                                                    class="w-12 text-center bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-white outline-none focus:border-zinc-500"
                                                    [(ngModel)]="mark.attributes[entry[0]].value"
                                                    (ngModelChange)="onMarksChange()">
                                                </div>
                                                <div class="flex flex-col gap-1.5 pl-1">
                                                  @for (skill of entry[1]; track skill) {
                                                    <div class="flex items-center justify-between gap-3">
                                                      <span class="text-xs text-zinc-400">{{ skillLabel[skill] }}</span>
                                                      <div class="flex gap-1.5">
                                                        @for (level of [0,1,2,3]; track level) {
                                                          <input
                                                            type="checkbox"
                                                            class="circle-checkbox level-{{level}}"
                                                            [checked]="getMarkSkillLevel(mark, entry[0], skill) >= level"
                                                            [title]="getSkillLevelLabel(level)"
                                                            (click)="onMarkCircleClick($event, mark, entry[0], skill, level)">
                                                        }
                                                      </div>
                                                    </div>
                                                  }
                                                </div>
                                              </div>
                                            }
                                          </div>
                                        </div>
                                      </div>
                                    }
                                  </div>
                                }

                                @if (marksData.length === 0) {
                                  <div class="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                                    Nenhum marco cadastrado para este personagem.
                                  </div>
                                }
                              </div>
                            }
                            @case ('inventory') {
                              <irpw-inventory [characterId]="selectedCharacterId"></irpw-inventory>
                            }
                            @case ('skills') {
                              <div class="flex flex-col gap-4">
                                <div class="flex items-center justify-between gap-3">
                                  <div>
                                    <h3 class="text-sm font-semibold text-zinc-100">Poderes</h3>
                                    <p class="text-xs text-zinc-500">Poderes, magias e passivas ficam organizados por tipo. Favoritos aparecem nos atalhos da aba Geral.</p>
                                  </div>
                                  <button
                                    type="button"
                                    class="ironpaw-action-button"
                                    (click)="addHability()">
                                    Adicionar habilidade
                                  </button>
                                </div>

                                @for (type of habilityTypeOptions; track type.value) {
                                  <section class="ironpaw-skill-section" [attr.data-skill-type]="type.value">
                                    <header class="ironpaw-skill-section__header">
                                      <div class="flex items-center gap-2">
                                        <i class="fa-solid" [ngClass]="getHabilityTypeIcon(type.value)" aria-hidden="true"></i>
                                        <h4>{{ type.label }}</h4>
                                      </div>
                                      <span>{{ getOwnHabilitiesByType(type.value).length + getInheritedHabilitiesByType(type.value).length }}</span>
                                    </header>

                                    <div class="flex flex-col gap-3">
                                      @for (hability of habilitiesData; track hability.id; let habilityIndex = $index) {
                                        @if (hability.type === type.value) {
                                          <article class="ironpaw-ability-row">
                                            <div class="ironpaw-ability-row__toolbar">
                                              <span>Personagem</span>
                                              <div class="flex items-center gap-1.5">
                                                <button type="button" class="ironpaw-favorite-button" [class.is-favorite]="isActionFavorite(getOwnedAbilityFavoriteKey(hability, habilityIndex))" [attr.aria-pressed]="isActionFavorite(getOwnedAbilityFavoriteKey(hability, habilityIndex))" [attr.aria-label]="isActionFavorite(getOwnedAbilityFavoriteKey(hability, habilityIndex)) ? 'Remover habilidade dos favoritos' : 'Adicionar habilidade aos favoritos'" (click)="toggleActionFavorite(getOwnedAbilityFavoriteKey(hability, habilityIndex))">
                                                  <i class="fa-solid fa-star" aria-hidden="true"></i>
                                                </button>
                                                <button type="button" class="ironpaw-remove-button" (click)="removeHability(habilityIndex)">Remover</button>
                                              </div>
                                            </div>
                                            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                                              <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                Nome
                                                <input [historyField]="{ column: 'habilities', label: 'Habilidades' }" [historyRead]="readHabilitiesHistory" type="text" class="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500" [(ngModel)]="hability.name" (ngModelChange)="onHabilitiesChange()" placeholder="Ex.: Passos entre as sombras">
                                              </label>
                                              <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                Perícia para o atalho
                                                <select class="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" [(ngModel)]="hability.rollSkill" (ngModelChange)="onHabilitiesChange()">
                                                  <option [ngValue]="null">Sem rolagem associada</option>
                                                  @for (skill of rollSkillOptions; track skill.id) { <option [ngValue]="skill.id">{{ skill.name }}</option> }
                                                </select>
                                              </label>
                                              <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                Tipo
                                                <select class="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" [(ngModel)]="hability.type" (ngModelChange)="onHabilitiesChange()">
                                                  @for (kind of habilityTypeOptions; track kind.value) { <option [ngValue]="kind.value">{{ kind.label }}</option> }
                                                </select>
                                              </label>
                                              <label class="flex flex-col gap-1 text-xs text-zinc-400 md:col-span-2">
                                                Descrição
                                                <textarea [historyField]="{ column: 'habilities', label: 'Habilidades' }" [historyRead]="readHabilitiesHistory" class="min-h-20 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500" [(ngModel)]="hability.description" (ngModelChange)="onHabilitiesChange()" placeholder="Descreva o efeito da habilidade."></textarea>
                                              </label>
                                            </div>
                                          </article>
                                        }
                                      }

                                      @for (hability of getInheritedHabilitiesByType(type.value); track hability.favoriteKey) {
                                        <article class="ironpaw-ability-row ironpaw-ability-row--inherited">
                                          <div class="ironpaw-ability-row__toolbar">
                                            <div class="flex items-center gap-2">
                                              <span>{{ hability.sourceLabel }}</span>
                                              @if (hability.rollSkill) { <small>{{ skillLabel[hability.rollSkill] }}</small> }
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                              <button type="button" class="ironpaw-favorite-button" [class.is-favorite]="isActionFavorite(hability.favoriteKey)" [attr.aria-pressed]="isActionFavorite(hability.favoriteKey)" [attr.aria-label]="isActionFavorite(hability.favoriteKey) ? 'Remover habilidade dos favoritos' : 'Adicionar habilidade aos favoritos'" (click)="toggleActionFavorite(hability.favoriteKey)">
                                                <i class="fa-solid fa-star" aria-hidden="true"></i>
                                              </button>
                                              <button type="button" class="ironpaw-action-button" (click)="activateAbilityShortcut(hability)">{{ hability.rollSkill ? 'Preparar rolagem' : 'Ver efeito' }}</button>
                                            </div>
                                          </div>
                                          <h5>{{ hability.name || (hability.type === 'passive' ? 'Passiva sem nome' : 'Habilidade sem nome') }}</h5>
                                          <p>{{ hability.description || 'Sem descrição.' }}</p>
                                        </article>
                                      }

                                      @if (getOwnHabilitiesByType(type.value).length + getInheritedHabilitiesByType(type.value).length === 0) {
                                        <p class="ironpaw-skill-section__empty">Nenhuma habilidade {{ type.label.toLowerCase() }} cadastrada.</p>
                                      }
                                    </div>
                                  </section>
                                }
                              </div>
                            }
                          }

                      </div>

                    </div>
                  </div>
            </div>
          } @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione um personagem para ver a ficha
            </div>
          }
        </div>

      </div>
    </div>

    <button
      type="button"
      class="fixed cursor-pointer right-4 bottom-4 z-40 inline-flex items-center gap-1 rounded-md border px-1 py-0.5 text-sm shadow-2xl transition-all duration-200 hover:-translate-y-0.5 md:right-6 md:bottom-6"
      [ngClass]="isRollPanelOpen
        ? 'border-rose-500/40 bg-zinc-950 '
        : 'border-zinc-800 bg-zinc-925  hover:border-white '"
      (click)="toggleRollPanel()"
      [attr.aria-expanded]="isRollPanelOpen"
      aria-label="Abrir painel de rolagem">
      <span class="flex h-9 w-9 items-center justify-center">
        <i class="fa-solid text-sm" [ngClass]="isRollPanelOpen ? 'fa-xmark' : 'fa-dice'"></i>
      </span>
      <span class="text-xs font-semibold uppercase tracking-[0.22em]">Rolagens</span>
    </button>

    @if (isRollPanelOpen) {
      <section class="fixed right-4 bottom-[5.5rem] z-[39] w-[calc(100vw-2rem)] max-h-[calc(100vh-6.5rem)] overflow-y-auto rounded-md border border-zinc-800 bg-zinc-925 p-4 shadow-2xl backdrop-blur md:right-6 md:bottom-[6.25rem] md:w-[min(32rem,calc(100vw-3rem))] md:max-h-[calc(100vh-7.5rem)]">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <p class="text-[11px] uppercase tracking-[0.24em] text-amber-300/70 mb-1">Rolagem tática</p>
            <h2 class="text-sm font-semibold text-zinc-100">d10 simultâneos</h2>
            @if (rollShortcutLabel) {
              <p class="mt-1 text-[11px] text-zinc-400">{{ rollShortcutLabel }}</p>
            }
          </div>
          <button
            type="button"
            class="text-zinc-500 transition hover:text-zinc-100"
            (click)="toggleRollPanel()"
            aria-label="Fechar painel de rolagem">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <app-combo-box
            class="w-full"
            label="Perícia"
            [items]="rollSkillOptions"
            compareProp="id"
            displayProp="name"
            [clearable]="true"
            [(comboValue)]="selectedRollSkill"
            (comboValueChange)="onRollSkillChange()">
          </app-combo-box>

          <app-combo-box
            class="w-full"
            label="Bônus base"
            [items]="rollBonusSourceOptions"
            compareProp="id"
            displayProp="name"
            [(comboValue)]="selectedRollBonusSource"
            (comboValueChange)="onRollBonusSourceChange()">
          </app-combo-box>
        </div>

        @if (selectedRollBonusSource === 'perception') {
          <div class="mb-3">
            <app-combo-box
              class="w-full"
              label="Percepção usada no bônus"
              [items]="rollPerceptionOptions"
              compareProp="id"
              displayProp="name"
              [clearable]="true"
              [(comboValue)]="selectedRollPerception"
              (comboValueChange)="onRollPerceptionChange()">
            </app-combo-box>
          </div>
        }

        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="flex flex-col gap-1 text-xs text-zinc-400">
            Ajuste manual
            <input
              type="number"
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
              [(ngModel)]="rollManualModifier"
              (ngModelChange)="onRollManualModifierChange()">
          </label>
          <label class="flex flex-col gap-1 text-xs text-zinc-400">
            Valor para passar
            <input
              type="number"
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
              [(ngModel)]="rollTargetValue">
          </label>
        </div>

        <div class="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Fórmula</h3>
              <p class="text-[11px] text-zinc-500">Formato: <span class="font-mono">3d10+3</span></p>
            </div>
            <button
              type="button"
              class="rounded-full border px-2.5 py-1 text-[11px] transition"
              [ngClass]="rollFormulaMode === 'auto'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'"
              (click)="resetRollFormulaToAuto()">
              {{ rollFormulaMode === 'auto' ? 'Automática ativa' : 'Usar automática' }}
            </button>
          </div>

          <input
            type="text"
            class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500 font-mono"
            [ngModel]="rollFormula"
            (ngModelChange)="onRollFormulaInputChange($event)"
            placeholder="1d10+0">

          @if (rollFormulaError) {
            <p class="mt-2 text-[11px] text-red-300">{{ rollFormulaError }}</p>
          } @else {
            <div class="mt-3 flex flex-wrap gap-2">
              @for (modifier of rollPreview.modifiers; track modifier.key) {
                <span class="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300">
                  {{ modifier.label }}: {{ modifier.displayValue ?? formatSignedValue(modifier.value) }}
                </span>
              }

              @if (rollPreview.modifiers.length === 0) {
                <span class="rounded-full border border-dashed border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-500">
                  Sem bônus configurado
                </span>
              }
            </div>
          }
        </div>

        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="text-[11px] text-zinc-500">
            {{ getRollPreviewDescription() }}
          </div>
          <button
            type="button"
            class="rounded-xl border border-emerald-700 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            (click)="rollDice()">
            Rolar agora
          </button>
        </div>

        @if (lastRollFormula) {
          <div class="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
            Última rolagem: <span class="font-mono text-zinc-200">{{ lastRollFormula }}</span>
            @if (rollTargetValue != null) {
              <span class="text-zinc-500"> · alvo {{ rollTargetValue }}</span>
            }
          </div>
        }

        <div class="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
          @for (result of rollResults; track result.index) {
            <article
              class="rounded-2xl border p-3 text-zinc-200"
              [ngClass]="getRollResultCardClass(result.status)">
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[11px] uppercase tracking-wide opacity-80">Rolagem {{ result.index }}</span>
                <span class="text-[11px] opacity-70">{{ result.resolutionLabel }} {{ formatSignedValue(result.modifier) }}</span>
              </div>
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-[11px] opacity-75">Dado</p>
                  <p class="text-xl font-semibold leading-none">{{ result.dieValue }}</p>
                </div>
                <div class="text-right">
                  <p class="text-[11px] opacity-75">Total</p>
                  <p class="text-2xl font-bold leading-none">{{ result.total }}</p>
                </div>
              </div>
              @if (result.rolls.length > 1) {
                <p class="mt-2 text-[11px] opacity-70">Dados: {{ result.rolls.join(', ') }}</p>
              }
            </article>
          }

          @if (rollResults.length === 0) {
            <div class="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
              Configure a rolagem e execute para ver os resultados aqui.
            </div>
          }
        </div>
      </section>
    }
  `,
  styleUrl: './irpw-character-sheet.component.css',
})
export class IrpwCharacterSheetComponent implements OnInit {
  private readonly entityHistory = inject(EntityHistoryService);
  readonly readSubspecializationHistory = (): string => this.currentSheet?.subspecialization || '';
  readonly readHabilitiesHistory = (): string => this.currentSheet?.habilities || '';
  restoreSheetHistory(): void {
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
  isConditionSettingsOpen = false;

  perceptionsData: IrpwPerceptions = { smell: null, vision: null, hearing: null };
  vocationSkillMinimums: Record<SkillCode, number> = {} as Record<SkillCode, number>;

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
  readonly rollSkillOptions = this.attributeGroupEntries.flatMap(([group, skills]) =>
    skills.map(skill => ({ id: skill, name: `${this.skillLabel[skill]} · ${this.attributeGroupLabel[group]}` }))
  );
  private readonly skillToAttributeGroup = this.attributeGroupEntries.reduce((accumulator, [group, skills]) => {
    for (const skill of skills) {
      accumulator[skill] = group;
    }
    return accumulator;
  }, {} as Record<SkillCode, AttributeGroupCode>);

  lifepointsData: { maxPoints: number | null; currentPoints: number | null } = { maxPoints: null, currentPoints: null };
  defensepointsData: IrpwDefensePointsEnvelope = parseIrpwDefensePoints(null);
  resourceData: Record<string, { currentPoints: number | null }> = { stress: { currentPoints: null }, mana: { currentPoints: null }, vigor: { currentPoints: null } };
  readonly resourceStats: { key: string; label: string }[] = [
    { key: 'stress', label: 'Stress' },
    { key: 'mana', label: 'Mana' },
    { key: 'vigor', label: 'Vigor' },
  ];
  get lifeSegments(): number[] {
    return Array.from({ length: this.getMaxLifePoints() }, (_, index) => index + 1);
  }
  get resistanceSegments(): number[] {
    return Array.from({ length: Math.ceil(this.getMaxDefensePoints()) }, (_, index) => index + 1);
  }

  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;
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
  rollPreview: RollPreview = { attempts: 1, modifiers: [], totalModifier: 0, resolutionMode: 'normal' };
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
    this.attributesData = result;
    this.clampAttributesToVocationMinimums();
  }

  onAttributesChange() {
    if (this.currentSheet) {
      this.clampAttributesToVocationMinimums();
      this.currentSheet.attributes = JSON.stringify(this.attributesData);
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

  addHability() {
    this.habilitiesData = [...this.habilitiesData, this.createEmptyHability()];
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
      description: hability.description || 'Sem descrição registrada.',
    };
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

  getSkillLevel(group: string, skill: string): number {
    const storedLevel = this.normalizeSkillLevel(this.attributesData[group]?.skills[skill]);
    const minimumLevel = this.vocationSkillMinimums[skill as SkillCode] ?? 0;
    return Math.max(storedLevel, minimumLevel);
  }

  onCircleClick(event: Event, group: string, skill: string, level: number) {
    event.preventDefault();
    const current = this.getSkillLevel(group, skill);
    this.attributesData[group].skills[skill] = current === level ? 0 : this.normalizeSkillLevel(level);
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

  getLifeFillQuarters(segment: number): number {
    const currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, this.getMaxLifePoints()) ?? 0;
    const pointsWithinSegment = Math.max(0, Math.min(1, currentPoints - segment + 1));
    return Math.max(0, Math.min(4, Math.floor(pointsWithinSegment * 4 + 0.0001)));
  }

  setLifePoints(segment: number, quarter: number) {
    const nextValue = segment - 1 + quarter * 0.25;
    this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(nextValue, this.getMaxLifePoints());
    this.onLifepointsChange();
  }

  setLifePointsToZero(): void {
    this.lifepointsData.currentPoints = 0;
    this.onLifepointsChange();
  }

  formatLifeValue(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return '0';
    const normalizedValue = Math.round(Number(value) * 4) / 4;
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

  getResistanceFillState(segment: number): 0 | 1 | 2 {
    const current = this.defensepointsData.currentPoints ?? 0;
    if (current >= segment) return 2;
    if (current >= segment - 0.5) return 1;
    return 0;
  }

  setDefensePoints(segment: number, isFullSegment: boolean): void {
    const next = isFullSegment ? segment : segment - 0.5;
    this.defensepointsData.currentPoints = Math.min(this.getMaxDefensePoints(), Math.max(0, next));
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
    this.isLifeSettingsOpen = true;
  }

  closeLifeSettingsOverlay() {
    this.isLifeSettingsOpen = false;
  }

  saveLifeMaxPoints() {
    const maxPoints = Math.max(this.normalizeLifeMaxPoints(this.pendingLifeMaxPoints) ?? 0, this.getLifeMinimum());
    this.lifepointsData.maxPoints = maxPoints;
    this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, maxPoints);
    this.onLifepointsChange();
    this.closeLifeSettingsOverlay();
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

    const roundedToQuarter = Math.round(numericValue * 4) / 4;
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
        this.defensepointsData.currentPoints = Math.min(this.getMaxDefensePoints(), Math.max(0, Math.round(this.defensepointsData.currentPoints * 2) / 2));
      }
      this.currentSheet.defensepoints = JSON.stringify(this.defensepointsData);
      this.scheduleAutoSave();
    }
  }

  parseResources() {
    const keys: Array<{ key: keyof IrpwCharacterSheet }> = [
      { key: 'stress' }, { key: 'mana' }, { key: 'vigor' },
    ];
    for (const { key } of keys) {
      try {
        this.resourceData[key] = this.currentSheet?.[key]
          ? JSON.parse(this.currentSheet[key] as string)
          : { currentPoints: null };
      } catch { this.resourceData[key] = { currentPoints: null }; }
    }
  }

  onResourceChange() {
    if (this.currentSheet) {
      this.currentSheet.stress = JSON.stringify(this.resourceData['stress']);
      this.currentSheet.mana = JSON.stringify(this.resourceData['mana']);
      this.currentSheet.vigor = JSON.stringify(this.resourceData['vigor']);
      this.scheduleAutoSave();
    }
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
      this.rollFormulaError = 'Use o formato Xd10+Y, por exemplo 3d10+3.';
      this.rollResults = [];
      return;
    }

    this.rollResults = Array.from({ length: parsedFormula.attempts }, (_, index) => {
      const dieValue = this.rollDie(10);
      const total = dieValue + parsedFormula.modifier;
      return {
        index: index + 1,
        dieValue,
        rolls: [dieValue],
        modifier: parsedFormula.modifier,
        total,
        status: this.getRollStatus(total),
        resolutionLabel: '1d10',
      };
    });
    this.lastRollFormula = this.rollFormula;
  }

  getRollPreviewDescription(): string {
    if (this.rollPreview.resolutionMode === 'disadvantage') {
      return `1 tentativa com desvantagem e modificador total ${this.formatSignedValue(this.rollPreview.totalModifier)}`;
    }

    return `${this.rollPreview.attempts} tentativa(s) com modificador total ${this.formatSignedValue(this.rollPreview.totalModifier)}`;
  }

  formatSignedValue(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  getRollResultCardClass(status: RollStatus): string {
    switch (status) {
      case 'success':
        return 'border-emerald-500/45 bg-emerald-950/40 text-emerald-100';
      case 'near':
        return 'border-amber-400/45 bg-amber-950/30 text-amber-100';
      case 'fail':
        return 'border-red-500/40 bg-red-950/35 text-red-100';
      default:
        return 'border-zinc-700 bg-zinc-900/70 text-zinc-200';
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
    this.rollPreview = this.buildAutoRollPreview();
    if (this.rollFormulaMode === 'auto') {
      this.rollFormula = this.buildRollFormula(this.rollPreview);
      this.rollFormulaError = '';
    }
  }

  private refreshRollPreviewFromFormula() {
    const parsedFormula = this.parseRollFormula(this.rollFormula);
    if (!parsedFormula) {
      this.rollPreview = { attempts: 1, modifiers: [], totalModifier: 0, resolutionMode: 'normal' };
      this.rollFormulaError = 'Use o formato Xd10+Y, por exemplo 3d10+3.';
      return;
    }

    this.rollPreview = {
      attempts: parsedFormula.attempts,
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
    return { attempts, modifiers, totalModifier, resolutionMode };
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

  private parseRollFormula(formula: string): { attempts: number; modifier: number } | null {
    const match = formula.trim().match(/^(\d+)\s*d\s*10\s*([+-]\s*\d+)?$/i);
    if (!match) return null;

    const attempts = Number(match[1]);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 50) return null;

    const modifier = match[2] ? Number(match[2].replace(/\s+/g, '')) : 0;
    if (!Number.isFinite(modifier)) return null;

    return { attempts, modifier };
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
