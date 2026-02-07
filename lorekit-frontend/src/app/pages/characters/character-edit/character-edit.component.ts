import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorldService } from '../../../services/world.service';
import { SpecieService } from '../../../services/specie.service';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { getImageByUsageKey } from '../../../models/image.model';
import { CharacterService } from '../../../services/character.service';
import { Character } from '../../../models/character.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { World } from '../../../models/world.model';
import { Specie } from '../../../models/specie.model';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from '../../../components/editor/editor.component';
import { EntityLateralMenuComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { InputComponent } from '../../../components/input/input.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { LocationListComponent } from '../../locations/location-list/location-list.component';
import { SpecieListComponent } from '../../species/specie-list/specie-list.component';

@Component({
  selector: 'app-character-edit',
  imports: [InputComponent, IconButtonComponent, PersonalizationButtonComponent, NgClass, NgStyle, FormsModule, EditorComponent, EntityLateralMenuComponent, SafeDeleteButtonComponent, LocationListComponent, SpecieListComponent, TextAreaComponent],
  template: `
    <div class="flex flex-col relative h-screen" [ngClass]="{'h-screen': !isInDialog(), 'h-[75vh]': isInDialog()}">
      @if(getImageByUsageKey(character.Images, 'default') != null){
        @let img = getImageByUsageKey(character.Images, 'default');
        <div class="relative w-full h-72  overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-72 object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(character, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }

      @if(getImageByUsageKey(character.Images, 'profile') != null){
        @let profileImg = getImageByUsageKey(character.Images, 'profile');
        <img [src]="profileImg?.filePath" class="w-66 h-66 absolute top-3 left-3 object-cover rounded-md">
      }
      <br>
      <div class="flex flex-row items-center">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/character"></app-icon-button>
        }
        <input type="text" (blur)="saveCharacter()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="character.name" />
        <div class="flex flex-row gap-2">
          <app-personalization-button [entityId]="character.id" [entityTable]="'Character'" [size]="'xl'" (onClose)="getCharacter()"></app-personalization-button>
          <app-safe-delete-button [entityName]="character.name" [entityId]="character.id" [entityTable]="'Character'" [size]="'xl'"></app-safe-delete-button>
        </div>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 flex-1 overflow-hidden h-full mt-10">
        <div class="flex-4 h-auto  flex flex-col overflow-hidden">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'properties'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'properties'}">Propriedades</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'backstory'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'backstory'}">Backstory</a>
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 overflow-hidden flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('properties') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark p-1">
                    <div class="grid grid-cols-3 gap-4">
                      <app-input [label]="'Idade'" [(value)]="character.age" (valueChange)="saveCharacter()"></app-input>
                      <app-input [label]="'Altura'" [(value)]="character.height" (valueChange)="saveCharacter()"></app-input>
                      <app-input [label]="'Peso'" [(value)]="character.weight" (valueChange)="saveCharacter()"></app-input>
                      <app-input [label]="'Ocupação'" [(value)]="character.occupation" (valueChange)="saveCharacter()"></app-input>
                      <app-input [label]="'Alinhamento'" [(value)]="character.alignment" (valueChange)="saveCharacter()"></app-input>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1 text-sm text-white">Personalidade</label>
                        <app-editor docTitle="Personalidade" entityTable="Character" [entityName]="character.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="character.personality || ''" (saveDocument)="onEditorSave($event, 'personality')"></app-editor>
                      </div>
                      <div>
                        <label class="mb-1 text-sm text-white">Aparência</label>
                        <app-editor docTitle="Aparência" entityTable="Character" [entityName]="character.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="character.appearance || ''" (saveDocument)="onEditorSave($event, 'appearance')"></app-editor>
                      </div>
                      <div>
                        <label class="mb-1 text-sm text-white">Objetivos</label>
                        <app-editor docTitle="Objetivos" entityTable="Character" [entityName]="character.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="character.objectives || ''" (saveDocument)="onEditorSave($event, 'objectives')"></app-editor>
                      </div>
                    </div>
                    <br>
                  </div>
                }
                @case ('backstory') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">

                    <app-editor docTitle="Backstory" entityTable="Character" [entityName]="character.name" [document]="character.background || ''" (saveDocument)="onEditorSave($event, 'background')" class="w-full"></app-editor>
                  </div>
                }
              }
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900">
              <app-entity-lateral-menu [fields]="getFormFields()" (onSave)="onFieldsSave($event)" entityTable="Character" [entityId]="character.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './character-edit.component.css',
})
export class CharacterEditComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private specieService = inject(SpecieService);
  private characterService = inject(CharacterService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab: string = 'properties';

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === CharacterEditComponent ||
      this.activatedRoute.component === CharacterEditComponent;
  });

  readonly characterId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('characterId') ?? '';
  });

  character : Character = {} as Character;

  selectedWorldId: string | null = null;
  selectedSpecieId: string | null = null;

  isLoading = true;

  saveTimeout!: ReturnType<typeof setTimeout>;

  availableWorlds : World[] = [];
  availableSpecies : Specie[] = [];

  ngOnInit(): void {
    this.getCharacter();
    this.getWorldsAndSpecies();
    this.isLoading = false;
  }

  getCharacter(){
    this.character = this.characterService.getCharacter(this.characterId());

    this.selectedSpecieId = this.character.ParentSpecies ? this.character.ParentSpecies.id : null;
    this.selectedWorldId = this.character.ParentWorld ? this.character.ParentWorld.id : null;
  }

  getWorldsAndSpecies(){
    this.availableWorlds = this.worldService.getWorlds();
    this.availableSpecies = this.specieService.getSpecies(null, this.character.ParentWorld ? this.character.ParentWorld.id : null);
  }

  getFormFields(): FormField[] {
    return [
      { key: 'concept', label: 'Conceito', value: this.character.concept || '', type: 'text-area' },
      { key: 'world', label: 'Mundo', value: this.character.ParentWorld ? this.character.ParentWorld.id : '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'specie', label: 'Espécie', value: this.character.ParentSpecies ? this.character.ParentSpecies.id : '', options: this.availableSpecies, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  getColor(specie: Specie): string {
    const color = this.getPersonalizationValue(specie, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  saveCharacter() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.characterService.saveCharacter(this.character, this.selectedWorldId, this.selectedSpecieId);
    }, 500);
  }

  onEditorSave($event: any, field: keyof Character) {
    (this.character[field] as any) = JSON.stringify($event);

    this.saveCharacter();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.character.concept = formData['concept'];
    this.selectedWorldId = formData['world'];
    this.selectedSpecieId = formData['specie'];

    console.log("Fields Saved: ", formData);


    this.saveCharacter();
  }
}
