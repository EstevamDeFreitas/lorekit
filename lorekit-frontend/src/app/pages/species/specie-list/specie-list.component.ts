import { CommonModule } from '@angular/common';
import { Component, inject, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { TreeViewNode, TreeViewReparentRequest } from '../../../components/entity-lateral-menu/tree-view.models';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { Specie } from '../../../models/specie.model';
import { World } from '../../../models/world.model';
import { Location } from '../../../models/location.model';
import { LocationService } from '../../../services/location.service';
import { SpecieService } from '../../../services/specie.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-specie-list',
  imports: [CommonModule, FormsModule, ComboBoxComponent, TreeViewListComponent, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4">
        <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
          <div class="flex flex-row justify-between mb-6">
            <h2 class="text-base mb-4">Espécies</h2>
            <app-icon-button
              size="sm"
              buttonType="secondary"
              icon="fa-solid fa-plus"
              appFormOverlay
              [title]="'Criar Espécie'"
              [fields]="getFormFields()"
              (onSave)="createSpecie($event)">
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

          <div class="flex flex-row items-center gap-1 mb-4">
            <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus:outline-none focus-within:border-white">
              <div class="w-8 h-5 flex flex-row justify-center items-center">
                <i class="fa fa-search"></i>
              </div>
              <input
                type="text"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSpecieFilter()"
                placeholder="Pesquisar..."
                class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10"
              />
            </div>
          </div>

          <app-tree-view-list
            [openInDialog]="false"
            [allowCreate]="true"
            [useCustomCreate]="true"
            [dragEnabled]="!searchTerm.trim()"
            [dragContextId]="'specie-list:' + (specieId() || worldId() || selectedWorld || 'root')"
            [canReparent]="canReparentSpecie"
            [createTitle]="'Criar Subespécie'"
            [createFieldLabel]="'Nome'"
            [fallbackIcon]="'fa-paw'"
            [emptyChildrenLabel]="'Não há subespécies relacionadas'"
            (onDocumentSelect)="selectSpecie($event.id)"
            (onCreateChild)="createSubSpecie($event)"
            (onReparentRequested)="reparentSpecie($event)"
            [documentArray]="filteredSpecieTreeDocuments">
          </app-tree-view-list>
        </div>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedSpecieId) {
            <div class="rounded-md px-2">
              @if (showSpecieEditor && specieEditComponent) {
                <ng-container *ngComponentOutlet="specieEditComponent; inputs: { specieIdInput: selectedSpecieId }"></ng-container>
              }
              @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando espécie...
                </div>
              }
            </div>
          }
          @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione uma espécie para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './specie-list.component.css',
})
export class SpecieListComponent implements OnInit {
  private specieService = inject(SpecieService);
  private locationService = inject(LocationService);
  private worldService = inject(WorldService);
  private worldStateService = inject(WorldStateService);

  worldId = input<string>();
  specieId = input<string>();

  selectedWorld = '';
  searchTerm = '';
  species: Specie[] = [];
  availableWorlds: World[] = [];
  availableLocations: Location[] = [];

  specieTree: TreeSpecieNode[] = [];
  filteredSpecieTree: TreeSpecieNode[] = [];
  filteredSpecieTreeDocuments: TreeViewNode[] = [];

  selectedSpecieId = '';
  showSpecieEditor = false;
  specieEditComponent: any = null;

