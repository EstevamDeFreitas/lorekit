import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent],
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
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3">
              </div>
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3">
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

  perceptionsData: { smell: number | null; vision: number | null; hearing: number | null } = { smell: null, vision: null, hearing: null };

  attributesData: Record<string, { value: number | null; skills: Record<string, number> }> = {};
  readonly attributeGroupEntries = Object.entries(ATTRIBUTE_GROUP_SKILLS) as [AttributeGroupCode, SkillCode[]][];
  readonly attributeGroupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly skillLabel = SKILL_LABEL;

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

