import { CommonModule, NgClass } from '@angular/common';
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
                  <p class="text-sm mb-1">{{ selectedCharacter.name }}</p>
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
                      class="h-6 w-6 rounded-md border border-zinc-700 bg-zinc-850 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
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
                    <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Defesa</h2>
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
                                  <div class="flex gap-1.5">
                                    @for (level of [0,1,2,3]; track level) {
                                      <input
                                        type="checkbox"
                                        class="circle-checkbox level-{{level}}"
                                        [checked]="getSkillLevel(entry[0], skill) >= level"
                                        (click)="onCircleClick($event, entry[0], skill, level)">
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
  `,
  styleUrl: './irpw-character-sheet.component.css',
})
export class IrpwCharacterSheetComponent implements OnInit {
  private characterService = inject(CharacterService);
  private worldService = inject(WorldService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);
  private sheetService = inject(IrpwCharacterSheetService);

  availableWorlds: World[] = [];
  characters: Character[] = [];
  filteredCharacters: Character[] = [];

  selectedWorldId = '';
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

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';
      if (this.selectedWorldId === nextWorldId) return;
      this.selectedWorldId = nextWorldId;
      this.loadCharacters();
    });

    this.entityChangeService.changes$.subscribe(event => {
      if (event.table === 'Character') {
        this.loadCharacters();
      }
    });

    this.availableWorlds = this.worldService.getWorlds();
    this.loadCharacters();
  }

  loadCharacters() {
    this.characters = this.characterService
      .getCharacters(this.selectedWorldId || null)
      .sort((a, b) => a.name.localeCompare(b.name));

    this.applySearch();

    if (this.selectedCharacterId && !this.characters.some(c => c.id === this.selectedCharacterId)) {
      this.selectedCharacterId = '';
      this.selectedCharacter = null;
      this.currentSheet = null;
    }
  }

  onWorldSelect() {
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
        result[group].skills[skill] = parsed[group]?.skills?.[skill] ?? -1;
      }
    }
    this.attributesData = result;
  }

  onAttributesChange() {
    if (this.currentSheet) {
      this.currentSheet.attributes = JSON.stringify(this.attributesData);
      this.scheduleAutoSave();
    }
  }

  getSkillLevel(group: string, skill: string): number {
    return this.attributesData[group]?.skills[skill] ?? -1;
  }

  onCircleClick(event: Event, group: string, skill: string, level: number) {
    event.preventDefault();
    const current = this.getSkillLevel(group, skill);
    this.attributesData[group].skills[skill] = current === level ? -1 : level;
    this.onAttributesChange();
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
}

