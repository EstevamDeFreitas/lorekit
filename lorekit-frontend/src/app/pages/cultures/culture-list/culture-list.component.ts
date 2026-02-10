import { Component, computed, inject, input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { CharacterService } from '../../../services/character.service';
import { SpecieService } from '../../../services/specie.service';
import { WorldService } from '../../../services/world.service';
import { CultureService } from '../../../services/culture.service';
import { LocationService } from '../../../services/location.service';
import { Dialog } from '@angular/cdk/dialog';
import { World } from '../../../models/world.model';
import { Location } from '../../../models/location.model';
import { Culture } from '../../../models/culture.model';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { NgClass, NgStyle } from '@angular/common';
import { ButtonComponent } from '../../../components/button/button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';

@Component({
  selector: 'app-culture-list',
  imports: [ButtonComponent, FormOverlayDirective, NgClass, NgStyle, ComboBoxComponent],
  template: `
    <div class="flex flex-col relative" >
      <div class="flex flex-row justify-between items-center sticky z-25 bg-zinc-950 py-2" [ngClass]="{'top-0': isRouteComponent(), 'top-13': !isRouteComponent()}">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Culturas</h2>
        }
        @else {
          <div></div>
        }
        <app-button
          label="Novo"
          size="sm"
          buttonType="white"
          appFormOverlay
          [title]="'Criar Cultura'"
          [fields]="getFormFields()"
          (onSave)="createCulture($event)"
          ></app-button>
      </div>
      @if(!worldId()){
        <div class="flex flex-row top-13 py-2 sticky bg-zinc-950">
          <app-combo-box class="w-60" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name"  [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
        </div>
      }
      <div>
        <div class=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @if (cultures.length === 0){
            <div class="text-center">
              <p>Nenhuma cultura disponível.</p>
            </div>
          }
          @else {
            @for (culture of cultures; track culture.id) {
              @let img = getImageByUsageKey(culture.Images, 'default');
              <div (click)="selectCulture(culture.id!)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2',

                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(culture, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(culture, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(culture, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ culture.name }}</div>
                    </div>
                    <div class="text-xs font-bold overflow-hidden text-ellipsis text-justify line-clamp-3">{{culture.concept}}</div>
                    <div class="flex flex-row gap-1">
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-earth"></i>
                        <div class="">{{culture.ParentWorld?.name}}</div>
                      </div>
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-paw"></i>
                        <div class="">{{culture.ParentLocation?.name}}</div>
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
  styleUrl: './culture-list.component.css',
})
export class CultureListComponent implements OnInit{
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private cultureService = inject(CultureService);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextClass = getTextClass;

  dialog = inject(Dialog);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === CultureListComponent ||
      this.activatedRoute.component === CultureListComponent;
  });

  worldId = input<string>();
  availableWorlds : World[] = [];
  availableLocations : Location[] = [];

  selectedWorld : string = '';

  cultures:Culture[] = [];

  ngOnInit(): void {
    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getCultures();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getAvailableLocations(){
    this.availableLocations = this.worldId() ? this.locationService.getLocationByWorldId(this.worldId() || this.selectedWorld) : this.locationService.getLocations();
  }

  getCultures(){
    this.cultures = this.cultureService.getCultures(this.worldId() || this.selectedWorld || null);
  }

  onWorldSelect(){
    this.getCultures();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Localidade de Origem', value: '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  selectCulture(cultureId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/culture/edit', cultureId]);
    }
    else {
      import('../culture-edit/culture-edit.component').then(({ CultureEditComponent }) => {
        const dialogRef = this.dialog.open(CultureEditComponent, {
          data: { id: cultureId },
          panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'],
          height: '80vh',
          width: '80vw',
        });

        dialogRef.closed.subscribe(() => {
          this.getCultures();
        });
      });
    }
  }

  getColor(culture: Culture): string {
    const color = this.getPersonalizationValue(culture, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createCulture(formData: Record<string, string>) {
    let newCulture = new Culture('', formData['name'], '');

    newCulture = this.cultureService.saveCulture(newCulture, formData['world'] || null, formData['location'] || null);

    this.cultures.push(newCulture);
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