  readonly canReparentSpecie = (draggedId: string, newParentId: string | null) =>
    this.specieService.canReparentSpecie(draggedId, newParentId ?? this.specieId() ?? null);

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getSpecies();
    });

    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getSpecies();
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

  getSpecies() {
    this.species = this.specieService.getSpecies(null, this.worldId() || this.selectedWorld || null);
    this.specieTree = this.buildSpecieTree(this.species, this.specieId() || null);
    this.onSpecieFilter();

    if (this.selectedSpecieId && !this.species.some(specie => specie.id === this.selectedSpecieId)) {
      this.selectedSpecieId = '';
      this.showSpecieEditor = false;
    }
  }

  onWorldSelect() {
    this.getAvailableLocations();
    this.getSpecies();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || this.selectedWorld || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Localidade Pai', value: '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  async selectSpecie(specieId: string) {
    if (this.selectedSpecieId === specieId) {
      return;
    }

    this.showSpecieEditor = false;
    this.selectedSpecieId = '';

    if (!this.specieEditComponent) {
      const { SpecieEditComponent } = await import('../specie-edit/specie-edit.component');
      this.specieEditComponent = SpecieEditComponent;
    }

    setTimeout(() => {
      this.selectedSpecieId = specieId;
      this.showSpecieEditor = true;
    }, 0);
  }

  createSpecie(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const newSpecie = new Specie('', name);
    this.specieService.saveSpecie(newSpecie, formData['world'] || this.worldId() || this.selectedWorld || null, formData['location'] || null, this.specieId() || null);
    this.getSpecies();
  }

  createSubSpecie(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    if (!name) {
      return;
    }

    const parentSpecie = this.species.find(specie => specie.id === event.parentId);
    const worldId = this.worldId() || this.selectedWorld || parentSpecie?.ParentWorld?.id || null;
    const locationId = parentSpecie?.ParentLocation?.id || null;

    const newSpecie = new Specie('', name);
    this.specieService.saveSpecie(newSpecie, worldId, locationId, event.parentId);
    this.getSpecies();
  }

  onSpecieFilter() {
    const search = this.searchTerm.trim().toLowerCase();

    if (!search) {
      this.filteredSpecieTree = this.specieTree;
      this.filteredSpecieTreeDocuments = this.filteredSpecieTree;
      return;
    }

    this.filteredSpecieTree = this.filterSpecieTree(this.specieTree, search);
    this.filteredSpecieTreeDocuments = this.filteredSpecieTree;
  }

  reparentSpecie(event: TreeViewReparentRequest) {
    const resolvedParentId = event.newParentId ?? this.specieId() ?? null;

    try {
      this.specieService.reparentSpecie(event.draggedId, resolvedParentId);
      this.getSpecies();
    } catch (error: any) {
      alert(error?.message || 'Falha ao reorganizar a espécie.');
    }
  }

  private buildSpecieTree(species: Specie[], rootParentId: string | null): TreeSpecieNode[] {
    const nodeMap = new Map<string, TreeSpecieNode>();

    for (const specie of species) {
      nodeMap.set(specie.id, {
        ...specie,
        title: specie.name,
        SubDocuments: [],
      });
    }

    const roots: TreeSpecieNode[] = [];

    for (const specie of species) {
      const node = nodeMap.get(specie.id)!;
      const parentId = specie.ParentSpecies?.id || null;

      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.SubDocuments.push(node);
      }
      else if ((rootParentId && parentId === rootParentId) || (!rootParentId && !parentId)) {
        roots.push(node);
      }
    }

    this.sortTreeByTitle(roots);
    return roots;
  }

  private sortTreeByTitle(nodes: TreeSpecieNode[]) {
    nodes.sort((a, b) => a.title.localeCompare(b.title));

    for (const node of nodes) {
      if (node.SubDocuments.length > 0) {
        this.sortTreeByTitle(node.SubDocuments);
      }
    }
  }

  private filterSpecieTree(nodes: TreeSpecieNode[], search: string): TreeSpecieNode[] {
    const filtered: TreeSpecieNode[] = [];

    for (const node of nodes) {
      const titleMatches = node.title.toLowerCase().includes(search);
      const filteredChildren = node.SubDocuments?.length
        ? this.filterSpecieTree(node.SubDocuments, search)
        : [];

      if (titleMatches || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          SubDocuments: filteredChildren,
        });
      }
    }

    return filtered;
  }
}

interface TreeSpecieNode extends Specie {
  title: string;
  SubDocuments: TreeSpecieNode[];
}
