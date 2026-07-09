import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, input, OnInit } from '@angular/core';
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
import { ContextMenuOption } from '../../../models/context-menu-option.interface';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';
import {
  ContextMenuDirective
} from '../../../directives/context-menu.directive';

@Component({
  selector: 'app-object-list',
  imports: [CommonModule, NgClass, ComboBoxComponent, IconButtonComponent, FormOverlayDirective, ContextMenuDirective],
  template: `
    <div class="flex flex-col h-full relative">
      <div class="flex flex-row h-full gap-4">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showsidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">
            <div class="flex flex-row justify-between mb-6">
              <h2 class="text-base mb-4">Objetos</h2>
              <app-icon-button
                size="sm"
                buttonType="secondary"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="'Criar Objeto'"
                [fields]="getFormFields()"
                (onSave)="createObject($event)">
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
              @for (object of objects; track object.id) {
                <button
                  type="button"
                  appContextMenu
                  [options]="menuOptions"
                  [contextId]="object.id"
                  class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                  [ngClass]="selectedObjectId === object.id ? 'text-yellow-300' : 'text-zinc-400'"
                  [ngStyle]="{'color':getTextColorStyle(getPersonalizationValue(object, 'color'))}"
                  (click)="selectObject(object.id)">
                  <div class="flex flex-row items-center">
                    <i class="fa-solid" [ngClass]="getPersonalizationValue(object, 'icon') || 'fa-cube'"></i>
                  </div>
                  <h2 [title]="object.name" class="text-xs">{{ object.name }}</h2>
                </button>
              }

              @if (objects.length === 0) {
                <p class="text-xs text-zinc-500">Nenhum objeto encontrado.</p>
              }
            </div>
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
  private objectService = inject(ObjectService);
  private objectTypeService = inject(ObjectTypeService);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);

  worldId = input<string>();
  panelMode = input<boolean>(false);
  tabManager = inject(TabManagerService);
  availableWorlds: World[] = [];
  availableLocations: Location[] = [];
  availableObjectTypes: ObjectType[] = [];
  selectedWorld = '';
  objects: WorldObject[] = [];
  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getTextColorStyle = getTextColorStyle;

  safeDeleteDialog = inject(Dialog);

  menuOptions : ContextMenuOption[] = [
    { label: 'Abrir nova guia', action: (id: string) => this.openNewTabObject(id), customIcon: 'fa-arrow-up-right-from-square' },
    { label: 'Excluir', action: (id: string) => this.deleteObject(id), customClass: 'text-red-500', customIcon: 'fa-trash' },
  ];

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
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getAvailableLocations();
      this.getObjects();
    });

    this.entityChangeService.changes$.subscribe(event => {
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

    if (this.selectedObjectId && !this.objects.some(object => object.id === this.selectedObjectId)) {
      this.selectedObjectId = '';
      this.showObjectEditor = false;
    }
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
