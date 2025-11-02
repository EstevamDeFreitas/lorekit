import { Component, computed, inject, input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { SpecieService } from '../../../services/specie.service';
import { Dialog } from '@angular/cdk/dialog';
import { Specie } from '../../../models/specie.model';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { ButtonComponent } from '../../../components/button/button.component';
import { NgClass, NgStyle } from '@angular/common';
import { LocationService } from '../../../services/location.service';
import { SearchComponent } from "../../../components/search/search.component";
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";

@Component({
  selector: 'app-specie-list',
  imports: [ButtonComponent, FormOverlayDirective, NgClass, NgStyle, SearchComponent, ComboBoxComponent],
  template: `
    <div class="min-h-0 flex flex-col" [ngClass]="{'h-[63vh]': !isRouteComponent(), 'h-[95vh]': isRouteComponent()}">
      <div class="flex flex-row justify-between items-center mb-4">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Espécies</h2>
        }
        @else {
          <div></div>
        }
        <app-button
          label="Novo"
          size="sm"
          buttonType="white"
          appFormOverlay
          [title]="'Criar Espécie'"
          [fields]="getFormFields()"
          (onSave)="createSpecie($event)"
          ></app-button>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-dark">
        <br>
        @if(!worldId() && !specieId()){
          <app-combo-box class="w-60" label="Filtro de mundo" [items]="getSelectableWorlds()" compareProp="id" displayProp="name"  [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
          <br>
        }
        <div class=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
           @if (species.length === 0){
            <div class="text-center">
              <p>Nenhuma espécie disponível.</p>
            </div>
          }
          @else {
            @for (specie of species; track specie.id) {
              @let img = getImageByUsageKey(specie.Images, 'default');
              @let fullBodyImg = getImageByUsageKey(specie.Images, 'fullBody');
              <div (click)="selectSpecie(specie.id!)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2',

                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(specie, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="w-20 h-full flex items-center justify-center bg-zinc-800 rounded-md border border-zinc-500'">
                    @if (fullBodyImg) {
                      <img class="w-full h-full object-cover rounded-md" [src]="fullBodyImg.filePath" alt="">
                    }
                    @else {
                      <i class="fa fa-image text-2xl"></i>
                    }
                  </div>
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(specie, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(specie, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ specie.name }}</div>
                    </div>
                    <div class="text-xs font-bold overflow-hidden text-ellipsis text-justify line-clamp-3">{{specie.concept}}</div>
                    <div class="flex flex-row gap-1">
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-earth"></i>
                        <div class="">{{specie.ParentWorld?.name}}</div>
                      </div>
                      <div class="text-xs text-nowrap overflow-ellipsis flex flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-location-dot"></i>
                        <div class="">{{specie.ParentLocation?.name}}</div>
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
  public getImageByUsageKey = getImageByUsageKey;
  public getTextClass = getTextClass;

  worldId = input<string>();
  specieId = input<string>();

  selectedWorld : string = '';

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
    this.species = this.specieService.getSpecies(this.specieId(), this.selectedWorld);
  }

  getLocations(){
    return this.locationService.getLocations();
  }

  getSelectableWorlds(){
    let worlds = [{id:'', name: 'Nenhum'} as World];

    worlds.push(...this.availableWorlds);

    return worlds;
  }

  onWorldSelect(){
    this.getSpecies();
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
