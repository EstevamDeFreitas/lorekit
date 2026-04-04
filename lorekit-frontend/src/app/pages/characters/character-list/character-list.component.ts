import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { Character } from '../../../models/character.model';
import { Specie } from '../../../models/specie.model';
import { World } from '../../../models/world.model';
import { CharacterService } from '../../../services/character.service';
import { SpecieService } from '../../../services/specie.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';
import { getPersonalizationValue, getTextClass, getTextColorStyle } from '../../../models/personalization.model';

@Component({
  selector: 'app-character-list',
  imports: [CommonModule, NgClass, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4 relative">
        <div class="transition-all duration-300 overflow-clip shrink-0" [ngClass]="showsidebar ? 'w-80' : 'w-0'">
          <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
            <div class="flex flex-row justify-between mb-6">
              <h2 class="text-base mb-4">Personagens</h2>
              <app-icon-button
                size="sm"
                buttonType="secondary"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="'Criar Personagem'"
                [fields]="getFormFields()"
                (onSave)="createCharacter($event)">
              </app-icon-button>
            </div>

            @if (!worldId()) {
              <div class="mb-4">
                <app-combo-box
                  class="w-full"
                  label="Filtro de mundo"
                  [items]="availableWorlds"
                  compareProp="id"
                  displayProp="name"
                  [(comboValue)]="selectedWorld"
                  (comboValueChange)="onWorldSelect()">
                </app-combo-box>
              </div>
            }

            <div class="flex flex-col gap-3 w-full">
              @for (character of characters; track character.id) {
                <button
                  type="button"
                  class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                  [ngClass]="selectedCharacterId === character.id ? 'text-yellow-300' : 'text-zinc-400'"
                  [ngStyle]="{'color':getTextColorStyle(getPersonalizationValue(character, 'color'))}"
                  (click)="selectCharacter(character.id)">
                  <div class="flex flex-row items-center">
                    <i class="fa-solid" [ngClass]="getPersonalizationValue(character, 'icon') || 'fa-user'"></i>
                  </div>
                  <h2 [title]="character.name" class="text-xs">{{ character.name }}</h2>
                </button>
              }

              @if (characters.length === 0) {
                <p class="text-xs text-zinc-500">Nenhum personagem encontrado.</p>
              }
            </div>
          </div>
        </div>

        <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[showsidebar ? 'start-92' : 'start-12']" (click)="showsidebar = !showsidebar">
          <i class="fa-solid text-zinc-400" [ngClass]="[showsidebar ? 'fa-angles-left' : 'fa-angles-right']"></i>
        </small>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedCharacterId) {
            <div class="rounded-md px-2">
              @if (showCharacterEditor && characterEditComponent) {
                <ng-container *ngComponentOutlet="characterEditComponent; inputs: { characterIdInput: selectedCharacterId }"></ng-container>
              }
              @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando personagem...
                </div>
              }
            </div>
          }
          @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione um personagem para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './character-list.component.css',
})
export class CharacterListComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private characterService = inject(CharacterService);
  private worldService = inject(WorldService);
  private specieService = inject(SpecieService);
  private worldStateService = inject(WorldStateService);

  worldId = input<string>();
  availableWorlds: World[] = [];
  availableSpecies: Specie[] = [];
  selectedWorld = '';
  characters: Character[] = [];

  showsidebar = true;

  selectedCharacterId = '';
  showCharacterEditor = false;
  characterEditComponent: any = null;

  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableSpecies();
      this.getCharacters();
    });

    this.getAvailableWorlds();
    this.getAvailableSpecies();
    this.getCharacters();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getAvailableSpecies() {
    this.availableSpecies = this.specieService.getSpecies(null, this.worldId() || this.selectedWorld || null);
  }

  getCharacters() {
    this.characters = this.characterService.getCharacters(this.worldId() || this.selectedWorld || null);

    if (this.selectedCharacterId && !this.characters.some(character => character.id === this.selectedCharacterId)) {
      this.selectedCharacterId = '';
      this.showCharacterEditor = false;
    }
  }

  onWorldSelect() {
    this.getAvailableSpecies();
    this.getCharacters();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || this.selectedWorld || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'specie', label: 'Espécie', value: '', options: this.availableSpecies, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  async selectCharacter(characterId: string) {
    if (this.selectedCharacterId === characterId) {
      return;
    }

    this.showCharacterEditor = false;
    this.selectedCharacterId = '';

    if (!this.characterEditComponent) {
      const { CharacterEditComponent } = await import('../character-edit/character-edit.component');
      this.characterEditComponent = CharacterEditComponent;
    }

    setTimeout(() => {
      this.selectedCharacterId = characterId;
      this.showCharacterEditor = true;
    }, 0);
  }

  createCharacter(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const newCharacter = new Character('', name, '');
    this.characterService.saveCharacter(newCharacter, formData['world'] || null, formData['specie'] || null);
    this.getCharacters();
  }
}
