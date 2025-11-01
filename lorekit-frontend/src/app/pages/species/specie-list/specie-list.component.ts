import { Component, computed, inject, input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { buildImageUrl } from '../../../models/image.model';
import { SpecieService } from '../../../services/specie.service';
import { Dialog } from '@angular/cdk/dialog';
import { Specie } from '../../../models/specie.model';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { ButtonComponent } from '../../../components/button/button.component';
import { NgClass, NgStyle } from '@angular/common';
import { LocationService } from '../../../services/location.service';

@Component({
  selector: 'app-specie-list',
  imports: [ButtonComponent, FormOverlayDirective, NgClass, NgStyle],
  template: `
    <div class="h-full min-h-0 flex flex-col">
      <div class="flex flex-row justify-between items-center mb-4">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Espécies</h2>
        }
        @else {
          <div></div>
        }
        <app-button
          label="Novo"
          buttonType="white"
          appFormOverlay
          [title]="'Criar Espécie'"
          [fields]="getFormFields()"
          (onSave)="createSpecie($event)"
          ></app-button>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-dark">
        <br>
        <div class=" grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (specie of species; track specie.id) {
            @if (specie.Image != null){
              <div (click)="selectSpecie(specie.id!)" [ngStyle]="{'background-image': 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(' + buildImageUrl(specie.Image.filePath) + ')', 'background-size': 'cover', 'background-position': 'center'}" class="rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2">
                <div class="flex flex-row gap-2 items-center">
                  <i class="fa" [ngClass]="getPersonalizationValue(specie, 'icon') || 'fa-location-dot'"></i>
                  <div class="text-base font-bold">{{ specie.name }}</div>
                </div>
                <div class="text-xs">{{specie.concept}}</div>
              </div>
            }
            @else {
              <div (click)="selectSpecie(specie.id!)" [ngClass]="getColor(specie)" class="rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2">
                <div class="flex flex-row gap-2 items-center">
                  <i class="fa" [ngClass]="getPersonalizationValue(specie, 'icon') || 'fa-location-dot'"></i>
                  <div class="text-base font-bold">{{ specie.name }}</div>
                </div>
                <div class="text-xs">{{specie.concept}}</div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './specie-list.component.css',
})
export class SpecieListComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private specieService = inject(SpecieService);
  private locationService = inject(LocationService);
  private worldService = inject(WorldService);
  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;

  worldId = input<string>();
  specieId = input<string>();

  species : Specie[] = [];

  availableWorlds : World[] = [];

  dialog = inject(Dialog);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === SpecieListComponent ||
      this.activatedRoute.component === SpecieListComponent;
  });


  ngOnInit() {
    this.getAvailableWorlds();
    this.getSpecies();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getSpecies(){
    this.species = this.specieService.getSpecies(this.specieId());
  }

  getLocations(){
    return this.locationService.getLocations();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Localidade Pai', value: '', options: this.getLocations(), optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  selectSpecie(specieId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/specie/edit', specieId]);
    }
    else {
      import('../specie-edit/specie-edit.component').then(({ SpecieEditComponent }) => {
        const dialogRef = this.dialog.open(SpecieEditComponent, {
          data: { id: specieId },
          panelClass: 'screen-dialog',
          height: '80vh',
          width: '80vw',
        });

        dialogRef.closed.subscribe(() => {
          this.getSpecies();
        });
      });
    }
  }

  getColor(specie: Specie): string {
    const color = this.getPersonalizationValue(specie, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createSpecie(formData: Record<string, string>) {
    let newSpecie = new Specie('', formData['name']);

    newSpecie = this.specieService.saveSpecie(newSpecie, formData['world'] || null, formData['location'] || null, this.specieId() || null);

    this.species.push(newSpecie);
  }

}
