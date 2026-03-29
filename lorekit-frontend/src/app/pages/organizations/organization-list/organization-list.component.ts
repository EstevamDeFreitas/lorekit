import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, input, OnInit } from '@angular/core';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { Location } from '../../../models/location.model';
import { Organization, OrganizationType } from '../../../models/organization.model';
import { World } from '../../../models/world.model';
import { LocationService } from '../../../services/location.service';
import { OrganizationService } from '../../../services/organization.service';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-organization-list',
  imports: [CommonModule, NgClass, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4">
        <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
          <div class="flex flex-row justify-between mb-6">
            <h2 class="text-base mb-4">Organizações</h2>
            <app-icon-button
              size="sm"
              buttonType="secondary"
              icon="fa-solid fa-plus"
              appFormOverlay
              [title]="'Criar Organização'"
              [fields]="getFormFields()"
              (onSave)="createOrganization($event)">
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
            @for (organization of organizations; track organization.id) {
              <button
                type="button"
                class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                [ngClass]="selectedOrganizationId === organization.id ? 'text-yellow-300' : 'text-zinc-400'"
                (click)="selectOrganization(organization.id)">
                <div class="flex flex-row items-center">
                  <i class="fa-solid" [ngClass]="'fa-building'"></i>
                </div>
                <h2 [title]="organization.name" class="text-xs">{{ organization.name }}</h2>
              </button>
            }

            @if (organizations.length === 0) {
              <p class="text-xs text-zinc-500">Nenhuma organização encontrada.</p>
            }
          </div>
        </div>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedOrganizationId) {
            <div class="rounded-md px-2">
              @if (showOrganizationEditor && organizationEditComponent) {
                <ng-container *ngComponentOutlet="organizationEditComponent; inputs: { organizationIdInput: selectedOrganizationId }"></ng-container>
              }
              @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando organização...
                </div>
              }
            </div>
          }
          @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione uma organização para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './organization-list.component.css',
})
export class OrganizationListComponent implements OnInit {
  private organizationService = inject(OrganizationService);
  private organizationTypeService = inject(OrganizationTypeService);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private worldStateService = inject(WorldStateService);

  worldId = input<string>();
  availableWorlds: World[] = [];
  availableLocations: Location[] = [];
  availableOrganizationTypes: OrganizationType[] = [];
  selectedWorld = '';
  organizations: Organization[] = [];

  selectedOrganizationId = '';
  showOrganizationEditor = false;
  organizationEditComponent: any = null;

  ngOnInit(): void {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getOrganizations();
    });

    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getAvailableOrganizationTypes();
    this.getOrganizations();
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

  getAvailableOrganizationTypes() {
    this.availableOrganizationTypes = this.organizationTypeService.getOrganizationTypes();
  }

  getOrganizations() {
    this.organizations = this.organizationService.getOrganizations(this.worldId() || this.selectedWorld || null);

    if (this.selectedOrganizationId && !this.organizations.some(organization => organization.id === this.selectedOrganizationId)) {
      this.selectedOrganizationId = '';
      this.showOrganizationEditor = false;
    }
  }

  onWorldSelect() {
    this.getAvailableLocations();
    this.getOrganizations();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'organizationType', label: 'Tipo de Organização', value: '', options: this.availableOrganizationTypes, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'world', label: 'Mundo', value: this.worldId() || this.selectedWorld || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Local de Origem', value: '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  async selectOrganization(organizationId: string) {
    if (this.selectedOrganizationId === organizationId) {
      return;
    }

    this.showOrganizationEditor = false;
    this.selectedOrganizationId = '';

    if (!this.organizationEditComponent) {
      const { OrganizationEditComponent } = await import('../organization-edit/organization-edit.component');
      this.organizationEditComponent = OrganizationEditComponent;
    }

    setTimeout(() => {
      this.selectedOrganizationId = organizationId;
      this.showOrganizationEditor = true;
    }, 0);
  }

  createOrganization(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const newOrganization = new Organization('', name);
    this.organizationService.saveOrganization(newOrganization, formData['world'] || null, formData['location'] || null, formData['organizationType'] || null);
    this.getOrganizations();
  }
}
