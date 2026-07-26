import { CommonModule, NgClass } from '@angular/common';
import { inject, DestroyRef, Component, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { Location } from '../../../models/location.model';
import { WorldObject, ObjectType } from '../../../models/object.model';
import { World } from '../../../models/world.model';
import { LocationService } from '../../../services/location.service';
import { ObjectService } from '../../../services/object.service';
import { ObjectTypeService } from '../../../services/object-type.service';
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
  selector: 'app-object-list',
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective, TreeViewListComponent],
  template: `
    <div class="flex flex-col h-full relative">
      <div class="flex flex-row h-full gap-4">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showsidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">
            <div>
              <h2 class="text-base mb-4">Objetos</h2>
            </div>

            @if (!worldId()) {
              <div class="mb-4">
                <app-combo-box class="w-full" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name" [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
              </div>
            }

            <div class="flex flex-row items-center gap-1 mb-4">
              <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus-within:border-white">
                <div class="w-8 h-5 flex flex-row justify-center items-center"><i class="fa fa-search"></i></div>
                <input type="text" [(ngModel)]="searchTerm" (ngModelChange)="filterObjects()" placeholder="Pesquisar..." class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10" />
              </div>
              <app-icon-button size="sm" buttonType="secondary" icon="fa-solid fa-plus" appFormOverlay [title]="'Criar Objeto'" [fields]="getFormFields()" (onSave)="createObject($event)"></app-icon-button>
            </div>

            <app-tree-view-list
              [openInDialog]="false"
              [allowCreate]="true"
              [useCustomCreate]="true"
              [dragEnabled]="!searchTerm.trim()"
              [dragContextId]="'object-list:' + (worldId() || selectedWorld || 'root')"
              [canReparent]="canReparentObject"
              [fallbackIcon]="'fa-cube'"
              [createTitle]="'Criar Objeto'"
              [createFieldLabel]="'Nome'"
              [emptyChildrenLabel]="'Nenhum objeto encontrado'"
              (onDocumentSelect)="selectObject($event.id)"
              (onCreateChild)="createChildObject($event)"
              (onReparentRequested)="reparentObject($event)"
              (onDelete)="deleteObject($event)"
              (onDocumentNewTab)="openNewTabObject($event)"
              [documentArray]="filteredObjectTreeNodes">
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
            @if (selectedObjectId) {
              <div class="rounded-md px-2">
                @if (showObjectEditor && objectEditComponent) {
                  <ng-container *ngComponentOutlet="objectEditComponent; inputs: { objectIdInput: selectedObjectId }"></ng-container>
                }
                @else {
                  <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                    Carregando objeto...
                  </div>
                }
              </div>
            }
            @else {
              <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                Selecione um objeto para editar
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './object-list.component.css',
})
export class ObjectListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private objectService = inject(ObjectService);
  private objectTypeService = inject(ObjectTypeService);
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
  availableObjectTypes: ObjectType[] = [];
  selectedWorld = '';
  objects: WorldObject[] = [];
  objectTreeNodes: TreeViewNode[] = [];
  filteredObjectTreeNodes: TreeViewNode[] = [];
  searchTerm = '';
  readonly canReparentObject = (draggedId: string, newParentId: string | null) =>
    this.entityHierarchyService.canReparent('Object', draggedId, newParentId);
  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  safeDeleteDialog = inject(Dialog);


  deleteObject(objectId: string) {

    const object = this.objectService.getObject(objectId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: object.name,
        entityTable: 'Object',
        entityId: objectId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  showsidebar = true;

  selectedObjectId = '';
  showObjectEditor = false;
  objectEditComponent: any = null;

  ngOnInit(): void {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getObjects();
    });

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.table === 'Object') {
        this.getObjects();
      }
    });

    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getAvailableObjectTypes();
    this.getObjects();
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

  getAvailableObjectTypes() {
    this.availableObjectTypes = this.objectTypeService.getObjectTypes();
  }

  getObjects() {
    this.objects = this.objectService.getObjects(this.worldId() || this.selectedWorld || null).sort((a, b) => a.name.localeCompare(b.name));
    this.objectTreeNodes = buildTreeViewNodes(this.objects, item => item.name, item => item.ParentObject?.id);
    this.filterObjects();

    if (this.selectedObjectId && !this.objects.some(object => object.id === this.selectedObjectId)) {
      this.selectedObjectId = '';
      this.showObjectEditor = false;
    }
  }

  filterObjects() {
    this.filteredObjectTreeNodes = filterTreeViewNodes(this.objectTreeNodes, this.searchTerm);
  }
  onWorldSelect() {
    this.getAvailableLocations();
    this.getObjects();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'objectType', label: 'Tipo de Objeto', value: '', options: this.availableObjectTypes, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'world', label: 'Mundo', value: this.worldId() || this.selectedWorld || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Local de Origem', value: '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  async openNewTabObject(objectId: string) {
    if (this.panelMode()) {
      const object = this.objects.find(o => o.id === objectId);
      const icon = this.getPersonalizationValue(object, 'icon') || 'fa-solid fa-cube';
      this.tabManager.openTab('Object', objectId, object?.name ?? 'Objeto', icon);
      this.selectedObjectId = objectId;
      return;
    }
    if (this.selectedObjectId === objectId) {
      return;
    }

    this.showObjectEditor = false;
    this.selectedObjectId = '';

    if (!this.objectEditComponent) {
      const { ObjectEditComponent } = await import('../object-edit/object-edit.component');
      this.objectEditComponent = ObjectEditComponent;
    }

    setTimeout(() => {
      this.selectedObjectId = objectId;
      this.showObjectEditor = true;
    }, 0);
  }

  async selectObject(objectId: string) {
    if (this.panelMode()) {
      const object = this.objects.find(o => o.id === objectId);
      const icon = this.getPersonalizationValue(object, 'icon') || 'fa-solid fa-cube';
      this.tabManager.substituteCurrentTab('Object', objectId, object?.name ?? 'Objeto', icon);
      this.selectedObjectId = objectId;
      return;
    }
    if (this.selectedObjectId === objectId) {
      return;
    }

    this.showObjectEditor = false;
    this.selectedObjectId = '';

    if (!this.objectEditComponent) {
      const { ObjectEditComponent } = await import('../object-edit/object-edit.component');
      this.objectEditComponent = ObjectEditComponent;
    }

    setTimeout(() => {
      this.selectedObjectId = objectId;
      this.showObjectEditor = true;
    }, 0);
  }

  createChildObject(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    const parent = this.objects.find(object => object.id === event.parentId);
    if (!name || !parent) {
      return;
    }

    const child = this.objectService.saveObject(
      new WorldObject('', name),
      parent.ParentWorld?.id || this.worldId() || this.selectedWorld || null,
      parent.ParentLocation?.id || null,
      parent.ObjectType?.id || null
    );
    this.entityHierarchyService.reparent('Object', child.id, parent.id);
    this.getObjects();
  }

  reparentObject(event: TreeViewReparentRequest) {
    try {
      this.entityHierarchyService.reparent('Object', event.draggedId, event.newParentId);
      this.getObjects();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao reorganizar o objeto.');
    }
  }
  createObject(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const newObject = new WorldObject('', name);
    this.objectService.saveObject(newObject, formData['world'] || null, formData['location'] || null, formData['objectType'] || null);
    this.getObjects();
  }
}
