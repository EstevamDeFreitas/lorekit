import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { LocationService } from '../../../services/location.service';
import { OrganizationService } from '../../../services/organization.service';
import { WorldService } from '../../../services/world.service';
import { CultureEditComponent } from '../../cultures/culture-edit/culture-edit.component';
import { Organization, OrganizationType } from '../../../models/organization.model';
import { World } from '../../../models/world.model';
import { Location } from '../../../models/location.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { Culture } from '../../../models/culture.model';
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
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DynamicFieldsComponent } from "../../../components/DynamicFields/DynamicFields.component";

@Component({
  selector: 'app-organization-edit',
  imports: [InputComponent, IconButtonComponent, PersonalizationButtonComponent, NgClass, NgStyle, FormsModule, EditorComponent, EntityLateralMenuComponent, SafeDeleteButtonComponent, LocationListComponent, SpecieListComponent, TextAreaComponent, DynamicFieldsComponent],
  template: `
    <div class="flex flex-col relative">
      @if(getImageByUsageKey(organization.Images, 'default') != null){
        @let img = getImageByUsageKey(organization.Images, 'default');
        <div class="relative w-full h-[30vh]  overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-[30vh] object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(organization, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }
      @if(getImageByUsageKey(organization.Images, 'profile') != null){
        @let profileImg = getImageByUsageKey(organization.Images, 'profile');
        <img [src]="profileImg?.filePath" class="h-[27vh] absolute top-3 left-3 object-cover rounded-md">
      }
      <br>
      <div class="flex flex-row items-center sticky py-2 top-0 z-50 bg-zinc-950">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/organization"></app-icon-button>
        }
        <input type="text" (blur)="saveOrganization()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="organization.name" />
        <div class="flex flex-row gap-2">
          <app-personalization-button [entityId]="organization.id" [entityTable]="'Organization'" [size]="'xl'" (onClose)="getOrganization()"></app-personalization-button>
          <app-safe-delete-button [entityName]="organization.name" [entityId]="organization.id" [entityTable]="'Organization'" [size]="'xl'"></app-safe-delete-button>
        </div>
      </div>
      <div class="flex flex-row gap-4 flex-1 mt-10">
        <div class="flex-4 h-auto  flex flex-col">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'description'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'description'}">Informações adicionais</a>
             @if(hasDynamicFields) {
              <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'properties'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'properties'}">Propriedades</a>
            }
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('description') {
                  <div class="w-full ">
                    <app-editor docTitle="Descrição" entityTable="Organization" [entityName]="organization.name" [document]="organization.description || ''" (saveDocument)="onEditorSave($event, 'description')" class="w-full"></app-editor>
                  </div>
                }
                @case ('properties'){
                  <app-dynamic-fields [entityTable]="'Organization'" [entityId]="organization.id"></app-dynamic-fields>
                }
              }
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900 sticky top-20">
              <app-entity-lateral-menu [fields]="getFormFields()" (onSave)="onFieldsSave($event)" entityTable="Organization" [entityId]="organization.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './organization-edit.component.css',
})
export class OrganizationEditComponent implements OnInit{
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private organizationService = inject(OrganizationService);
  private organizationTypeService = inject(OrganizationTypeService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab: string = 'description';

  isInDialog = computed(() => !!this.dialogref);

  private dynamicFieldService = inject(DynamicFieldService);
      hasDynamicFields: boolean = this.dynamicFieldService.getDynamicFields('Organization').length > 0;


  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === OrganizationEditComponent ||
      this.activatedRoute.component === OrganizationEditComponent;
  });

  readonly organizationId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('organizationId') ?? '';
  });

  organization : Organization = {} as Organization;

  selectedWorldId: string | null = null;
  selectedLocationId: string | null = null;
  selectedOrganizationTypeId: string | null = null;
  availableOrganizationTypes : OrganizationType[] = [];

  isLoading = true;

  saveTimeout!: ReturnType<typeof setTimeout>;

  availableWorlds : World[] = [];
  availableLocations : Location[] = [];

  ngOnInit(): void {
    this.getOrganization();
    this.getWorldsAndLocations();
    this.isLoading = false;
  }

  getOrganization(){
    this.organization = this.organizationService.getOrganization(this.organizationId());

    this.selectedLocationId = this.organization.ParentLocation ? this.organization.ParentLocation.id : null;
    this.selectedWorldId = this.organization.ParentWorld ? this.organization.ParentWorld.id : null;
    this.selectedOrganizationTypeId = this.organization.OrganizationType ? this.organization.OrganizationType.id : null;
  }

  getWorldsAndLocations(){
    this.availableWorlds = this.worldService.getWorlds();
    this.availableLocations = this.locationService.getLocationByWorldId(this.selectedWorldId || '');
    this.availableOrganizationTypes = this.organizationTypeService.getOrganizationTypes();
  }

  saveOrganization() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.organizationService.saveOrganization(this.organization, this.selectedWorldId, this.selectedLocationId, this.selectedOrganizationTypeId);
    }, 500);
  }

  onEditorSave($event: any, field : any) {
    this.organization[field as keyof Organization] = JSON.stringify($event) as any;

    this.saveOrganization();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.organization.concept = formData['concept'];
    this.selectedWorldId = formData['world'];
    this.selectedLocationId = formData['location'];
    this.selectedOrganizationTypeId = formData['organizationType'];

    this.saveOrganization();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'concept', label: 'Conceito', value: this.organization.concept || '', type: 'text-area' },
      { key: 'organizationType', label: 'Tipo de Organização', value: this.organization.OrganizationType ? this.organization.OrganizationType.id : '', options: this.availableOrganizationTypes, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'world', label: 'Mundo', value: this.organization.ParentWorld ? this.organization.ParentWorld.id : '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Local de Origem', value: this.organization.ParentLocation ? this.organization.ParentLocation.id : '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  getColor(organization: Organization): string {
    const color = this.getPersonalizationValue(organization, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

}
