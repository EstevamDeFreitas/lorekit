import { Component, computed, inject, input, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { LocationService } from '../../../services/location.service';
import { Location, LocationCategory } from '../../../models/location.model';
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { Dialog } from '@angular/cdk/dialog';
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { WorldStateService } from '../../../services/world-state.service';
import { FormsModule } from '@angular/forms';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { Document } from '../../../models/document.model';
import { LocationEditComponent } from '../location-edit/location-edit.component';

@Component({
  selector: 'app-location-list',
  imports: [FormOverlayDirective, NgClass, ComboBoxComponent, FormsModule, IconButtonComponent, TreeViewListComponent, LocationEditComponent],
  standalone: true,
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row justify-between items-center mb-4 sticky z-25 bg-zinc-950 py-2" [ngClass]="{'top-0': isRouteComponent(), 'top-13': !isRouteComponent()}">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Localidades</h2>
        }
        @else {
          <div></div>
        }
      </div>
      <div class="flex flex-row gap-4 items-start">
        <div class="w-80 bg-zinc-900 p-3 rounded-md sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-dark">
          @if(!worldId() && !locationId()){
            <div class="mb-4">
              <app-combo-box class="w-full" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name" [(comboValue)]="selectedWorld" (comboValueChange)="getLocations()"></app-combo-box>
            </div>
          }

          <div class="flex flex-row items-center gap-1 mb-4">
            <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus:outline-none focus-within:border-white">
              <div class="w-8 h-5 flex flex-row justify-center items-center">
                <i class="fa fa-search"></i>
              </div>
              <input
                type="text"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onLocationFilter()"
                placeholder="Pesquisar..."
                class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10"
              />
            </div>
            <app-icon-button
              size="sm"
              buttonType="secondary"
              icon="fa-solid fa-plus"
              appFormOverlay
              [title]="'Criar Localidade'"
              [fields]="locationFormFields"
              (onSave)="createLocation($event)"
              ></app-icon-button>
          </div>

          <app-tree-view-list
            [openInDialog]="false"
            [allowCreate]="true"
            [useCustomCreate]="true"
            [createTitle]="'Criar Localidade'"
            [createFieldLabel]="'Nome'"
            [fallbackIcon]="'fa-paw'"
            [emptyChildrenLabel]="'Não há Localidades Relacionadas'"
            (onDocumentSelect)="selectLocation($event.id)"
            (onCreateChild)="createSubLocation($event)"
            [documentArray]="filteredLocationTreeDocuments"
          ></app-tree-view-list>
        </div>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedLocationId && showLocationEditor) {
            <div class="rounded-md p-8">
              <app-location-edit [locationIdInput]="selectedLocationId" [showLateralMenu]="false"></app-location-edit>
            </div>
          }
          @else {
            <div class="h-full rounded-md border border-zinc-800 bg-zinc-900/30 flex items-center justify-center text-zinc-500">
              Selecione uma localidade na árvore para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './location-list.component.css',
})
export class LocationListComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private locationService = inject(LocationService);
  private worldService = inject(WorldService);
  private locationCategoryService = inject(LocationCategoriesService);

  selectedWorld : string = '';
  worldId = input<string>();
  locationId = input<string>();

  dialog = inject(Dialog);

  private worldStateService = inject(WorldStateService);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === LocationListComponent ||
      this.activatedRoute.component === LocationListComponent;
  });

  locationCategories: LocationCategory[] = [];
  availableWorlds : World[] = [];
  locationFormFields: FormField[] = [];

  locations: Location[] = [];
  locationTree: TreeLocationNode[] = [];
  filteredLocationTree: TreeLocationNode[] = [];
  filteredLocationTreeDocuments: Document[] = [];
  searchTerm : string = '';
  selectedLocationId = '';
  showLocationEditor = true;

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      const worldId = world ? world.id : '';

      if (this.selectedWorld === worldId) {
        return;
      }

      this.selectedWorld = worldId;
      this.getLocations();
    });
    this.getAvailableWorlds();
    this.getLocationCategories();
    this.getLocations();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }


  getLocationCategories() {
    this.locationCategories = this.locationCategoryService.getLocationCategories();
    this.locationFormFields = this.getFormFields();
  }

  getLocations() {
    this.locations = (this.worldId() || this.selectedWorld) && !this.locationId() ? this.locationService.getLocationByWorldId(this.worldId() || this.selectedWorld) : this.locationService.getLocations(this.locationId());

    this.locationTree = this.buildLocationTree(this.locations);
    this.onLocationFilter();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'type', label: 'Tipo', value: '', options: this.locationCategories, optionCompareProp: 'id', optionDisplayProp: 'name' }
    ];
  }

  createLocation(formData: Record<string, string>) {

    let newLocation = new Location('', formData['name'], '');

    this.locationService.saveLocation(newLocation, formData['type'], this.worldId() || this.selectedWorld || undefined, this.locationId());

    this.getLocations();
  }

  selectLocation(locationId: string) {
    if (this.selectedLocationId === locationId) {
      return;
    }

    this.showLocationEditor = false;

    setTimeout(() => {
      this.selectedLocationId = locationId;
      this.showLocationEditor = true;
    });
  }

  createSubLocation(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    if (!name) {
      return;
    }

    const parentLocation = this.locations.find(location => location.id === event.parentId);
    const parentWorldId = parentLocation?.ParentWorld?.id;
    const parentCategoryId = parentLocation?.LocationCategory?.id || '';
    const selectedWorldId = this.worldId() || this.selectedWorld || undefined;

    const newLocation = new Location('', name, '');
    this.locationService.saveLocation(newLocation, parentCategoryId, selectedWorldId || parentWorldId, event.parentId);
    this.getLocations();
  }

  onLocationFilter() {
    const search = this.searchTerm.trim().toLowerCase();

    if (!search) {
      this.filteredLocationTree = this.locationTree;
      this.filteredLocationTreeDocuments = this.filteredLocationTree as unknown as Document[];
      return;
    }

    this.filteredLocationTree = this.filterLocationTree(this.locationTree, search);
    this.filteredLocationTreeDocuments = this.filteredLocationTree as unknown as Document[];
  }

  private buildLocationTree(locations: Location[]): TreeLocationNode[] {
    const nodeMap = new Map<string, TreeLocationNode>();

    for (const location of locations) {
      nodeMap.set(location.id, {
        ...location,
        title: location.name,
        SubDocuments: [],
      });
    }

    const roots: TreeLocationNode[] = [];

    for (const location of locations) {
      const node = nodeMap.get(location.id)!;
      const parentId = location.ParentLocation?.id;

      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.SubDocuments.push(node);
      }
      else {
        roots.push(node);
      }
    }

    this.sortTreeByTitle(roots);
    return roots;
  }

  private sortTreeByTitle(nodes: TreeLocationNode[]) {
    nodes.sort((a, b) => a.title.localeCompare(b.title));

    for (const node of nodes) {
      if (node.SubDocuments.length > 0) {
        this.sortTreeByTitle(node.SubDocuments);
      }
    }
  }

  private filterLocationTree(docs: TreeLocationNode[], search: string): TreeLocationNode[] {
    const filtered: TreeLocationNode[] = [];

    for (const doc of docs) {
      const titleMatches = doc.title.toLowerCase().includes(search);
      const filteredChildren = doc.SubDocuments?.length
        ? this.filterLocationTree(doc.SubDocuments, search)
        : [];

      if (titleMatches || filteredChildren.length > 0) {
        filtered.push({
          ...doc,
          SubDocuments: filteredChildren,
        });
      }
    }

    return filtered;
  }

}

interface TreeLocationNode extends Location {
  title: string;
  SubDocuments: TreeLocationNode[];
}
