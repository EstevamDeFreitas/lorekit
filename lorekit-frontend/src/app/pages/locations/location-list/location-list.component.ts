import { Component, computed, inject, input } from '@angular/core';
import { ButtonComponent } from "../../../components/button/button.component";
import { ActivatedRoute, Router } from '@angular/router';
import { FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { LocationService } from '../../../services/location.service';
import { Location, LocationCategory } from '../../../models/location.model';
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { Dialog } from '@angular/cdk/dialog';
import { LocationEditComponent } from '../location-edit/location-edit.component';

@Component({
  selector: 'app-location-list',
  imports: [ButtonComponent, FormOverlayDirective],
  template: `
    <div>
      <div class="flex flex-row justify-between items-center mb-4">
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
                <div (click)="selectLocation(location.id)" class="rounded-md cursor-pointer selectable-jump border border-zinc-800 p-2 mb-2">
                  <div class="text-sm">{{ location.name }}</div>
                  <p></p>
                </div>
              }
            </div>

          }

        }
      </div>
    </div>
  `,
  styleUrl: './location-list.component.css',
})
export class LocationListComponent {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private locationService = inject(LocationService);
  private locationCategoryService = inject(LocationCategoriesService);

  worldId = input<string>();

  dialog = inject(Dialog);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === LocationListComponent ||
      this.activatedRoute.component === LocationListComponent;
  });

  locationCategories: LocationCategory[] = [];

  locationGroups: Record<string, Location[]> = {};

  constructor() {

    this.getCategories();
  }

  getCategories() {
    this.locationCategoryService.getLocationCategories().subscribe({
      next: (categories) => {
        this.locationCategories = categories;
        this.getLocations();
      },
      error: (error) => {
        console.error('Erro ao buscar categorias de localidade:', error);
      }
    });
  }

  getLocations() {
    const locationObservable = this.worldId() ? this.locationService.getLocationByWorldId(this.worldId()!) : this.locationService.getLocations();

    locationObservable.subscribe({
      next: (locations) => {
        this.locationGroups = locations.reduce((groups: Record<string, Location[]>, location) => {
          const category = location.categoryId || 'Sem Categoria';
          if (!groups[category]) {
            groups[category] = [];
          }
          groups[category].push(location);
          return groups;
        }, {});
      },
      error: (error) => {
        console.error('Erro ao buscar localidades:', error);
      }
    });
  }


  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'type', label: 'Tipo', value: '', options: this.locationCategories, optionCompareProp: 'id', optionDisplayProp: 'name' }
    ];
  }

  createLocation(formData: Record<string, string>) {

    const newLocation = new Location(undefined, formData['name'], '', formData['type'], this.worldId());

    this.locationService.saveLocation(newLocation).subscribe({
      next: (location) => {
        this.getCategories();
      },
      error: (error) => {
        console.error('Erro ao criar localidade:', error);
      }
    });
  }

  selectLocation(locationId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/location/edit', locationId]);
    }
    else {
      this.dialog.open(LocationEditComponent, {
        data: { id: locationId },
        panelClass: 'screen-dialog',
        height: '80vh',
        width: '80vw',
      });
    }
  }

}
