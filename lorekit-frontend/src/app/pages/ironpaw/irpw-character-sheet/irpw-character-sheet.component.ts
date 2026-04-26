import { CommonModule, NgClass } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { Character } from '../../../models/character.model';
import { IrpwCharacterSheet } from '../../../models/irpw-character-sheet.model';
import { World } from '../../../models/world.model';
import { CharacterService } from '../../../services/character.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { IrpwCharacterSheetService } from '../../../services/irpw-character-sheet.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';
import { getPersonalizationValue, getTextColorStyle } from '../../../models/personalization.model';
import { ATTRIBUTE_GROUP_SKILLS, ATTRIBUTE_GROUP_LABEL, SKILL_LABEL, AttributeGroupCode, SkillCode } from '../../../models/irpw-attributes-skills.model';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { getImageByUsageKey } from '../../../models/image.model';
import { Specie } from '../../../models/specie.model';
import { IrpwVocation, IrpwVocationAttributes, IrpwVocationHability } from '../../../models/irpw-vocation.model';
import { IrpwSpecieService } from '../../../services/irpw-specie.service';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';
import { SpecieService } from '../../../services/specie.service';
import { NavButtonComponent } from '../../../components/nav-button/nav-button.component';
import {
  ActiveConditionState,
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

interface InheritedCharacterHability extends IrpwVocationHability {
  source: 'species' | 'vocation';
}

@Component({
  selector: 'irpw-character-sheet',
  imports: [CommonModule, NgClass, FormsModule, OverlayModule, ComboBoxComponent, NavButtonComponent],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4 relative">

        <!-- Sidebar -->
        <div class="transition-all duration-300 overflow-clip shrink-0" [ngClass]="showSidebar ? 'w-80' : 'w-0'">
          <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
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

        <!-- Sheet view -->
        <div class="flex-1 min-h-[60vh] p-4 flex flex-col">
          @if (selectedCharacter) {
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3">
                <div class="flex flex-row gap-3">
                  @if(getImageByUsageKey(selectedCharacter.Images, 'profile') != null){
                    @let profileImg = getImageByUsageKey(selectedCharacter.Images, 'profile');
                    <img [src]="profileImg?.filePath" class="h-[12vh] object-cover rounded-md">
                  }
                  @else {
                    <div class="h-[12vh] w-[12vh] bg-zinc-800 rounded-md flex items-center justify-center text-zinc-500">
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
                    <app-combo-box
                      class="w-full"
                      label="Espécie"
                      [items]="availableSpecies"
                      compareProp="id"
                      displayProp="name"
                      [clearable]="true"
                      [(comboValue)]="selectedSpecieId"
                      (comboValueChange)="onSpecieSelect()">
                    </app-combo-box>
                    <app-combo-box
                      class="w-full"
                      label="Vocação"
                      [items]="availableVocations"
                      compareProp="id"
                      displayProp="name"
                      [clearable]="true"
                      [(comboValue)]="selectedVocationId"
                      (comboValueChange)="onVocationSelect()">
                    </app-combo-box>
                  </div>
                </div>

              </div>
              <!-- Lifepoints & Defensepoints -->
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3 flex flex-col gap-3">
                <div>
                  <div class="flex items-center justify-between gap-3 mb-2">
                    <div class="flex items-center gap-2">
                      <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Vida</h2>
                      <span class="text-[10px] text-zinc-500">{{ formatLifeValue(lifepointsData.currentPoints) }}/{{ formatLifeValue(lifepointsData.maxPoints) }}</span>
                    </div>
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
                  <div class="flex flex-wrap gap-1.5">
                    @for (lifeSegment of lifeSegments; track lifeSegment) {
                      <div class="life-square" [class.is-half]="getLifeFillState(lifeSegment) === 1" [class.is-full]="getLifeFillState(lifeSegment) === 2">
                        <button
                          type="button"
                          class="life-square-half left"
                          [class.is-active]="getLifeFillState(lifeSegment) >= 1"
                          (click)="setLifePoints(lifeSegment, false)"
                          [attr.aria-label]="'Definir vida em ' + formatLifeValue(lifeSegment - 0.5)">
                        </button>
                        <button
                          type="button"
                          class="life-square-half right"
                          [class.is-active]="getLifeFillState(lifeSegment) === 2"
                          (click)="setLifePoints(lifeSegment, true)"
                          [attr.aria-label]="'Definir vida em ' + formatLifeValue(lifeSegment)">
                        </button>
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
                <div class="flex flex-row gap-6">
                  <div>
                    <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Resistência</h2>
                    <div class="flex items-center gap-2">
                      <div class="flex flex-col items-center">
                        <span class="text-[10px] text-zinc-500 mb-0.5">Atual</span>
                        <input type="number" class="w-14 text-center bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                          [(ngModel)]="defensepointsData.currentPoints"
                          (ngModelChange)="onDefensepointsChange()">
                      </div>
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
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Condições</h2>
                    <p class="text-[10px] text-zinc-500">{{ activeConditionsData.length }} ativa(s)</p>
                  </div>
                  <button
                    type="button"
                    class="px-1 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                    cdkOverlayOrigin
                    #conditionSettingsOrigin="cdkOverlayOrigin"
                    (click)="toggleConditionSettingsOverlay()"
                    aria-label="Configurar condições"
                    title="Configurar condições">
                    <i class="fa-solid fa-gear text-xs"></i>
                  </button>
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
            <div class="grid grid-cols-3 gap-2 mt-2 flex-1">
                  <div class="flex flex-col h-full">
                    <div class="flex flex-col rounded-md bg-zinc-925 border border-zinc-800 p-3 mb-2">
                      <h1 class="text-center mb-2">Percepções</h1>
                      <div class="flex flex-row justify-center gap-6">
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-xs text-zinc-400">Olfato</span>
                          <input type="number" class="w-12 text-center bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                            [(ngModel)]="perceptionsData.smell"
                            (ngModelChange)="onPerceptionsChange()">
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-xs text-zinc-400">Visão</span>
                          <input type="number" class="w-12 text-center bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-sm text-white outline-none focus:border-zinc-500"
                            [(ngModel)]="perceptionsData.vision"
                            (ngModelChange)="onPerceptionsChange()">
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-xs text-zinc-400">Audição</span>
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
                                  <span class="text-xs text-zinc-400">{{ skillLabel[skill] }}</span>
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
                          <input
                            type="text"
                            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                            [ngModel]="subspecialization"
                            (ngModelChange)="onSubspecializationChange(subspecializationIndex, $event)"
                            [placeholder]="subspecializationIndex === subspecializationsData.length - 1 ? 'Adicionar subespecialização...' : 'Subespecialização'">
                        }
                      </div>
                    </div>
                  </div>
                  <div class="col-span-2 p-3">
                    <div class="flex-4 flex flex-col">
                      <div class="flex flex-row gap-4 ms-1">
                        <app-nav-button buttonType="pink" [label]="'Geral'" size="sm" [active]="currentTab === 'general'" (click)="currentTab = 'general'"></app-nav-button>
                        <app-nav-button buttonType="pink" [label]="'Marcos'" size="sm" [active]="currentTab === 'marks'" (click)="currentTab = 'marks'"></app-nav-button>
                        <app-nav-button buttonType="pink" [label]="'Inventário'" size="sm" [active]="currentTab === 'inventory'" (click)="currentTab = 'inventory'"></app-nav-button>
                        <app-nav-button buttonType="pink" [label]="'Habilidades'" size="sm" [active]="currentTab === 'skills'" (click)="currentTab = 'skills'"></app-nav-button>
                      </div>
                      <div class="p-4 pb-10 rounded-lg mt-2 flex-1 flex flex-col">
                          @switch (currentTab) {
                            @case ('general') {
                              <p>Geral</p>
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
                                              <input
                                                type="text"
                                                class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                [(ngModel)]="mark.name"
                                                (ngModelChange)="onMarksChange()"
                                                placeholder="Ex.: Juramento da Vigília">
                                            </label>

                                            <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                              Tipo de marco narrativo
                                              <input
                                                type="text"
                                                class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                [(ngModel)]="mark.narrativeType"
                                                (ngModelChange)="onMarksChange()"
                                                placeholder="Ex.: Revelação, Trauma, Ascensão">
                                            </label>

                                            <label class="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-400">
                                              Descrição
                                              <textarea
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
                                                      <input
                                                        type="text"
                                                        class="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                        [(ngModel)]="hability.name"
                                                        (ngModelChange)="onMarksChange()"
                                                        placeholder="Opcional">
                                                    </label>

                                                    <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                      Descrição
                                                      <textarea
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
                                                      <input
                                                        type="text"
                                                        class="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                                        [(ngModel)]="weakness.name"
                                                        (ngModelChange)="onMarksChange()"
                                                        placeholder="Opcional">
                                                    </label>

                                                    <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                                      Descrição
                                                      <textarea
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
                              <p>Inventário</p>
                            }
                            @case ('skills') {
                              <div class="flex flex-col gap-4">
                                <div class="flex items-center justify-between gap-3">
                                  <div>
                                    <h3 class="text-sm font-semibold text-zinc-100">Habilidades do personagem</h3>
                                    <p class="text-xs text-zinc-500">Essas habilidades ficam salvas na ficha e podem ser editadas livremente.</p>
                                  </div>
                                  <button
                                    type="button"
                                    class="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                    (click)="addHability()">
                                    Adicionar habilidade
                                  </button>
                                </div>

                                <div class="flex flex-col gap-3">
                                  @for (hability of habilitiesData; track $index; let habilityIndex = $index) {
                                    <div class="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
                                      <div class="flex items-center justify-between gap-3 mb-3">
                                        <span class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Habilidade {{ habilityIndex + 1 }}</span>
                                        <button
                                          type="button"
                                          class="rounded-md border border-red-900/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 transition hover:bg-red-950/70"
                                          (click)="removeHability(habilityIndex)">
                                          Remover
                                        </button>
                                      </div>

                                      <div class="grid grid-cols-1 gap-3">
                                        <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                          Nome
                                          <input
                                            type="text"
                                            class="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                            [(ngModel)]="hability.name"
                                            (ngModelChange)="onHabilitiesChange()"
                                            placeholder="Ex.: Passos entre as sombras">
                                        </label>

                                        <label class="flex flex-col gap-1 text-xs text-zinc-400">
                                          Descrição
                                          <textarea
                                            class="min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500"
                                            [(ngModel)]="hability.description"
                                            (ngModelChange)="onHabilitiesChange()"
                                            placeholder="Descreva o efeito da habilidade."></textarea>
                                        </label>
                                      </div>
                                    </div>
                                  }

                                  @if (habilitiesData.length === 0) {
                                    <div class="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                                      Nenhuma habilidade própria cadastrada para este personagem.
                                    </div>
                                  }
                                </div>

                                <div class="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
                                  <div class="mb-3">
                                    <h3 class="text-sm font-semibold text-zinc-100">Habilidades herdadas</h3>
                                    <p class="text-xs text-zinc-500">Vindas da espécie ou da vocação. Essas entradas são apenas leitura nesta ficha.</p>
                                  </div>

                                  <div class="flex flex-col gap-3">
                                    @for (hability of inheritedHabilitiesData; track $index) {
                                      <div class="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                                        <div class="flex items-center justify-between gap-3 mb-2">
                                          <span class="text-sm text-zinc-100">{{ hability.name || 'Habilidade sem nome' }}</span>
                                          <span
                                            class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                            [ngClass]="hability.source === 'species'
                                              ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200'
                                              : 'border-sky-800/70 bg-sky-950/40 text-sky-200'">
                                            {{ hability.source === 'species' ? 'Espécie' : 'Vocação' }}
                                          </span>
                                        </div>
                                        <p class="text-sm leading-6 whitespace-pre-line text-zinc-300">{{ hability.description || 'Sem descrição.' }}</p>
                                      </div>
                                    }

                                    @if (inheritedHabilitiesData.length === 0) {
                                      <div class="rounded-md border border-dashed border-zinc-700 px-4 py-6 text-center text-xs text-zinc-500">
                                        Nenhuma habilidade herdada encontrada na espécie ou vocação atual.
                                      </div>
                                    }
                                  </div>
                                </div>
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
  private dialog = inject(Dialog);
  private characterService = inject(CharacterService);
  private specieService = inject(SpecieService);
  private irpwSpecieService = inject(IrpwSpecieService);
  private vocationService = inject(IrpwVocationService);
  private worldService = inject(WorldService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);
  private sheetService = inject(IrpwCharacterSheetService);

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
  private saveTimeout?: ReturnType<typeof setTimeout>;
  isLifeSettingsOpen = false;
  pendingLifeMaxPoints: number | null = null;
  isConditionSettingsOpen = false;

  perceptionsData: { smell: number | null; vision: number | null; hearing: number | null } = { smell: null, vision: null, hearing: null };

  attributesData: Record<string, { value: number | null; skills: Record<string, number> }> = {};
  subspecializationsData: string[] = [''];
  habilitiesData: IrpwVocationHability[] = [];
  inheritedHabilitiesData: InheritedCharacterHability[] = [];
  marksData: IrpwCharacterMark[] = [];
  activeConditionsData: ActiveConditionState[] = [];
  pendingConditionsData: ActiveConditionState[] = [];
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
  readonly conditionDefinitions = Object.values(CONDITIONS).sort((left, right) => left.label.localeCompare(right.label));
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
  defensepointsData: { currentPoints: number | null } = { currentPoints: null };
  resourceData: Record<string, { currentPoints: number | null }> = { stress: { currentPoints: null }, mana: { currentPoints: null }, vigor: { currentPoints: null } };
  readonly resourceStats: { key: string; label: string }[] = [
    { key: 'stress', label: 'Stress' },
    { key: 'mana', label: 'Mana' },
    { key: 'vigor', label: 'Vigor' },
  ];
  get lifeSegments(): number[] {
    return Array.from({ length: this.getMaxLifePoints() }, (_, index) => index + 1);
  }

  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;
  public getImageByUsageKey = getImageByUsageKey;

  isRollPanelOpen = false;
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

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';
      if (this.selectedWorldId === nextWorldId) return;
      this.selectedWorldId = nextWorldId;
      this.loadCharacters();
    });

    this.entityChangeService.changes$.subscribe(event => {
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
    this.syncRollFormula();
  }

  loadSpecies() {
    this.availableSpecies = this.specieService
      .getSpecies(null, this.selectedWorldId || null)
      .filter(specie => !!this.irpwSpecieService.getConfig(specie.id))
      .sort((left, right) => (left.name || 'Espécie sem nome').localeCompare(right.name || 'Espécie sem nome'));
  }

  loadVocations() {
    this.availableVocations = this.vocationService
      .getVocations()
      .sort((left, right) => (left.name || 'Vocação sem nome').localeCompare(right.name || 'Vocação sem nome'));
  }

  loadCharacters() {
    this.characters = this.characterService
      .getCharacters(this.selectedWorldId || null)
      .sort((a, b) => a.name.localeCompare(b.name));

    this.applySearch();

    if (this.selectedCharacterId && !this.characters.some(c => c.id === this.selectedCharacterId)) {
      this.selectedCharacterId = '';
      this.selectedSpecieId = '';
      this.selectedVocationId = '';
      this.selectedCharacter = null;
      this.currentSheet = null;
      this.subspecializationsData = [''];
      this.habilitiesData = [];
      this.inheritedHabilitiesData = [];
      this.activeConditionsData = [];
      this.pendingConditionsData = [];
      this.marksData = [];
      this.expandedMarkIndexes.clear();
    } else if (this.selectedCharacterId) {
      this.selectedCharacter = this.characters.find(c => c.id === this.selectedCharacterId) ?? this.selectedCharacter;
      this.selectedSpecieId = this.selectedCharacter?.ParentSpecies?.id ?? '';
      this.selectedVocationId = this.selectedCharacter?.ParentIRPWVocation?.id ?? '';
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

  selectCharacter(characterId: string) {
    if (this.selectedCharacterId === characterId) return;

    this.selectedCharacterId = characterId;
    this.selectedCharacter = this.characters.find(c => c.id === characterId) ?? null;
    this.selectedSpecieId = this.selectedCharacter?.ParentSpecies?.id ?? '';
    this.selectedVocationId = this.selectedCharacter?.ParentIRPWVocation?.id ?? '';
    this.currentSheet = this.sheetService.getSheet(characterId);

    if (!this.currentSheet) {
      this.currentSheet = new IrpwCharacterSheet(characterId);
      this.currentSheet = this.sheetService.saveSheet(characterId, this.currentSheet);
    }

    this.parsePerceptions();
    this.parseAttributes();
    this.parseSubspecializations();
    this.parseHabilities();
    this.parseLifepoints();
    this.parseDefensepoints();
    this.parseResources();
    this.parseConditions();
    this.parseMarks();
    this.refreshInheritedHabilities();
    this.syncRollFormula();
  }

  onSpecieSelect() {
    if (!this.selectedCharacterId || !this.selectedCharacter) return;

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

    this.refreshInheritedHabilities();
  }

  onVocationSelect() {
    if (!this.selectedCharacterId || !this.selectedCharacter) return;

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
    try {
      this.perceptionsData = this.currentSheet?.perceptions
        ? JSON.parse(this.currentSheet.perceptions)
        : { smell: null, vision: null, hearing: null };
    } catch {
      this.perceptionsData = { smell: null, vision: null, hearing: null };
    }
  }

  onPerceptionsChange() {
    if (this.currentSheet) {
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
  }

  onAttributesChange() {
    if (this.currentSheet) {
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
        ? parsed.map(hability => this.normalizeHability(hability))
        : [];
    } catch {
      this.habilitiesData = [];
    }
  }

  onHabilitiesChange() {
    this.habilitiesData = this.habilitiesData.map(hability => this.normalizeHability(hability));

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
    this.habilitiesData = this.habilitiesData.filter((_, currentIndex) => currentIndex !== index);
    this.onHabilitiesChange();
  }

  getSkillLevel(group: string, skill: string): number {
    return this.normalizeSkillLevel(this.attributesData[group]?.skills[skill]);
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
      const maxPoints = this.normalizeLifeMaxPoints(parsed.maxPoints);
      this.lifepointsData = {
        maxPoints,
        currentPoints: this.normalizeLifeCurrentPoints(parsed.currentPoints, maxPoints),
      };
    } catch {
      this.lifepointsData = { maxPoints: null, currentPoints: null };
    }
  }

  onLifepointsChange() {
    if (this.currentSheet) {
      const maxPoints = this.normalizeLifeMaxPoints(this.lifepointsData.maxPoints);
      this.lifepointsData.maxPoints = maxPoints;
      this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, maxPoints);
      this.currentSheet.lifepoints = JSON.stringify(this.lifepointsData);
      this.scheduleAutoSave();
    }
  }

  getLifeFillState(segment: number): 0 | 1 | 2 {
    const currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, this.getMaxLifePoints()) ?? 0;
    if (currentPoints >= segment) return 2;
    if (currentPoints >= segment - 0.5) return 1;
    return 0;
  }

  setLifePoints(segment: number, isFullSegment: boolean) {
    const nextValue = isFullSegment ? segment : segment - 0.5;
    this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(nextValue, this.getMaxLifePoints());
    this.onLifepointsChange();
  }

  formatLifeValue(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return '0';
    const normalizedValue = Math.round(Number(value) * 2) / 2;
    return Number.isInteger(normalizedValue)
      ? `${normalizedValue}`
      : normalizedValue.toFixed(1).replace('.', ',');
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
    const maxPoints = this.normalizeLifeMaxPoints(this.pendingLifeMaxPoints);
    this.lifepointsData.maxPoints = maxPoints;
    this.lifepointsData.currentPoints = this.normalizeLifeCurrentPoints(this.lifepointsData.currentPoints, maxPoints);
    this.onLifepointsChange();
    this.closeLifeSettingsOverlay();
  }

  private getMaxLifePoints(): number {
    return this.normalizeLifeMaxPoints(this.lifepointsData.maxPoints) ?? 0;
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

    const roundedToHalf = Math.round(numericValue * 2) / 2;
    const clampedValue = Math.max(0, maxPoints == null ? roundedToHalf : Math.min(roundedToHalf, maxPoints));
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
      this.pendingConditionsData = [];
      return;
    }

    try {
      this.activeConditionsData = this.normalizeActiveConditions(JSON.parse(this.currentSheet.conditions));
    } catch {
      this.activeConditionsData = [];
    }

    this.pendingConditionsData = this.activeConditionsData.map(condition => ({ ...condition }));
  }

  onConditionsChange() {
    this.activeConditionsData = this.normalizeActiveConditions(this.activeConditionsData);
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
    return CONDITIONS[code];
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
    return { name: null, description: '' };
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

  private normalizeHability(value: unknown): IrpwVocationHability {
    if (!value || typeof value !== 'object') {
      return this.createEmptyHability();
    }

    const source = value as Partial<IrpwVocationHability>;
    return {
      name: this.normalizeOptionalText(source.name),
      description: typeof source.description === 'string' ? source.description : '',
    };
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
    return this.parseHabilityList(specieConfig?.passive)
      .map(hability => ({ ...hability, source: 'species' as const }));
  }

  private getInheritedVocationHabilities(): InheritedCharacterHability[] {
    const rawHabilities = this.selectedCharacter?.ParentIRPWVocation?.habilities;
    return this.parseHabilityList(rawHabilities)
      .map(hability => ({ ...hability, source: 'vocation' as const }));
  }

  private parseHabilityList(rawValue: string | null | undefined): IrpwVocationHability[] {
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return parsed.map(item => this.normalizeHability(item));
      }

      return parsed && typeof parsed === 'object'
        ? [this.normalizeHability(parsed)]
        : [];
    } catch {
      return [];
    }
  }

  parseDefensepoints() {
    try {
      this.defensepointsData = this.currentSheet?.defensepoints
        ? JSON.parse(this.currentSheet.defensepoints)
        : { currentPoints: null };
    } catch { this.defensepointsData = { currentPoints: null }; }
  }

  onDefensepointsChange() {
    if (this.currentSheet) {
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
    this.marksData = [...this.marksData, this.createEmptyMark()];
    this.expandedMarkIndexes.add(this.marksData.length - 1);
    this.onMarksChange();
  }

  removeMark(index: number) {
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
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.habilities = [...mark.habilities, this.createEmptyHability()];
    this.onMarksChange();
  }

  addMarkWeakness(markIndex: number) {
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.weaknesses = [...mark.weaknesses, this.createEmptyHability()];
    this.onMarksChange();
  }

  removeMarkHability(markIndex: number, habilityIndex: number) {
    const mark = this.marksData[markIndex];
    if (!mark) return;

    mark.habilities = mark.habilities.filter((_, currentIndex) => currentIndex !== habilityIndex);
    this.onMarksChange();
  }

  removeMarkWeakness(markIndex: number, weaknessIndex: number) {
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
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.isSaving = true;
    this.saveTimeout = setTimeout(() => {
      if (this.selectedCharacterId && this.currentSheet) {
        this.sheetService.saveSheet(this.selectedCharacterId, this.currentSheet);
      }
      this.isSaving = false;
    }, 600);
  }

  toggleRollPanel() {
    this.isRollPanelOpen = !this.isRollPanelOpen;
    this.updateRollFormulaIfAuto();
  }

  onRollSkillChange() {
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

      normalizedConditions.set(rawCode, { code: rawCode, severity });
    }

    return [...normalizedConditions.values()].sort((left, right) => {
      const leftDefinition = this.getConditionDefinition(left.code);
      const rightDefinition = this.getConditionDefinition(right.code);
      return leftDefinition.label.localeCompare(rightDefinition.label);
    });
  }

  private isConditionCode(value: unknown): value is ConditionCode {
    return typeof value === 'string' && Object.hasOwn(CONDITIONS, value);
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

