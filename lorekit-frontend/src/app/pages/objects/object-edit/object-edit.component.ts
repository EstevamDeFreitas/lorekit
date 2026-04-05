import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { LocationService } from '../../../services/location.service';
import { ObjectService } from '../../../services/object.service';
import { ObjectTypeService } from '../../../services/object-type.service';
import { WorldService } from '../../../services/world.service';
import { WorldObject, ObjectType } from '../../../models/object.model';
import { World } from '../../../models/world.model';
import { Location } from '../../../models/location.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from '../../../components/editor/editor.component';
import { EntityLateralMenuComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { NavButtonComponent } from '../../../components/nav-button/nav-button.component';
import { UiFieldConfigButtonComponent } from '../../../components/ui-field-config-button/ui-field-config-button.component';
import { ObjectConfiguredFieldsComponent } from '../object-configured-fields/object-configured-fields.component';
import { EntityChangeService } from '../../../services/entity-change.service';

@Component({
  selector: 'app-object-edit',
  imports: [IconButtonComponent, PersonalizationButtonComponent, NgStyle, FormsModule, EditorComponent, EntityLateralMenuComponent, SafeDeleteButtonComponent, NavButtonComponent, UiFieldConfigButtonComponent, ObjectConfiguredFieldsComponent],
  template: `
    <div class="flex flex-col relative">
      @if(getImageByUsageKey(object.Images, 'default') != null){
        @let img = getImageByUsageKey(object.Images, 'default');
        <div class="relative w-full h-[30vh] overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-[30vh] object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(object, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }
      @if(getImageByUsageKey(object.Images, 'profile') != null){
        @let profileImg = getImageByUsageKey(object.Images, 'profile');
        <img [src]="profileImg?.filePath" class="h-[27vh] absolute top-3 left-3 object-cover rounded-md">
      }
      <br>
      <div class="flex flex-row items-center sticky py-2 top-0 z-50 bg-zinc-950">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/object"></app-icon-button>
        }
        <input type="text" (blur)="saveObject()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="object.name" />
        <div class="flex flex-row gap-2">
          <app-ui-field-config-button
            [entityTable]="'Object'"
            [entityId]="object.id"
            [parentEntityTable]="selectedWorldId ? 'World' : null"
            [parentEntityId]="selectedWorldId"
            [parentLabel]="object.ParentWorld ? ('Mundo: ' + object.ParentWorld.name) : null"
            [backRoute]="'/app/object/edit/' + object.id">
          </app-ui-field-config-button>
          <app-personalization-button [entityId]="object.id" [entityTable]="'Object'" [size]="'xl'" (onClose)="getObject()"></app-personalization-button>
          <app-safe-delete-button [entityName]="object.name" [entityId]="object.id" [entityTable]="'Object'" [size]="'xl'"></app-safe-delete-button>
        </div>
      </div>
      <div class="flex flex-row gap-4 flex-1 mt-10">
        <div class="flex-4 h-auto flex flex-col">
          <div class="flex flex-row gap-4 ms-1">
            <app-nav-button [label]="'Propriedades'" size="sm" [active]="currentTab === 'properties'" (click)="currentTab = 'properties'"></app-nav-button>
            <app-nav-button [label]="'História'" size="sm" [active]="currentTab === 'history'" (click)="currentTab = 'history'"></app-nav-button>
            @if(hasDynamicFields) {
              <app-nav-button [label]="'Campos Configurados'" size="sm" [active]="currentTab === 'configured'" (click)="currentTab = 'configured'"></app-nav-button>
            }
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('properties') {
                  <div class="w-full">
                    <app-editor [entityId]="object.id" docTitle="Propriedades" entityTable="Object" [entityName]="object.name" [document]="object.properties || ''" (saveDocument)="onEditorSave($event, 'properties')" class="w-full"></app-editor>
                  </div>
                }
                @case ('history') {
                  <div class="w-full">
                    <app-editor [entityId]="object.id + '_history'" docTitle="História" entityTable="Object" [entityName]="object.name" [document]="object.history || ''" (saveDocument)="onEditorSave($event, 'history')" class="w-full"></app-editor>
                  </div>
                }
                @case ('configured') {
                  <app-object-configured-fields [object]="object"></app-object-configured-fields>
                }
              }
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900 sticky top-20">
              <app-entity-lateral-menu [fields]="getFormFields()" (onSave)="onFieldsSave($event)" entityTable="Object" [entityId]="object.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './object-edit.component.css',
})
export class ObjectEditComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private objectService = inject(ObjectService);
  private entityChangeService = inject(EntityChangeService);
  private objectTypeService = inject(ObjectTypeService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab: string = 'properties';

  isInDialog = computed(() => !!this.dialogref);

  private dynamicFieldService = inject(DynamicFieldService);
  hasDynamicFields: boolean = this.dynamicFieldService.getDynamicFields('Object').length > 0;

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === ObjectEditComponent ||
      this.activatedRoute.component === ObjectEditComponent;
  });

  objectIdInput = input<string | null>(null);

  readonly objectId = computed(() => {
    const inputId = this.objectIdInput();
    if (inputId) {
      return inputId;
    }

    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('objectId') ?? '';
  });

  object: WorldObject = {} as WorldObject;

  selectedWorldId: string | null = null;
  selectedLocationId: string | null = null;
  selectedObjectTypeId: string | null = null;
  availableObjectTypes: ObjectType[] = [];

  isLoading = true;

  saveTimeout!: ReturnType<typeof setTimeout>;

  availableWorlds: World[] = [];
  availableLocations: Location[] = [];

  ngOnInit(): void {
    this.getObject();
    this.getWorldsAndLocations();
    this.isLoading = false;
  }

  getObject() {
    this.object = this.objectService.getObject(this.objectId());

    this.selectedLocationId = this.object.ParentLocation ? this.object.ParentLocation.id : null;
    this.selectedWorldId = this.object.ParentWorld ? this.object.ParentWorld.id : null;
    this.selectedObjectTypeId = this.object.ObjectType ? this.object.ObjectType.id : null;
  }

  getWorldsAndLocations() {
    this.availableWorlds = this.worldService.getWorlds();
    this.availableLocations = this.locationService.getLocationByWorldId(this.selectedWorldId || '');
    this.availableObjectTypes = this.objectTypeService.getObjectTypes();
  }

  saveObject() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.objectService.saveObject(this.object, this.selectedWorldId, this.selectedLocationId, this.selectedObjectTypeId);
      this.entityChangeService.notifySave('Object', this.object.id);
    }, 500);
  }

  onEditorSave($event: any, field: string) {
    this.object[field as keyof WorldObject] = JSON.stringify($event) as any;
    this.saveObject();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.object.concept = formData['concept'];
    this.object.age = formData['age'];
    this.selectedWorldId = formData['world'];
    this.selectedLocationId = formData['location'];
    this.selectedObjectTypeId = formData['objectType'];

    this.saveObject();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'concept', label: 'Conceito', value: this.object.concept || '', type: 'text-area' },
      { key: 'objectType', label: 'Tipo de Objeto', value: this.object.ObjectType ? this.object.ObjectType.id : '', options: this.availableObjectTypes, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'world', label: 'Mundo', value: this.object.ParentWorld ? this.object.ParentWorld.id : '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Local de Origem', value: this.object.ParentLocation ? this.object.ParentLocation.id : '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }
}
