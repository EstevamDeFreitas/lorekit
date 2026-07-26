import { CommonModule, NgClass } from '@angular/common';
import { inject, DestroyRef, Component, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
import { getPersonalizationValue, getTextClass, getTextColorStyle } from '../../../models/personalization.model';
import { EntityChangeService } from '../../../services/entity-change.service';
import { TabManagerService } from '../../../services/tab-manager.service';

import { Dialog } from '@angular/cdk/dialog';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';

import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { buildTreeViewNodes, filterTreeViewNodes, TreeViewNode, TreeViewReparentRequest } from '../../../components/entity-lateral-menu/tree-view.models';
import { EntityHierarchyService } from '../../../services/entity-hierarchy.service';
@Component({
  selector: 'app-organization-list',
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective, TreeViewListComponent],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showsidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">

            @if (!worldId()) {
              <div class="mb-4">
                <app-combo-box class="w-full" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name" [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
              </div>
            }

            <div class="flex flex-row items-center gap-1 mb-4">
              <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus-within:border-white">
                <div class="w-8 h-5 flex flex-row justify-center items-center"><i class="fa fa-search"></i></div>
                <input type="text" [(ngModel)]="searchTerm" (ngModelChange)="filterOrganizations()" placeholder="Pesquisar..." class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10" />
              </div>
              <app-icon-button size="sm" buttonType="secondaryActive" icon="fa-solid fa-plus" appFormOverlay [title]="'Criar Organização'" [fields]="getFormFields()" (onSave)="createOrganization($event)"></app-icon-button>
            </div>

            <app-tree-view-list
              [openInDialog]="false"
              [allowCreate]="true"
              [useCustomCreate]="true"
              [dragEnabled]="!searchTerm.trim()"
              [dragContextId]="'organization-list:' + (worldId() || selectedWorld || 'root')"
              [canReparent]="canReparentOrganization"
              [fallbackIcon]="'fa-building'"
              [createTitle]="'Criar Organização'"
              [createFieldLabel]="'Nome'"
              [emptyChildrenLabel]="'Nenhuma organização encontrada'"
              (onDocumentSelect)="selectOrganization($event.id)"
              (onCreateChild)="createChildOrganization($event)"
              (onReparentRequested)="reparentOrganization($event)"
              (onDelete)="deleteOrganization($event)"
              (onDocumentNewTab)="openNewTabOrganization($event)"
              [documentArray]="filteredOrganizationTreeNodes">
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
        }
      </div>
    </div>
  `,
  styleUrl: './organization-list.component.css',
})
export class OrganizationListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private organizationService = inject(OrganizationService);
  private organizationTypeService = inject(OrganizationTypeService);
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
  availableOrganizationTypes: OrganizationType[] = [];
  selectedWorld = '';
  organizations: Organization[] = [];
  organizationTreeNodes: TreeViewNode[] = [];
  filteredOrganizationTreeNodes: TreeViewNode[] = [];
  searchTerm = '';
  readonly canReparentOrganization = (draggedId: string, newParentId: string | null) =>
    this.entityHierarchyService.canReparent('Organization', draggedId, newParentId);
  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  safeDeleteDialog = inject(Dialog);


  deleteOrganization(organizationId: string) {

    const organization = this.organizationService.getOrganization(organizationId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: organization.name,
        entityTable: 'Organization',
        entityId: organizationId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  showsidebar = true;

  selectedOrganizationId = '';
  showOrganizationEditor = false;
  organizationEditComponent: any = null;

  ngOnInit(): void {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getOrganizations();
    });

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.table === 'Organization') {
        this.getOrganizations();
      }
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
    this.organizations = this.organizationService.getOrganizations(this.worldId() || this.selectedWorld || null).sort((a, b) => a.name.localeCompare(b.name));
    this.organizationTreeNodes = buildTreeViewNodes(this.organizations, item => item.name, item => item.ParentOrganization?.id);
    this.filterOrganizations();

    if (this.selectedOrganizationId && !this.organizations.some(organization => organization.id === this.selectedOrganizationId)) {
      this.selectedOrganizationId = '';
      this.showOrganizationEditor = false;
    }
  }

  filterOrganizations() {
    this.filteredOrganizationTreeNodes = filterTreeViewNodes(this.organizationTreeNodes, this.searchTerm);
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

  async openNewTabOrganization(organizationId: string) {
    if (this.panelMode()) {
      const org = this.organizations.find(o => o.id === organizationId);
      const icon = this.getPersonalizationValue(org, 'icon') || 'fa-solid fa-building';
      this.tabManager.openTab('Organization', organizationId, org?.name ?? 'Organização', icon);
      this.selectedOrganizationId = organizationId;
      return;
    }
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

  async selectOrganization(organizationId: string) {
    if (this.panelMode()) {
      const org = this.organizations.find(o => o.id === organizationId);
      const icon = this.getPersonalizationValue(org, 'icon') || 'fa-solid fa-building';
      this.tabManager.substituteCurrentTab('Organization', organizationId, org?.name ?? 'Organização', icon);
      this.selectedOrganizationId = organizationId;
      return;
    }
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

  createChildOrganization(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    const parent = this.organizations.find(organization => organization.id === event.parentId);
    if (!name || !parent) {
      return;
    }

    const child = this.organizationService.saveOrganization(
      new Organization('', name),
      parent.ParentWorld?.id || this.worldId() || this.selectedWorld || null,
      parent.ParentLocation?.id || null,
      parent.OrganizationType?.id || null
    );
    this.entityHierarchyService.reparent('Organization', child.id, parent.id);
    this.getOrganizations();
  }

  reparentOrganization(event: TreeViewReparentRequest) {
    try {
      this.entityHierarchyService.reparent('Organization', event.draggedId, event.newParentId);
      this.getOrganizations();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao reorganizar a organização.');
    }
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
