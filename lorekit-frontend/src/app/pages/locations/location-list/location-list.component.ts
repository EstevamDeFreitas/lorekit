import { ChangeDetectorRef, Component, computed, inject, input, OnInit } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { ButtonComponent } from "../../../components/button/button.component";
import { ActivatedRoute, Router } from '@angular/router';
import { FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { LocationService } from '../../../services/location.service';
import { Location, LocationCategory } from '../../../models/location.model';
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { Dialog } from '@angular/cdk/dialog';
import { LocationEditComponent } from '../location-edit/location-edit.component';
import { ImageService } from '../../../services/image.service';
import { environment } from '../../../../enviroments/environment';

@Component({
  selector: 'app-location-list',
  imports: [ButtonComponent, FormOverlayDirective, NgClass, NgStyle],
  template: `
    <div clas>
      <div class="flex flex-row justify-between items-center mb-4 h-full">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Localidades</h2>
        }
        @else {
          <div></div>
        }
        <app-button
          label="Novo"
          buttonType="white"
          appFormOverlay
          [title]="'Criar Localidade'"
          [fields]="getFormFields()"
          (onSave)="createLocation($event)"
          ></app-button>
      </div>
      <div>
        @for (category of locationCategories; track category.id) {
          @if (locationGroups[category.id] && locationGroups[category.id].length > 0 ) {
            <h3 class="text-lg mb-2">{{ category.name }}:</h3>
            <div class="grid grid-cols-3 gap-4">
              @for (location of locationGroups[category.id]; track location.id) {
                @if (location.Image != null){
                  <div (click)="selectLocation(location.id!)" [ngStyle]="{'background-image': 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(' + location.Image.buildImageUrl() + ')', 'background-size': 'cover', 'background-position': 'center'}" class="rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2">
                    <div class="flex flex-row gap-2 items-center">
                      <i class="fa" [ngClass]="getPersonalizationItem(location, 'icon') || 'fa-location-dot'"></i>
                      <div class="text-base font-bold">{{ location.name }}</div>
                    </div>
                    <div class="text-xs">{{location.concept}}</div>
                  </div>
                }
                @else {
                  <div (click)="selectLocation(location.id!)" [ngClass]="getLocationColor(location)" class="rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2">
                    <div class="flex flex-row gap-2 items-center">
                      <i class="fa" [ngClass]="getPersonalizationItem(location, 'icon') || 'fa-location-dot'"></i>
                      <div class="text-base font-bold">{{ location.name }}</div>
                    </div>
                    <div class="text-xs">{{location.concept}}</div>
                  </div>
                }

              }
            </div>

          }

        }
      </div>
    </div>
  `,
  styleUrl: './location-list.component.css',
})
export class LocationListComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private locationService = inject(LocationService);
  private locationCategoryService = inject(LocationCategoriesService);
  private cdr = inject(ChangeDetectorRef);

  worldId = input<string>();

  dialog = inject(Dialog);

  apiUrl = environment.apiUrl;

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === LocationListComponent ||
      this.activatedRoute.component === LocationListComponent;
  });

  locationCategories: LocationCategory[] = [];

  locationGroups: Record<string, Location[]> = {};

  locations: Location[] = [];

  ngOnInit() {
    this.getLocationCategories();
    this.getLocations();
  }


  getLocationCategories() {
    this.locationCategories = this.locationCategoryService.getLocationCategories();
  }

  getLocations() {
    const locations = this.worldId() ? this.locationService.getLocationByWorldId(this.worldId()!) : this.locationService.getLocations();

    this.locationGroups = locations.reduce((groups: Record<string, Location[]>, location) => {
      const category = location.LocationCategory ? location.LocationCategory.id : '';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(location);
      return groups;
    }, {});

  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'type', label: 'Tipo', value: '', options: this.locationCategories, optionCompareProp: 'id', optionDisplayProp: 'name' }
    ];
  }

  createLocation(formData: Record<string, string>) {

    let newLocation = new Location('', formData['name'], '');

    this.locationService.saveLocation(newLocation, formData['type']);

    this.getLocations();
  }

  selectLocation(locationId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/location/edit', locationId]);
    }
    else {
      var dialogRef = this.dialog.open(LocationEditComponent, {
        data: { id: locationId },
        panelClass: 'screen-dialog',
        height: '80vh',
        width: '80vw',
      });

      dialogRef.closed.subscribe(() => {
        this.getLocations();
      });
    }
  }

  getPersonalizationItem(location: Location, key: string): string | null {
    if (location.Personalization && location.Personalization.contentJson != null && location.Personalization.contentJson != '') {
      return JSON.parse(location.Personalization.contentJson)[key] || null;
    }
    return null;
  }

  getLocationColor(location: Location): string {
    const color = this.getPersonalizationItem(location, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

}
