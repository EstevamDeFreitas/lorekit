import { CommonModule, NgClass } from '@angular/common';
import { inject, DestroyRef, Component, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
import { EntityChangeService } from '../../../services/entity-change.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { Dialog } from '@angular/cdk/dialog';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';

import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { buildTreeViewNodes, filterTreeViewNodes, TreeViewNode, TreeViewReparentRequest } from '../../../components/entity-lateral-menu/tree-view.models';
import { EntityHierarchyService } from '../../../services/entity-hierarchy.service';
@Component({
  selector: 'app-culture-list',
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective, TreeViewListComponent],
  template: `
    <div class="flex flex-col h-full relative">
      <div class="flex flex-row h-full gap-4">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showsidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">

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
              <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus-within:border-white">
                <div class="w-8 h-5 flex flex-row justify-center items-center">
                  <i class="fa fa-search"></i>
                </div>
                <input
                  type="text"
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="filterCultures()"
                  placeholder="Pesquisar..."
                  class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10" />
              </div>
              <app-icon-button
                size="sm"
                buttonType="secondaryActive"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="'Criar Cultura'"
                [fields]="getFormFields()"
                (onSave)="createCulture($event)">
              </app-icon-button>
            </div>

            <app-tree-view-list
              [openInDialog]="false"
              [allowCreate]="true"
              [useCustomCreate]="true"
              [dragEnabled]="!searchTerm.trim()"
              [dragContextId]="'culture-list:' + (worldId() || selectedWorld || 'root')"
              [canReparent]="canReparentCulture"
              [fallbackIcon]="'fa-mortar-pestle'"
              [createTitle]="'Criar Cultura'"
              [createFieldLabel]="'Nome'"
              [emptyChildrenLabel]="'Nenhuma cultura encontrada'"
              (onDocumentSelect)="selectCulture($event.id)"
              (onCreateChild)="createChildCulture($event)"
              (onReparentRequested)="reparentCulture($event)"
              (onDelete)="deleteCulture($event)"
              (onDocumentNewTab)="openNewTabCulture($event)"
              [documentArray]="filteredCultureTreeNodes">
            </app-tree-view-list>
          </div>
        </div>

        @if (!panelMode()) {
          <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[showsidebar ? 'start-92' : 'start-12']" (click)="showsidebar = !showsidebar">
            <i class="fa-solid text-zinc-400" [ngClass]="[showsidebar ? 'fa-angles-left' : 'fa-angles-right']"></i>
          </small>
        }

        @if (!panelMode()) {
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
        }
      </div>
    </div>
  `,
  styleUrl: './culture-list.component.css',
})
export class CultureListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private cultureService = inject(CultureService);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);
  private entityHierarchyService = inject(EntityHierarchyService);

  worldId = input<string>();
  panelMode = input<boolean>(false);
  tabManager = inject(TabManagerService);
  availableWorlds: World[] = [];
  availableLocations: Location[] = [];
  selectedWorld = '';
  cultures: Culture[] = [];
  cultureTreeNodes: TreeViewNode[] = [];
  filteredCultureTreeNodes: TreeViewNode[] = [];
  searchTerm = '';
  readonly canReparentCulture = (draggedId: string, newParentId: string | null) =>
    this.entityHierarchyService.canReparent('Culture', draggedId, newParentId);

  selectedCultureId = '';
  showCultureEditor = false;
  cultureEditComponent: any = null;

  showsidebar = true;

  safeDeleteDialog = inject(Dialog);


  deleteCulture(cultureId: string) {

    const culture = this.cultureService.getCulture(cultureId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: culture.name,
        entityTable: 'Culture',
        entityId: cultureId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit(): void {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getCultures();
    });

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.table === 'Culture') {
        this.getCultures();
      }
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
    this.cultures = this.cultureService.getCultures(this.worldId() || this.selectedWorld || null).sort((a, b) => a.name.localeCompare(b.name));
    this.cultureTreeNodes = buildTreeViewNodes(this.cultures, item => item.name, item => item.ParentCulture?.id);
    this.filterCultures();

    if (this.selectedCultureId && !this.cultures.some(culture => culture.id === this.selectedCultureId)) {
      this.selectedCultureId = '';
      this.showCultureEditor = false;
    }
  }

  filterCultures() {
    this.filteredCultureTreeNodes = filterTreeViewNodes(this.cultureTreeNodes, this.searchTerm);
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

  async openNewTabCulture(cultureId: string) {
    if (this.panelMode()) {
      const culture = this.cultures.find(c => c.id === cultureId);
      const icon = this.getPersonalizationValue(culture, 'icon') || 'fa-solid fa-mortar-pestle';
      this.tabManager.openTab('Culture', cultureId, culture?.name ?? 'Cultura', icon);
      this.selectedCultureId = cultureId;
      return;
    }
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

  async selectCulture(cultureId: string) {
    if (this.panelMode()) {
      const culture = this.cultures.find(c => c.id === cultureId);
      const icon = this.getPersonalizationValue(culture, 'icon') || 'fa-solid fa-mortar-pestle';
      this.tabManager.substituteCurrentTab('Culture', cultureId, culture?.name ?? 'Cultura', icon);
      this.selectedCultureId = cultureId;
      return;
    }
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

  createChildCulture(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    const parent = this.cultures.find(culture => culture.id === event.parentId);
    if (!name || !parent) {
      return;
    }

    const child = this.cultureService.saveCulture(
      new Culture('', name, ''),
      parent.ParentWorld?.id || this.worldId() || this.selectedWorld || null,
      parent.ParentLocation?.id || null
    ) as Culture;
    this.entityHierarchyService.reparent('Culture', child.id, parent.id);
    this.getCultures();
  }

  reparentCulture(event: TreeViewReparentRequest) {
    try {
      this.entityHierarchyService.reparent('Culture', event.draggedId, event.newParentId);
      this.getCultures();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao reorganizar a cultura.');
    }
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
