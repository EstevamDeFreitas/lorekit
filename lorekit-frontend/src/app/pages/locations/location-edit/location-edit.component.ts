import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { Location, LocationCategory } from '../../../models/location.model';
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../../services/location.service';
import { EditorComponent } from "../../../components/editor/editor.component";
import { EntityLateralMenuComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { environment } from '../../../../enviroments/environment';
import { LocationListComponent } from "../location-list/location-list.component";
import { WorldService } from '../../../services/world.service';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { getImageByUsageKey } from '../../../models/image.model';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DynamicFieldsComponent } from "../../../components/DynamicFields/DynamicFields.component";

@Component({
  selector: 'app-location-edit',
  imports: [IconButtonComponent, PersonalizationButtonComponent, NgClass, FormsModule, EditorComponent, EntityLateralMenuComponent, SafeDeleteButtonComponent, LocationListComponent, NgStyle, DynamicFieldsComponent],
  template: `
    <div class="flex flex-col" [ngClass]="{'h-[97vh]': !isInDialog(), 'h-[75vh]': isInDialog()}">
      @if(getImageByUsageKey(location.Images, 'default') != null){
        @let img = getImageByUsageKey(location.Images, 'default');
        <div class="relative w-full h-72  overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-72 object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(location, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }
      <br>
      <div class="flex flex-row items-center">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/location"></app-icon-button>
        }
        <input type="text" (blur)="saveLocation()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="location.name" />
        <div class="flex flex-row gap-2">
          <app-personalization-button [entityId]="location.id" [entityTable]="'Location'" [size]="'xl'" (onClose)="getLocation()"></app-personalization-button>
          <app-safe-delete-button [entityName]="location.name" [entityId]="location.id" [entityTable]="'Location'" [size]="'xl'"></app-safe-delete-button>
        </div>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 flex-1 overflow-hidden h-full mt-10">
        <div class="flex-4 h-auto  flex flex-col overflow-hidden">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'details'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'details'}">Detalhes</a>
             @if(hasDynamicFields) {
              <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'properties'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'properties'}">Propriedades</a>
            }
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'localities'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'localities'}">Localidades</a>
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 overflow-hidden flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('details') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-editor docTitle="Descrição" entityTable="Location" [entityName]="location.name" [document]="location.description || ''" (saveDocument)="onDocumentSave($event)" class="w-full"></app-editor>
                  </div>
                }
                @case ('localities') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-location-list [worldId]="location.ParentWorld?.id" [locationId]="location.id"></app-location-list>
                  </div>
                }
                @case ('properties'){
                  <app-dynamic-fields [entityTable]="'Location'" [entityId]="location.id"></app-dynamic-fields>
                }
              }
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900">
              <app-entity-lateral-menu [fields]="fields" (onSave)="onFieldsSave($event)" entityTable="Location" [entityId]="location.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './location-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default
})
export class LocationEditComponent implements OnInit {

  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private locationService = inject(LocationService);
  private worldService = inject(WorldService);
  private cdr = inject(ChangeDetectorRef);
  private locationCategoryService = inject(LocationCategoriesService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  isInDialog = computed(() => !!this.dialogref);

  currentTab : string = 'details';

  private dynamicFieldService = inject(DynamicFieldService);
    hasDynamicFields: boolean = this.dynamicFieldService.getDynamicFields('Location').length > 0;


  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === LocationEditComponent ||
      this.activatedRoute.component === LocationEditComponent;
  });

  readonly locationId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('locationId') ?? '';
  });

  location : Location = {} as Location;
  isLoading = true;

  locationCategories: LocationCategory[] = [];

  selectedCategoryId: string = '';
  selectedParentLocationId?: string;
  selectedWorldId?: string;

  fields: FormField[] = [];

  ngOnInit(): void {
    this.getLocation();
    this.getCategories();
  }

  getCategories() {
    this.locationCategories = this.locationCategoryService.getLocationCategories();
    this.buildFields();
  }

  getLocation(){
    this.location = this.locationService.getLocationById(this.locationId());
    this.selectedCategoryId = this.location.LocationCategory ? this.location.LocationCategory.id : '';
    this.selectedParentLocationId = this.location.ParentLocation ? this.location.ParentLocation.id : undefined;
    this.selectedWorldId = this.location.ParentWorld ? this.location.ParentWorld.id : undefined;
    this.isLoading = false;

    this.buildFields();
  }

  saveLocation() {
    this.locationService.saveLocation(this.location, this.selectedCategoryId, this.selectedWorldId || undefined, this.selectedParentLocationId || undefined);
  }

  onDocumentSave($event: any) {
    this.location.description = JSON.stringify($event);
    this.saveLocation();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.location.concept = formData['concept'];
    this.selectedCategoryId = formData['categoryId'];
    this.selectedParentLocationId = formData['parentLocationId'];
    this.selectedWorldId = formData['parentWorldId'];

    this.saveLocation();
  }

  private buildFields() {

    this.fields = [
      { key: 'concept', label: 'Conceito', value: this.location.concept || '', type: 'text-area' },
      { key: 'categoryId', label: 'Categoria', value: this.selectedCategoryId || '', options: this.locationCategories, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'parentLocationId', label: 'Localidade Pai', value: this.location.ParentLocation ? this.location.ParentLocation.id : '', options: this.locationService.getLocations(), optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'parentWorldId', label: 'Mundo', value: this.location.ParentWorld ? this.location.ParentWorld.id : '', options: this.worldService.getWorlds(), optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];

  }

  getColor(item: any): string {
    const color = this.getPersonalizationValue(item, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : '';
  }


}
