import { Component, computed, inject, input, OnInit } from '@angular/core';
import { CharacterService } from '../../../services/character.service';
import { ActivatedRoute, Router } from '@angular/router';
import { WorldService } from '../../../services/world.service';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { World } from '../../../models/world.model';
import { Character } from '../../../models/character.model';
import { Dialog } from '@angular/cdk/dialog';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { Specie } from '../../../models/specie.model';
import { SpecieService } from '../../../services/specie.service';
import { ButtonComponent } from '../../../components/button/button.component';
import { NgClass, NgStyle } from '@angular/common';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-character-list',
  imports: [ButtonComponent, FormOverlayDirective, NgClass, NgStyle, ComboBoxComponent],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row justify-between items-center mb-4 sticky z-25 bg-zinc-950 py-2" [ngClass]="{'top-0': isRouteComponent(), 'top-13': !isRouteComponent()}">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Personagens</h2>
        }
        @else {
          <div></div>
        }
        <app-button
          label="Novo"
          size="sm"
          buttonType="white"
          appFormOverlay
          [title]="'Criar Personagem'"
          [fields]="getFormFields()"
          (onSave)="createCharacter($event)"
          ></app-button>
      </div>

      @if(!worldId()){
        <div class="flex flex-row top-13 py-2 sticky bg-zinc-950">
          <app-combo-box class="w-60" label="Filtro de mundo" [items]="getSelectableWorlds()" compareProp="id" displayProp="name"  [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
        </div>
      }

      <div class="">
        <br>
        <div class=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @if (characters.length === 0){
            <div class="text-center">
              <p>Nenhum personagem disponível.</p>
            </div>
          }
          @else {
            @for (character of characters; track character.id) {
              @let img = getImageByUsageKey(character.Images, 'default');
              @let profileImg = getImageByUsageKey(character.Images, 'profile');
              <div (click)="selectCharacter(character.id!)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2',

                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(character, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="w-20 h-20 flex items-center justify-center bg-zinc-800 rounded-md border border-zinc-500'">
                    @if (profileImg) {
                      <img class="w-20 h-20 object-cover rounded-md" [src]="profileImg.filePath" alt="">
                    }
                    @else {
                      <i class="fa fa-image text-2xl"></i>
                    }
                  </div>
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(character, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(character, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ character.name }}</div>
                    </div>
                    <div class="text-xs font-bold overflow-hidden text-ellipsis text-justify line-clamp-3">{{character.concept}}</div>
                    <div class="flex flex-row gap-1">
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-earth"></i>
                        <div class="">{{character.ParentWorld?.name}}</div>
                      </div>
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-paw"></i>
                        <div class="">{{character.ParentSpecies?.name}}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
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
  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextClass = getTextClass;
  private worldStateService = inject(WorldStateService);

  dialog = inject(Dialog);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === CharacterListComponent ||
      this.activatedRoute.component === CharacterListComponent;
  });

  worldId = input<string>();
  availableWorlds : World[] = [];
  availableSpecies : Specie[] = [];

  selectedWorld : string = '';

  characters : Character[] = [];

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      this.selectedWorld = world ? world.id : '';
    });
    this.getAvailableWorlds();
    this.getAvailableSpecies();
    this.getCharacters();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getAvailableSpecies(){
    this.availableSpecies = this.specieService.getSpecies(null, this.worldId());
  }

  getCharacters(){
    this.characters = this.characterService.getCharacters(this.worldId() || this.selectedWorld || null);
  }

  getSelectableWorlds(){
    return this.availableWorlds;
  }

  onWorldSelect(){
    this.getCharacters();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'specie', label: 'Espécie', value: '', options: this.availableSpecies, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  selectCharacter(characterId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/character/edit', characterId]);
    }
    else {
      import('../character-edit/character-edit.component').then(({ CharacterEditComponent }) => {
        const dialogRef = this.dialog.open(CharacterEditComponent, {
          data: { id: characterId },
          panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'],
          height: '80vh',
          width: '80vw',
        });

        dialogRef.closed.subscribe(() => {
          this.getCharacters();
        });
      });
    }
  }

  getColor(character: Character): string {
    const color = this.getPersonalizationValue(character, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createCharacter(formData: Record<string, string>) {
    let newCharacter = new Character('', formData['name'], '');

    newCharacter = this.characterService.saveCharacter(newCharacter, formData['world'] || null, formData['specie'] || null);

    this.characters.push(newCharacter);
  }

  buildCardBgStyle(filePath?: string | null) {
    const url = this.buildImageUrl(filePath);
    return url
      ? {
          'background-image':
            `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${url})`,
          'background-size': 'cover',
          'background-position': 'center',
        }
      : null;
  }

}
