import { CommonModule, NgClass } from '@angular/common';
import { inject, DestroyRef, Component, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
import { EntityChangeService } from '../../../services/entity-change.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { Dialog } from '@angular/cdk/dialog';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';

import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { buildTreeViewNodes, filterTreeViewNodes, TreeViewNode, TreeViewReparentRequest } from '../../../components/entity-lateral-menu/tree-view.models';
import { EntityHierarchyService } from '../../../services/entity-hierarchy.service';
@Component({
  selector: 'app-character-list',
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective, TreeViewListComponent],
  template: `
    <div class="flex flex-col h-full relative">
      <div class="flex flex-row gap-4 h-full relative">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showsidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">

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

            <div class="flex flex-row items-center gap-1 mb-4">
              <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus-within:border-white">
                <div class="w-8 h-5 flex flex-row justify-center items-center">
                  <i class="fa fa-search"></i>
                </div>
                <input
                  type="text"
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="filterCharacters()"
                  placeholder="Pesquisar..."
                  class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10" />
              </div>
              <app-icon-button
                size="sm"
                buttonType="secondaryActive"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="'Criar Personagem'"
                [fields]="getFormFields()"
                (onSave)="createCharacter($event)">
              </app-icon-button>
            </div>

            <app-tree-view-list
              [openInDialog]="false"
              [allowCreate]="true"
              [useCustomCreate]="true"
              [dragEnabled]="!searchTerm.trim()"
              [dragContextId]="'character-list:' + (worldId() || selectedWorld || 'root')"
              [canReparent]="canReparentCharacter"
              [fallbackIcon]="'fa-user'"
              [createTitle]="'Criar Personagem'"
              [createFieldLabel]="'Nome'"
              [emptyChildrenLabel]="'Nenhum personagem encontrado'"
              (onDocumentSelect)="selectCharacter($event.id)"
              (onCreateChild)="createChildCharacter($event)"
              (onReparentRequested)="reparentCharacter($event)"
              (onDelete)="deleteCharacter($event)"
              (onDocumentNewTab)="openNewTabCharacter($event)"
              [documentArray]="filteredCharacterTreeNodes">
            </app-tree-view-list>
          </div>
        </div>

        @if (!panelMode()) {
          <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[showsidebar ? 'start-92' : 'start-12']" (click)="showsidebar = !showsidebar">
            <i class="fa-solid text-zinc-400" [ngClass]="[showsidebar ? 'fa-angles-left' : 'fa-angles-right']"></i>
          </small>
        }

        @if (!panelMode()) {
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
        }
      </div>
    </div>
  `,
  styleUrl: './character-list.component.css',
})
export class CharacterListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private characterService = inject(CharacterService);
  private worldService = inject(WorldService);
  private specieService = inject(SpecieService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);
  private entityHierarchyService = inject(EntityHierarchyService);

  worldId = input<string>();
  panelMode = input<boolean>(false);
  tabManager = inject(TabManagerService);
  availableWorlds: World[] = [];
  availableSpecies: Specie[] = [];
  selectedWorld = '';
  characters: Character[] = [];
  characterTreeNodes: TreeViewNode[] = [];
  filteredCharacterTreeNodes: TreeViewNode[] = [];
  searchTerm = '';
  readonly canReparentCharacter = (draggedId: string, newParentId: string | null) =>
    this.entityHierarchyService.canReparent('Character', draggedId, newParentId);

  showsidebar = true;

  safeDeleteDialog = inject(Dialog);


  deleteCharacter(characterId: string) {

    const character = this.characterService.getCharacter(characterId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: character.name,
        entityTable: 'Character',
        entityId: characterId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  selectedCharacterId = '';
  showCharacterEditor = false;
  characterEditComponent: any = null;

  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit() {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableSpecies();
      this.getCharacters();
    });

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.table === 'Character') {
        this.getCharacters();
      }
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
    this.characters = this.characterService.getCharacters(this.worldId() || this.selectedWorld || null).sort((a, b) => a.name.localeCompare(b.name));
    this.characterTreeNodes = buildTreeViewNodes(this.characters, character => character.name, character => character.ParentCharacter?.id);
    this.filterCharacters();

    if (this.selectedCharacterId && !this.characters.some(character => character.id === this.selectedCharacterId)) {
      this.selectedCharacterId = '';
      this.showCharacterEditor = false;
    }
  }

  filterCharacters() {
    this.filteredCharacterTreeNodes = filterTreeViewNodes(this.characterTreeNodes, this.searchTerm);
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
    if (this.panelMode()) {
      const character = this.characters.find(c => c.id === characterId);
      const icon = this.getPersonalizationValue(character, 'icon') || 'fa-solid fa-user';
      this.tabManager.substituteCurrentTab('Character', characterId, character?.name ?? 'Personagem', icon);
      this.selectedCharacterId = characterId;
      return;
    }
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

  async openNewTabCharacter(characterId: string) {
    if (this.panelMode()) {
      const character = this.characters.find(c => c.id === characterId);
      const icon = this.getPersonalizationValue(character, 'icon') || 'fa-solid fa-user';
      this.tabManager.openTab('Character', characterId, character?.name ?? 'Personagem', icon);
      this.selectedCharacterId = characterId;
      return;
    }
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

  createChildCharacter(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    const parent = this.characters.find(character => character.id === event.parentId);
    if (!name || !parent) {
      return;
    }

    const child = this.characterService.saveCharacter(
      new Character('', name, ''),
      parent.ParentWorld?.id || this.worldId() || this.selectedWorld || null,
      parent.ParentSpecies?.id || null
    );
    this.entityHierarchyService.reparent('Character', child.id, parent.id);
    this.getCharacters();
  }

  reparentCharacter(event: TreeViewReparentRequest) {
    try {
      this.entityHierarchyService.reparent('Character', event.draggedId, event.newParentId);
      this.getCharacters();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao reorganizar o personagem.');
    }
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
