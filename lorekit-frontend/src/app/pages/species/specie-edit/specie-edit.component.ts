import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorldService } from '../../../services/world.service';
import { SpecieService } from '../../../services/specie.service';
import { LocationService } from '../../../services/location.service';
import { Specie } from '../../../models/specie.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from '../../../components/editor/editor.component';
import { EntityLateralMenuComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { LocationListComponent } from '../../locations/location-list/location-list.component';
import { SpecieListComponent } from "../specie-list/specie-list.component";
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from "../../../components/text-area/text-area.component";
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { DynamicFieldsComponent } from "../../../components/DynamicFields/DynamicFields.component";

@Component({
  selector: 'app-specie-edit',
  imports: [InputComponent, IconButtonComponent, PersonalizationButtonComponent, NgClass, NgStyle, FormsModule, EditorComponent, EntityLateralMenuComponent, SafeDeleteButtonComponent, LocationListComponent, SpecieListComponent, TextAreaComponent, DynamicFieldsComponent],
  template: `
    <div class="flex flex-col relative" [ngClass]="{'h-[97vh]': !isInDialog(), 'h-[80vh]': isInDialog()}">
      @if(getImageByUsageKey(specie.Images, 'default') != null){
        @let img = getImageByUsageKey(specie.Images, 'default');
        <div class="relative w-full h-72  overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-72 object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(specie, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }

      @if(getImageByUsageKey(specie.Images, 'fullBody') != null){
        @let fullBodyImg = getImageByUsageKey(specie.Images, 'fullBody');
        <img [src]="fullBodyImg?.filePath" class="w-36 h-65 absolute top-3 left-3 object-cover rounded-md">
      }
      <br>
      <div class="flex flex-row items-center">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/specie"></app-icon-button>
        }
        <input type="text" (blur)="saveSpecie()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="specie.name" />
        <div class="flex flex-row gap-2">
          <app-personalization-button [entityId]="specie.id" [entityTable]="'Species'" [size]="'xl'" (onClose)="getSpecie()"></app-personalization-button>
          <app-safe-delete-button [entityName]="specie.name" [entityId]="specie.id" [entityTable]="'Species'" [size]="'xl'"></app-safe-delete-button>
        </div>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 flex-1 overflow-hidden h-full mt-10">
        <div class="flex-4 h-auto  flex flex-col overflow-hidden">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'properties'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'properties'}">Propriedades</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'details'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'details'}">Detalhes</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'subspecies'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'subspecies'}">Variações</a>
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 overflow-hidden flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('properties') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark p-1">
                    <div class="grid grid-cols-3 gap-4">
                      <app-input [label]="'Classificação'" placeholder="Humanoide, Anthro..." [(value)]="specie.classification" (valueChange)="saveSpecie()"></app-input>
                      <app-input [label]="'Dieta'" placeholder="Herbívoro, Carnívoro..." [(value)]="specie.diet" (valueChange)="saveSpecie()"></app-input>
                      <app-input [label]="'Expectativa de Vida (anos)'" [(value)]="specie.averageLifespan" (valueChange)="saveSpecie()"></app-input>
                      <app-input [label]="'Altura média (metros)'"  [(value)]="specie.averageHeight" (valueChange)="saveSpecie()"></app-input>
                      <app-input [label]="'Peso médio (kg)'"  [(value)]="specie.averageWeight" (valueChange)="saveSpecie()"></app-input>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1 text-sm text-white">Características físicas</label>
                        <app-editor docTitle="Características físicas" entityTable="Species" [entityName]="specie.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="specie.physicalCharacteristics || ''" (saveDocument)="onEditorSave($event, 'physicalCharacteristics')"></app-editor>
                      </div>
                      <div>
                        <label class="mb-1 text-sm text-white">Características Comportamentais</label>
                        <app-editor docTitle="Características Comportamentais" entityTable="Species" [entityName]="specie.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="specie.behavioralCharacteristics || ''" (saveDocument)="onEditorSave($event, 'behavioralCharacteristics')"></app-editor>
                      </div>
                    </div>
                    <br>
                    <app-dynamic-fields [entityTable]="'Species'" [entityId]="specie.id"></app-dynamic-fields>
                    <br>
                  </div>
                }
                @case ('details') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-editor docTitle="Descrição" entityTable="Species" [entityName]="specie.name" [document]="specie.description || ''" (saveDocument)="onEditorSave($event, 'description')" class="w-full"></app-editor>
                  </div>
                }
                @case ('subspecies') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-specie-list [specieId]="specie.id" [worldId]="specie.ParentWorld ? specie.ParentWorld.id : ''"></app-specie-list>
                  </div>
                }
              }
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900">
              <app-entity-lateral-menu [fields]="fields" (onSave)="onFieldsSave($event)" entityTable="Species" [entityId]="specie.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './specie-edit.component.css',
})
export class SpecieEditComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private specieService = inject(SpecieService);
  private locationService = inject(LocationService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab: string = 'properties';

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === SpecieEditComponent ||
      this.activatedRoute.component === SpecieEditComponent;
  });

  readonly specieId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('specieId') ?? '';
  });

  specie: Specie = {} as Specie;

  selectedParentLocationId: string | null = null;
  selectedWorldId: string | null = null;
  selectedMainSpecieId: string | null = null;

  fields: FormField[] = [];

  isLoading = true;

  saveTimeout!: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.getSpecie();
  }

  getSpecie(){
    this.specie = this.specieService.getSpecie(this.specieId());

    this.selectedParentLocationId = this.specie.ParentLocation ? this.specie.ParentLocation.id : '';
    this.selectedWorldId = this.specie.ParentWorld ? this.specie.ParentWorld.id : '';
    this.selectedMainSpecieId = this.specie.ParentSpecies ? this.specie.ParentSpecies.id : '';

    this.buildFields();
    this.isLoading = false;
  }

  private buildFields() {

    let specieOptions = this.specieService.getSpecies(null, this.specie.ParentWorld ? this.specie.ParentWorld.id : '').filter(s => s.id !== this.specie.id && !s.ParentSpecies);

    this.fields = [
      { key: 'concept', label: 'Conceito', value: this.specie.concept || '', type: 'text-area' },
      { key: 'parentLocationId', label: 'Local de Origem', value: this.selectedParentLocationId ?? '', options: this.locationService.getLocations(), optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
      { key: 'parentWorldId', label: 'Mundo', value: this.selectedWorldId ?? '', options: this.worldService.getWorlds(), optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
      { key: 'mainSpecieId', label: 'Espécie Principal', value: this.selectedMainSpecieId ?? '', options: specieOptions, optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
    ];
  }

  getColor(specie: Specie): string {
    const color = this.getPersonalizationValue(specie, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  saveSpecie() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.specieService.saveSpecie(this.specie, this.selectedWorldId, this.selectedParentLocationId, this.selectedMainSpecieId);
    }, 500);
  }

  onEditorSave($event: any, field: keyof Specie) {
    (this.specie[field] as any) = JSON.stringify($event);

    this.saveSpecie();
  }

  onFieldsSave(formData: Record<string, string>) {
    //ignore save if no changes
    if (formData['concept'] === this.specie.concept &&
        formData['parentLocationId'] === (this.specie.ParentLocation ? this.specie.ParentLocation.id : '') &&
        formData['parentWorldId'] === (this.specie.ParentWorld ? this.specie.ParentWorld.id : '') &&
        formData['mainSpecieId'] === (this.specie.ParentSpecies ? this.specie.ParentSpecies.id : '')
    ) {
      return;
    }

    this.specie.concept = formData['concept'];
    this.selectedParentLocationId = formData['parentLocationId'];
    this.selectedWorldId = formData['parentWorldId'];
    this.selectedMainSpecieId = formData['mainSpecieId'];


    this.saveSpecie();
  }

}
