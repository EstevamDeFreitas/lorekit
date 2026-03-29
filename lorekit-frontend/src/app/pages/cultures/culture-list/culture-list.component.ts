import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, input, OnInit } from '@angular/core';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { Culture } from '../../../models/culture.model';
import { Location } from '../../../models/location.model';
import { World } from '../../../models/world.model';
import { CultureService } from '../../../services/culture.service';
import { LocationService } from '../../../services/location.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';
import { getPersonalizationValue, getTextClass, getTextColorStyle } from '../../../models/personalization.model';

@Component({
  selector: 'app-culture-list',
  imports: [CommonModule, NgClass, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4">
        <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
          <div class="flex flex-row justify-between mb-6">
            <h2 class="text-base mb-4">Culturas</h2>
            <app-icon-button
              size="sm"
              buttonType="secondary"
              icon="fa-solid fa-plus"
              appFormOverlay
              [title]="'Criar Cultura'"
              [fields]="getFormFields()"
              (onSave)="createCulture($event)">
            </app-icon-button>
          </div>

          @if (!worldId()) {
            <div class="mb-4">
              <app-combo-box
                class="w-full"
                label="Filtro de mundo"
                [items]="availableWorlds"
                compareProp="id"
                displayProp="name"
                [(comboValue)]="selectedWorld"
                (comboValueChange)="onWorldSelect()">
              </app-combo-box>
            </div>
          }

          <div class="flex flex-col gap-3 w-full">
            @for (culture of cultures; track culture.id) {
              <button
                type="button"
                class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                [ngClass]="selectedCultureId === culture.id ? 'text-yellow-300' : 'text-zinc-400'"
                [ngStyle]="{'color':getTextColorStyle(getPersonalizationValue(culture, 'color'))}"
                (click)="selectCulture(culture.id)">
                <div class="flex flex-row items-center">
                  <i class="fa-solid" [ngClass]="getPersonalizationValue(culture, 'icon') || 'fa-mortar-pestle'"></i>
                </div>
                <h2 [title]="culture.name" class="text-xs">{{ culture.name }}</h2>
              </button>
            }

            @if (cultures.length === 0) {
              <p class="text-xs text-zinc-500">Nenhuma cultura encontrada.</p>
            }
          </div>
        </div>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedCultureId) {
            <div class="rounded-md px-2">
              @if (showCultureEditor && cultureEditComponent) {
                <ng-container *ngComponentOutlet="cultureEditComponent; inputs: { cultureIdInput: selectedCultureId }"></ng-container>
              }
              @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando cultura...
                </div>
              }
            </div>
          }
          @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione uma cultura para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './culture-list.component.css',
})
export class CultureListComponent implements OnInit {
  private cultureService = inject(CultureService);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private worldStateService = inject(WorldStateService);

  worldId = input<string>();
  availableWorlds: World[] = [];
  availableLocations: Location[] = [];
  selectedWorld = '';
  cultures: Culture[] = [];

  selectedCultureId = '';
  showCultureEditor = false;
  cultureEditComponent: any = null;

  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit(): void {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getCultures();
    });

    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getCultures();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getAvailableLocations() {
    const activeWorldId = this.worldId() || this.selectedWorld;
    this.availableLocations = activeWorldId
      ? this.locationService.getLocationByWorldId(activeWorldId)
      : this.locationService.getLocations();
  }

  getCultures() {
    this.cultures = this.cultureService.getCultures(this.worldId() || this.selectedWorld || null);

    if (this.selectedCultureId && !this.cultures.some(culture => culture.id === this.selectedCultureId)) {
      this.selectedCultureId = '';
      this.showCultureEditor = false;
    }
  }

  onWorldSelect() {
    this.getAvailableLocations();
    this.getCultures();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || this.selectedWorld || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Localidade de Origem', value: '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  async selectCulture(cultureId: string) {
    if (this.selectedCultureId === cultureId) {
      return;
    }

    this.showCultureEditor = false;
    this.selectedCultureId = '';

    if (!this.cultureEditComponent) {
      const { CultureEditComponent } = await import('../culture-edit/culture-edit.component');
      this.cultureEditComponent = CultureEditComponent;
    }

    setTimeout(() => {
      this.selectedCultureId = cultureId;
      this.showCultureEditor = true;
    }, 0);
  }

  createCulture(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const newCulture = new Culture('', name, '');
    this.cultureService.saveCulture(newCulture, formData['world'] || null, formData['location'] || null);
    this.getCultures();
  }
}
