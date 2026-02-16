import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { LocationService } from '../../../services/location.service';
import { OrganizationService } from '../../../services/organization.service';
import { WorldService } from '../../../services/world.service';
import { Dialog } from '@angular/cdk/dialog';
import { World } from '../../../models/world.model';
import { Organization, OrganizationType } from '../../../models/organization.model';
import { Location } from '../../../models/location.model';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../components/button/button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { SearchComponent } from '../../../components/search/search.component';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-organization-list',
  imports: [ButtonComponent, FormOverlayDirective, NgClass, NgStyle, SearchComponent, ComboBoxComponent, FormsModule],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row justify-between items-center mb-4 sticky top-0 z-50 bg-zinc-950 py-2">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Organizações</h2>
        }
        @else {
          <div></div>
        }
        <app-button
          label="Novo"
          size="sm"
          buttonType="white"
          appFormOverlay
          [title]="'Criar Organização'"
          [fields]="getFormFields()"
          (onSave)="createOrganization($event)"
          ></app-button>
      </div>
      @if(!worldId()){
        <div class="flex flex-row items-center gap-4 top-13 py-2 sticky bg-zinc-950">
          <app-combo-box class="w-60" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name"  [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
        </div>
      }
      <div>
        <br>
        <div class=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
           @if (organizations.length === 0){
            <div class="text-center">
              <p>Nenhuma organização disponível.</p>
            </div>
          }
          @else {
            @for (organization of organizations; track organization.id) {
              @let img = getImageByUsageKey(organization.Images, 'default');
              @let profileImg = getImageByUsageKey(organization.Images, 'profile');
              <div (click)="selectOrganization(organization.id!)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2',

                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(organization, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="w-20 h-20 flex items-center justify-center bg-zinc-800 rounded-md border border-zinc-500'">
                    @if (profileImg) {
                      <img class="w-20 h-20 object-cover rounded-md" [src]="profileImg.filePath" alt="">
                    }
                    @else {
                      <i class="fa fa-image text-2xl"></i>
                    }
                  </div>
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(organization, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(organization, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ organization.name }}</div>
                    </div>
                    <div class="text-xs font-bold overflow-hidden text-ellipsis text-justify line-clamp-3">{{organization.concept}}</div>
                    <div class="flex flex-row gap-1">
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-earth"></i>
                        <div class="">{{organization.ParentWorld?.name}}</div>
                      </div>
                      <div class="text-xs text-nowrap overflow-ellipsis flex flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-location-dot"></i>
                        <div class="">{{organization.ParentLocation?.name}}</div>
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
  styleUrl: './organization-list.component.css',
})
export class OrganizationListComponent implements OnInit
{
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private organizationService = inject(OrganizationService);
  private organizationTypeService = inject(OrganizationTypeService);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextClass = getTextClass;
  private worldStateService = inject(WorldStateService);

  dialog = inject(Dialog);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === OrganizationListComponent ||
      this.activatedRoute.component === OrganizationListComponent;
  });

  worldId = input<string>();
  availableWorlds : World[] = [];
  availableLocations : Location[] = [];
  availableOrganizationTypes : OrganizationType[] = [];

  selectedWorld : string = '';

  organizations : Organization[] = [];

  ngOnInit(): void {
    this.worldStateService.currentWorld$.subscribe(world => {
      this.selectedWorld = world ? world.id : '';
    });
    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getAvailableOrganizationTypes();
    this.getOrganizations();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getAvailableLocations(){
    this.availableLocations = this.worldId() ? this.locationService.getLocationByWorldId(this.worldId() || this.selectedWorld) : this.locationService.getLocations();
  }

  getOrganizations() {
    this.organizations = this.organizationService.getOrganizations(this.worldId() || this.selectedWorld);
  }

  getAvailableOrganizationTypes() {
    this.availableOrganizationTypes = this.organizationTypeService.getOrganizationTypes();
  }

  onWorldSelect(){
    this.getOrganizations();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'organizationType', label: 'Tipo de Organização', value: '', options: this.availableOrganizationTypes, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'world', label: 'Mundo', value: this.worldId() || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Local de Origem', value: '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  selectOrganization(organizationId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/organization/edit', organizationId]);
    }
    else {
      import('../organization-edit/organization-edit.component').then(({ OrganizationEditComponent }) => {
        const dialogRef = this.dialog.open(OrganizationEditComponent, {
          data: { id: organizationId },
          panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'],
          height: '80vh',
          width: '80vw',
        });

        dialogRef.closed.subscribe(() => {
          this.getOrganizations();
        });
      });
    }
  }

  getColor(organization: Organization): string {
    const color = this.getPersonalizationValue(organization, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createOrganization(formData: Record<string, string>) {
    let newOrganization = new Organization('', formData['name']);

    newOrganization = this.organizationService.saveOrganization(newOrganization, formData['world'] || null, formData['location'] || null, formData['organizationType'] || null);

    this.organizations.push(newOrganization);
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
