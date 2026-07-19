import { CommonModule, NgClass } from '@angular/common';
import { inject, DestroyRef, Component, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { Character } from '../../../models/character.model';
import { World } from '../../../models/world.model';
import { getPersonalizationValue, getTextColorStyle } from '../../../models/personalization.model';
import { CharacterService } from '../../../services/character.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

import { Dialog } from '@angular/cdk/dialog';
import { ContextMenuOption } from '../../../models/context-menu-option.interface';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';
import {
  ContextMenuDirective
} from '../../../directives/context-menu.directive';

@Component({
  selector: 'irpw-character-sheet-list',
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent, ContextMenuDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4 relative">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showSidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">
            <h2 class="text-base mb-4">Fichas de Personagem</h2>

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

            <div class="mb-4">
              <input
                type="text"
                class="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                placeholder="Buscar personagem..."
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch()">
            </div>

            <div class="flex flex-col gap-3 w-full">
              @for (character of filteredCharacters; track character.id) {
                <button
                  type="button"
                  appContextMenu
                  [options]="menuOptions"
                  [contextId]="character.id"
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

        @if (!panelMode()) {
          <small
            class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer"
            [ngClass]="showSidebar ? 'start-92' : 'start-12'"
            (click)="showSidebar = !showSidebar">
            <i class="fa-solid text-zinc-400" [ngClass]="showSidebar ? 'fa-angles-left' : 'fa-angles-right'"></i>
          </small>
        }

        @if (!panelMode()) {
          <div class="flex-1 min-h-[60vh] p-4 flex flex-col">
            @if (selectedCharacterId) {
              @if (showCharacterSheetEditor && characterSheetEditComponent) {
                <ng-container *ngComponentOutlet="characterSheetEditComponent; inputs: { characterIdInput: selectedCharacterId }"></ng-container>
              } @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando ficha...
                </div>
              }
            } @else {
              <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                Selecione um personagem para ver a ficha
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class IrpwCharacterSheetListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private characterService = inject(CharacterService);
  private worldService = inject(WorldService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);
  private tabManager = inject(TabManagerService);

  panelMode = input<boolean>(false);

  menuOptions : ContextMenuOption[] = [
    { label: 'Abrir nova guia', action: (id: string) => this.openNewTabCharacter(id), customIcon: 'fa-arrow-up-right-from-square' },
    // { label: 'Excluir', action: (id: string) => this.deleteCharacter(id), customClass: 'text-red-500', customIcon: 'fa-trash' },
  ];

  availableWorlds: World[] = [];
  characters: Character[] = [];
  filteredCharacters: Character[] = [];

  selectedWorldId = '';
  searchTerm = '';
  showSidebar = true;

  selectedCharacterId = '';
  showCharacterSheetEditor = false;
  characterSheetEditComponent: any = null;

  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit(): void {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      const nextWorldId = world ? world.id : '';
      if (this.selectedWorldId === nextWorldId) {
        return;
      }
      this.selectedWorldId = nextWorldId;
      this.loadCharacters();
    });

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (
        event.table === 'Character' ||
        event.table === 'Personalization' ||
        event.table === 'Species' ||
        event.table === 'IRPWSpecie' ||
        event.table === 'IRPWVocation' ||
        event.table === 'Relationship'
      ) {
        this.loadCharacters();
      }
    });

    this.availableWorlds = this.worldService.getWorlds();
    this.loadCharacters();
  }

  loadCharacters() {
    this.characters = this.characterService
      .getCharacters(this.selectedWorldId || null)
      .sort((left, right) => left.name.localeCompare(right.name));

    this.applySearch();

    if (this.selectedCharacterId && !this.characters.some(character => character.id === this.selectedCharacterId)) {
      this.selectedCharacterId = '';
      this.showCharacterSheetEditor = false;
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
      ? this.characters.filter(character => character.name.toLowerCase().includes(term))
      : [...this.characters];
  }

  async openNewTabCharacter(characterId: string) {
    const character = this.characters.find(item => item.id === characterId);
    const icon = this.getPersonalizationValue(character, 'icon') || 'fa-solid fa-user';

    if (this.panelMode()) {
      this.tabManager.openTab('CharacterSheet', characterId, character?.name || 'Ficha', icon);
      this.selectedCharacterId = characterId;
      return;
    }

    if (this.selectedCharacterId === characterId) {
      return;
    }

    this.showCharacterSheetEditor = false;
    this.selectedCharacterId = '';

    if (!this.characterSheetEditComponent) {
      const { IrpwCharacterSheetComponent } = await import('./irpw-character-sheet.component');
      this.characterSheetEditComponent = IrpwCharacterSheetComponent;
    }

    setTimeout(() => {
      this.selectedCharacterId = characterId;
      this.showCharacterSheetEditor = true;
    }, 0);
  }

  async selectCharacter(characterId: string) {
    const character = this.characters.find(item => item.id === characterId);
    const icon = this.getPersonalizationValue(character, 'icon') || 'fa-solid fa-user';

    if (this.panelMode()) {
      this.tabManager.substituteCurrentTab('CharacterSheet', characterId, character?.name || 'Ficha', icon);
      this.selectedCharacterId = characterId;
      return;
    }

    if (this.selectedCharacterId === characterId) {
      return;
    }

    this.showCharacterSheetEditor = false;
    this.selectedCharacterId = '';

    if (!this.characterSheetEditComponent) {
      const { IrpwCharacterSheetComponent } = await import('./irpw-character-sheet.component');
      this.characterSheetEditComponent = IrpwCharacterSheetComponent;
    }

    setTimeout(() => {
      this.selectedCharacterId = characterId;
      this.showCharacterSheetEditor = true;
    }, 0);
  }
}
