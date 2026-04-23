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
import { IrpwVocation } from '../../../models/irpw-vocation.model';
import { IrpwSpecieService } from '../../../services/irpw-specie.service';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';
import { SpecieService } from '../../../services/specie.service';

type RollBonusSourceType = 'attribute' | 'perception';
type RollFormulaMode = 'auto' | 'manual';
type PerceptionKey = 'smell' | 'vision' | 'hearing';
type RollStatus = 'success' | 'near' | 'fail' | 'neutral';

interface RollOption<TValue extends string> {
  id: TValue;
  name: string;
}

interface RollModifier {
  key: string;
  label: string;
  value: number;
  category: 'skill' | 'source' | 'manual' | 'condition';
}

interface RollPreview {
  attempts: number;
  modifiers: RollModifier[];
  totalModifier: number;
}

interface RollResult {
  index: number;
  dieValue: number;
  modifier: number;
  total: number;
  status: RollStatus;
}

@Component({
  selector: 'irpw-character-sheet',
  imports: [CommonModule, NgClass, FormsModule, OverlayModule, ComboBoxComponent],
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
              <!-- Stress, Mana & Vigor -->
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3 flex flex-col gap-3">

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
                    <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3 flex-1 overflow-y-auto">
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
                  </div>
                  <div class="col-span-2 p-3">

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
                  {{ modifier.label }}: {{ formatSignedValue(modifier.value) }}
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
            {{ rollPreview.attempts }} tentativa(s) com modificador total {{ formatSignedValue(rollPreview.totalModifier) }}
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
                <span class="text-[11px] opacity-70">d10 {{ formatSignedValue(result.modifier) }}</span>
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

  selectedCharacterId = '';
  selectedCharacter: Character | null = null;
  currentSheet: IrpwCharacterSheet | null = null;

  isSaving = false;
  private saveTimeout?: ReturnType<typeof setTimeout>;
  isLifeSettingsOpen = false;
  pendingLifeMaxPoints: number | null = null;

  perceptionsData: { smell: number | null; vision: number | null; hearing: number | null } = { smell: null, vision: null, hearing: null };

  attributesData: Record<string, { value: number | null; skills: Record<string, number> }> = {};
  readonly attributeGroupEntries = Object.entries(ATTRIBUTE_GROUP_SKILLS) as [AttributeGroupCode, SkillCode[]][];
  readonly attributeGroupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly skillLabel = SKILL_LABEL;
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
  rollPreview: RollPreview = { attempts: 1, modifiers: [], totalModifier: 0 };
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
    } else if (this.selectedCharacterId) {
      this.selectedCharacter = this.characters.find(c => c.id === this.selectedCharacterId) ?? this.selectedCharacter;
      this.selectedSpecieId = this.selectedCharacter?.ParentSpecies?.id ?? '';
      this.selectedVocationId = this.selectedCharacter?.ParentIRPWVocation?.id ?? '';
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
    this.parseLifepoints();
    this.parseDefensepoints();
    this.parseResources();
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
        modifier: parsedFormula.modifier,
        total,
        status: this.getRollStatus(total),
      };
    });
    this.lastRollFormula = this.rollFormula;
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
      this.rollPreview = { attempts: 1, modifiers: [], totalModifier: 0 };
      this.rollFormulaError = 'Use o formato Xd10+Y, por exemplo 3d10+3.';
      return;
    }

    this.rollPreview = {
      attempts: parsedFormula.attempts,
      modifiers: [{ key: 'manual-formula', label: 'Fórmula manual', value: parsedFormula.modifier, category: 'manual' }],
      totalModifier: parsedFormula.modifier,
    };
    this.rollFormulaError = '';
  }

  private buildAutoRollPreview(): RollPreview {
    const modifiers: RollModifier[] = [];
    const attempts = this.getAutoRollAttempts();
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

    const totalModifier = modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
    return { attempts, modifiers, totalModifier };
  }

  private buildRollFormula(preview: RollPreview): string {
    const modifierText = preview.totalModifier === 0 ? '' : this.formatSignedValue(preview.totalModifier);
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

