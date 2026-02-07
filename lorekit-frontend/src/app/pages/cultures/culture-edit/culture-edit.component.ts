import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorldService } from '../../../services/world.service';
import { LocationService } from '../../../services/location.service';
import { CultureService } from '../../../services/culture.service';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { getImageByUsageKey } from '../../../models/image.model';
import { Culture } from '../../../models/culture.model';
import { World } from '../../../models/world.model';
import { Location } from '../../../models/location.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
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
  selector: 'app-culture-edit',
  imports: [InputComponent, IconButtonComponent, PersonalizationButtonComponent, NgClass, NgStyle, FormsModule, EditorComponent, EntityLateralMenuComponent, SafeDeleteButtonComponent, LocationListComponent, SpecieListComponent, TextAreaComponent],
  template: `
    <div class="flex flex-col relative h-screen" [ngClass]="{'h-screen': !isInDialog(), 'h-[75vh]': isInDialog()}">
      @if(getImageByUsageKey(culture.Images, 'default') != null){
        @let img = getImageByUsageKey(culture.Images, 'default');
        <div class="relative w-full h-72  overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-72 object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(culture, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }
      <br>
      <div class="flex flex-row items-center">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/culture"></app-icon-button>
        }
        <input type="text" (blur)="saveCulture()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="culture.name" />
        <div class="flex flex-row gap-2">
          <app-personalization-button [entityId]="culture.id" [entityTable]="'Culture'" [size]="'xl'" (onClose)="getCulture()"></app-personalization-button>
          <app-safe-delete-button [entityName]="culture.name" [entityId]="culture.id" [entityTable]="'Culture'" [size]="'xl'"></app-safe-delete-button>
        </div>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 flex-1 overflow-hidden h-full mt-10">
        <div class="flex-4 h-auto  flex flex-col overflow-hidden">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'properties'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'properties'}">Principal</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'description'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'description'}">Informações adicionais</a>
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 overflow-hidden flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('properties') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark p-1">
                    <div class="grid grid-cols-3 gap-4 mb-4">
                      <app-input [label]="'Valores'" [(value)]="culture.values" (valueChange)="saveCulture()"></app-input>
                      <app-input [label]="'Nível Tecnológico'" [(value)]="culture.technologyLevel" (valueChange)="saveCulture()"></app-input>
                      <app-input [label]="'Linguagem'" [(value)]="culture.language" (valueChange)="saveCulture()"></app-input>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label class="mb-1 text-sm text-white">Tradições</label>
                        <app-editor docTitle="Tradições" entityTable="Culture" [entityName]="culture.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="culture.traditions || ''" (saveDocument)="onEditorSave($event, 'traditions')"></app-editor>
                      </div>
                      <div>
                        <label class="mb-1 text-sm text-white">Estrutura Social</label>
                        <app-editor docTitle="Estrutura Social" entityTable="Culture" [entityName]="culture.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="culture.socialStructure || ''" (saveDocument)="onEditorSave($event, 'socialStructure')"></app-editor>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1 text-sm text-white">Crenças</label>
                        <app-editor docTitle="Crenças" entityTable="Culture" [entityName]="culture.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="culture.beliefSystems || ''" (saveDocument)="onEditorSave($event, 'beliefSystems')"></app-editor>
                      </div>
                      <div>
                        <label class="mb-1 text-sm text-white">Práticas Culinárias</label>
                        <app-editor docTitle="Práticas Culinárias" entityTable="Culture" [entityName]="culture.name" class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark" [document]="culture.culinaryPractices || ''" (saveDocument)="onEditorSave($event, 'culinaryPractices')"></app-editor>
                      </div>
                    </div>
                    <br>
                  </div>
                }
                @case ('description') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-editor docTitle="Descrição" entityTable="Culture" [entityName]="culture.name" [document]="culture.description || ''" (saveDocument)="onEditorSave($event, 'description')" class="w-full"></app-editor>
                  </div>
                }
              }
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900">
              <app-entity-lateral-menu [fields]="getFormFields()" (onSave)="onFieldsSave($event)" entityTable="Culture" [entityId]="culture.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './culture-edit.component.css',
})
export class CultureEditComponent {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private cultureService = inject(CultureService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab: string = 'properties';

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === CultureEditComponent ||
      this.activatedRoute.component === CultureEditComponent;
  });

  readonly cultureId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('cultureId') ?? '';
  });

  culture : Culture = {} as Culture;

  selectedWorldId: string | null = null;
  selectedLocationId: string | null = null;

  isLoading = true;

  saveTimeout!: ReturnType<typeof setTimeout>;

  availableWorlds : World[] = [];
  availableLocations : Location[] = [];

  ngOnInit(): void {
    this.getCulture();
    this.getWorldsAndLocations();
    this.isLoading = false;
  }

  getCulture(){
    this.culture = this.cultureService.getCulture(this.cultureId());

    this.selectedLocationId = this.culture.ParentLocation ? this.culture.ParentLocation.id : null;
    this.selectedWorldId = this.culture.ParentWorld ? this.culture.ParentWorld.id : null;
  }

  getWorldsAndLocations(){
    this.availableWorlds = this.worldService.getWorlds();
    this.availableLocations = this.locationService.getLocationByWorldId(this.selectedWorldId || '');
  }

  getFormFields(): FormField[] {
    return [
      { key: 'concept', label: 'Conceito', value: this.culture.concept || '', type: 'text-area' },
      { key: 'world', label: 'Mundo', value: this.culture.ParentWorld ? this.culture.ParentWorld.id : '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Localidade de Origem', value: this.culture.ParentLocation ? this.culture.ParentLocation.id : '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  getColor(culture: Culture): string {
    const color = this.getPersonalizationValue(culture, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  saveCulture() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.cultureService.saveCulture(this.culture, this.selectedWorldId, this.selectedLocationId);
    }, 500);
  }

  onEditorSave($event: any, field : any) {
    this.culture[field as keyof Culture] = JSON.stringify($event) as any;

    this.saveCulture();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.culture.concept = formData['concept'];
    this.selectedWorldId = formData['world'];
    this.selectedLocationId = formData['location'];

    this.saveCulture();
  }

}
