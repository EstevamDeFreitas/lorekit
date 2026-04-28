import { DialogRef } from '@angular/cdk/dialog';
import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { LocationService } from '../../../services/location.service';
import { LocationCategory } from '../../../models/location.model';
import { InputComponent } from "../../../components/input/input.component";
import {OverlayModule} from '@angular/cdk/overlay';
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { FormOverlayComponent, FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { GlobalParameterService } from '../../../services/global-parameter.service';
import { FormsModule } from '@angular/forms';
import { OrganizationType } from '../../../models/organization.model';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { ObjectType } from '../../../models/object.model';
import { ObjectTypeService } from '../../../services/object-type.service';
import { schema } from '../../../database/schema';
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DynamicField } from '../../../models/dynamicfields.model';
import { ElectronService } from '../../../services/electron.service';
import { UiFieldConfigEditorComponent } from '../../ui-field-config/ui-field-config-editor/ui-field-config-editor.component';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';
import { UiFieldTemplate } from '../../../models/ui-field-config.model';
import { EventType as TimelineEventType } from '../../../models/event-type.model';
import { EventTypeService } from '../../../services/event-type.service';

@Component({
  selector: 'app-settings',
  imports: [NgClass, FormsModule, ButtonComponent, IconButtonComponent, FormOverlayDirective, OverlayModule, ComboBoxComponent, InputComponent],
  template: `
  <div class="w-[60vw] h-[60vh] rounded-md border border-zinc-800">

    <div class="flex flex-row ">
      <div class="w-75 h-[60vh] p-4 border-e border-zinc-700 bg-zinc-900">
        <h2 class="text-lg mb-4">Configurações</h2>
        <div class="flex flex-col gap-2">
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('general_settings')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'general_settings'}">Configurações Gerais</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('location_categories')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'location_categories'}">Categorias de Localidade</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('organization_types')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'organization_types'}">Tipos de Organização</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('object_types')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'object_types'}">Tipos de Objeto</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('event_types')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'event_types'}">Tipos de Evento</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('dynamic_fields')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'dynamic_fields'}">Campos Dinâmicos</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('global_field_config')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'global_field_config'}">Campos Globais</a>
        </div>
      </div>
      <div class="flex-1 p-4 h-[60vh] bg-zinc-900 overflow-y-auto scrollbar-dark">
        @switch (currentTab) {
          @case ('location_categories') {
            <div>
              <div class="flex flex-row justify-between items-center mb-4">
                <h3 class="text-base mb-2">Categorias de Localidade</h3>
                <app-button
                  label="Adicionar"
                  buttonType="primary"
                  size="xs"
                  icon="fa-solid fa-plus"
                  appFormOverlay
                  [title]="'Adicionar Categoria'"
                  [fields]="categoryFormFields"
                  (onSave)="createCategory($event)"
                  ></app-button>
              </div>
              <div class="border border-zinc-700 rounded-md bg-zinc-900">
                @for (item of locationCategories; track item.id) {
                  <div class="flex flex-row justify-between items-center p-2 not-last:border-b not-last:border-zinc-700">
                    <p>{{item.name}}</p>
                    <div class="flex flex-row gap-2">
                      <app-icon-button
                        icon="fa-solid fa-pencil"
                        size="sm"
                        buttonType="secondary"
                        appFormOverlay
                        [title]="'Editar Categoria'"
                        [fields]="[{ key: 'name', label: 'Nome da categoria', value: item.name, type: 'text' }]"
                        [saveLabel]="'Atualizar'"
                        (onSave)="saveCategory($event, item.id)"
                        ></app-icon-button>
                      <app-icon-button icon="fa-solid fa-trash" size="sm" buttonType="danger" (click)="deleteCategory(item)"></app-icon-button>
                    </div>
                  </div>
                }
                @empty {
                  <div class="flex flex-row justify-between items-center p-2">
                    <p>Nenhuma categoria encontrada.</p>
                  </div>
                }
              </div>
            </div>
          }
          @case ('general_settings') {
            <div>
              <h3 class="text-base mb-2">Configurações Gerais</h3>
              <br>
              <p>Ao exportar textos, considerar o formato:</p>
              <div class="border border-zinc-700 rounded-md p-2">
                <div class="flex flex-row gap-6">
                  <div class="flex flex-row items-center gap-2">
                    <input type="radio" id="txtFormat" name="exportTextFormat" value="txt" [(ngModel)]="exportTextFormat" (ngModelChange)="globalParameterService.setParameter('exportTextFormat', exportTextFormat)">
                    <label for="txtFormat">.txt (Texto simples)</label>
                  </div>
                  <div class="flex flex-row gap-4">
                    <div class="flex flex-row items-center gap-2">
                      <input type="radio" id="mdFormat" name="exportTextFormat" value="md" [(ngModel)]="exportTextFormat" (ngModelChange)="globalParameterService.setParameter('exportTextFormat', exportTextFormat)">
                      <label for="mdFormat">.md (Markdown)</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
          @case ("organization_types") {
            <div>
              <div class="flex flex-row justify-between items-center mb-4">
                <h3 class="text-base mb-2">Tipos de Organização</h3>
                <app-button
                  label="Adicionar"
                  buttonType="primary"
                  size="xs"
                  icon="fa-solid fa-plus"
                  appFormOverlay
                  [title]="'Adicionar Tipo de Organização'"
                  [fields]="organizationTypeFormFields"
                  (onSave)="createOrganizationType($event)"
                  ></app-button>
              </div>
              <div class="border border-zinc-700 rounded-md bg-zinc-900">
                @for (item of organizationTypes; track item.id) {
                  <div class="flex flex-row justify-between items-center p-2 not-last:border-b not-last:border-zinc-700">
                    <p>{{item.name}}</p>
                    <div class="flex flex-row gap-2">
                      <app-icon-button
                        icon="fa-solid fa-pencil"
                        size="sm"
                        buttonType="secondary"
                        appFormOverlay
                        [title]="'Editar Categoria'"
                        [fields]="[{ key: 'name', label: 'Nome do Tipo de Organização', value: item.name, type: 'text' }]"
                        [saveLabel]="'Atualizar'"
                        (onSave)="saveOrganizationType($event, item.id)"
                        ></app-icon-button>
                      <app-icon-button icon="fa-solid fa-trash" size="sm" buttonType="danger" (click)="deleteOrganizationType(item)"></app-icon-button>
                    </div>
                  </div>
                }
                @empty {
                  <div class="flex flex-row justify-between items-center p-2">
                    <p>Nenhum tipo de organização encontrado.</p>
                  </div>
                }
              </div>
            </div>
          }
          @case ("object_types") {
            <div>
              <div class="flex flex-row justify-between items-center mb-4">
                <h3 class="text-base mb-2">Tipos de Objeto</h3>
                <app-button
                  label="Adicionar"
                  buttonType="primary"
                  size="xs"
                  icon="fa-solid fa-plus"
                  appFormOverlay
                  [title]="'Adicionar Tipo de Objeto'"
                  [fields]="objectTypeFormFields"
                  (onSave)="createObjectType($event)"
                  ></app-button>
              </div>
              <div class="border border-zinc-700 rounded-md bg-zinc-900">
                @for (item of objectTypes; track item.id) {
                  <div class="flex flex-row justify-between items-center p-2 not-last:border-b not-last:border-zinc-700">
                    <p>{{item.name}}</p>
                    <div class="flex flex-row gap-2">
                      <app-icon-button
                        icon="fa-solid fa-pencil"
                        size="sm"
                        buttonType="secondary"
                        appFormOverlay
                        [title]="'Editar Tipo de Objeto'"
                        [fields]="[{ key: 'name', label: 'Nome do Tipo de Objeto', value: item.name, type: 'text' }]"
                        [saveLabel]="'Atualizar'"
                        (onSave)="saveObjectType($event, item.id)"
                        ></app-icon-button>
                      <app-icon-button icon="fa-solid fa-trash" size="sm" buttonType="danger" (click)="deleteObjectType(item)"></app-icon-button>
                    </div>
                  </div>
                }
                @empty {
                  <div class="flex flex-row justify-between items-center p-2">
                    <p>Nenhum tipo de objeto encontrado.</p>
                  </div>
                }
              </div>
            </div>
          }
          @case ("event_types") {
            <div>
              <div class="flex flex-row justify-between items-center mb-4">
                <h3 class="text-base mb-2">Tipos de Evento</h3>
                <app-button
                  label="Adicionar"
                  buttonType="primary"
                  size="xs"
                  icon="fa-solid fa-plus"
                  appFormOverlay
                  [title]="'Adicionar Tipo de Evento'"
                  [fields]="eventTypeFormFields"
                  (onSave)="createEventType($event)"
                  ></app-button>
              </div>
              <div class="border border-zinc-700 rounded-md bg-zinc-900">
                @for (item of eventTypes; track item.id) {
                  <div class="flex flex-row justify-between items-center p-2 not-last:border-b not-last:border-zinc-700">
                    <p>{{item.name}}</p>
                    <div class="flex flex-row gap-2">
                      <app-icon-button
                        icon="fa-solid fa-pencil"
                        size="sm"
                        buttonType="secondary"
                        appFormOverlay
                        [title]="'Editar Tipo de Evento'"
                        [fields]="[{ key: 'name', label: 'Nome do Tipo de Evento', value: item.name, type: 'text' }]"
                        [saveLabel]="'Atualizar'"
                        (onSave)="saveEventType($event, item.id)"
                        ></app-icon-button>
                      <app-icon-button icon="fa-solid fa-trash" size="sm" buttonType="danger" (click)="deleteEventType(item)"></app-icon-button>
                    </div>
                  </div>
                }
                @empty {
                  <div class="flex flex-row justify-between items-center p-2">
                    <p>Nenhum tipo de evento encontrado.</p>
                  </div>
                }
              </div>
            </div>
          }
          @case ("dynamic_fields") {
            <div>
              <h3 class="text-base mb-2">Campos Dinâmicos</h3>
              <br>
              <app-combo-box class="w-60" label="Entidade" [items]="availableTables" (comboValueChange)="onTableSelected($event)"></app-combo-box>
              <br>
              @if(currentTable) {
                <div>
                  <div class="flex flex-row justify-between align-middle mb-4">
                    <h4 class="text-md mb-4">Campos para a entidade {{currentTable}}</h4>
                    <app-button
                      label="Adicionar"
                      buttonType="primary"
                      size="xs"
                      icon="fa-solid fa-plus"
                      appFormOverlay
                      [title]="'Adicionar Campo Dinâmico para ' + currentTable"
                      [fields]="[{ key: 'name', label: 'Nome do campo', value: '', type: 'text' },
                        { key: 'options', label: 'Opções do campo (separar por ; )', value: '', type: 'text'},
                        { key: 'isEditor', label: 'É Campo de Editor?', value: 'false', type: 'boolean'}
                      ]"
                      (onSave)="createDynamicField($event)"
                    ></app-button>
                  </div>


                  @for (field of dynamicFields; track field.id) {
                    <div class="grid grid-cols-3 items-center p-2 not-last:border-b not-last:border-zinc-700">
                      <p>{{field.name}}</p>
                      <p>{{field.options}}</p>
                      <div class="flex flex-row gap-2 justify-end">
                        <app-icon-button
                          label="Editar"
                          buttonType="primary"
                          size="xs"
                          icon="fa-solid fa-pencil"
                          appFormOverlay
                          [title]="'Editar Campo Dinâmico'"
                          [fields]="[{ key: 'name', label: 'Nome do campo', value: field.name, type: 'text' },
                            { key: 'options', label: 'Opções do campo (separar por ; )', value: field.options ?? '', type: 'text'},
                            { key: 'isEditor', label: 'É Campo de Editor?', value: field.isEditorField ? 'true' : 'false', type: 'boolean'}
                          ]"
                          (onSave)="saveDynamicField($event, field.id)"
                        ></app-icon-button>
                        <app-icon-button icon="fa-solid fa-trash" size="sm" buttonType="danger" (click)="deleteDynamicField(field)"></app-icon-button>
                      </div>

                    </div>
                  }
                  @empty {
                    <div class="flex flex-row justify-between items-center p-2">
                      <p>Nenhum campo dinâmico encontrado para esta entidade.</p>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @case ("global_field_config") {
            <div>
              <h3 class="text-base mb-2">Configuração Global de Campos</h3>
              <br>
              <p class="text-sm text-zinc-400 mb-3">Selecione uma entidade para definir o layout global dos campos exibidos.</p>
              <div class="flex flex-col gap-4">
                <div class="max-w-96">
                  <app-combo-box
                    class="w-full"
                    label="Entidade"
                    [items]="fieldConfigAvailableTables"
                    [comboValue]="selectedFieldConfigTable"
                    (comboValueChange)="onFieldConfigTableChange($event)">
                  </app-combo-box>
                </div>

                @if (selectedFieldConfigTable) {
                  <div class="flex flex-row gap-2">
                    <app-button
                      label="Configurar Layout Global"
                      buttonType="primary"
                      size="sm"
                      icon="fa-solid fa-table-cells-large"
                      (click)="openGlobalFieldConfigDialog()">
                    </app-button>
                  </div>

                  <div>
                    <div class="flex flex-row justify-between items-center mb-3">
                      <h4 class="text-sm text-zinc-200 font-medium">Templates de Layout</h4>
                      <app-button
                        label="Criar Novo Template"
                        buttonType="secondary"
                        size="xs"
                        icon="fa-solid fa-plus"
                        (click)="startNewTemplate()">
                      </app-button>
                    </div>

                    @if (showNewTemplateForm) {
                      <div class="flex flex-row gap-2 items-end mb-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                        <app-input
                          class="flex-1"
                          label="Nome do template"
                          [placeholder]="'Ex: Ficha de combate'"
                          [(value)]="newTemplateNameInline">
                        </app-input>
                        <app-button label="Criar" buttonType="primary" size="xs" (click)="confirmNewTemplate()"></app-button>
                        <app-button label="Cancelar" buttonType="secondary" size="xs" (click)="showNewTemplateForm = false; newTemplateNameInline = ''"></app-button>
                      </div>
                    }
                    <div class="border border-zinc-700 rounded-md bg-zinc-900">
                      @for (template of fieldConfigTemplates; track template.id) {
                        <div class="flex flex-row justify-between items-center p-2 not-last:border-b not-last:border-zinc-700">
                          <p class="text-sm">{{ template.name }}</p>
                          <div class="flex flex-row gap-2">
                            <app-icon-button
                              icon="fa-solid fa-pencil"
                              size="sm"
                              buttonType="secondary"
                              title="Editar layout do template"
                              (click)="openEditTemplateDialog(template)">
                            </app-icon-button>
                            <app-icon-button
                              icon="fa-solid fa-trash"
                              size="sm"
                              buttonType="danger"
                              (click)="deleteTemplate(template)">
                            </app-icon-button>
                          </div>
                        </div>
                      }
                      @empty {
                        <div class="flex flex-row justify-between items-center p-2">
                          <p class="text-sm text-zinc-400">Nenhum template encontrado para esta entidade.</p>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }

      </div>

    </div>
  </div>
  <div class="mt-2 text-center text-xs text-zinc-500">
    Versão {{appVersion}}
  </div>
  `,
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit{
  dialogref = inject<DialogRef<any>>(DialogRef<any>);
  confirm = inject<ConfirmService>(ConfirmService);
  globalParameterService = inject(GlobalParameterService);
  organizationTypeService = inject(OrganizationTypeService);
  objectTypeService = inject(ObjectTypeService);
  eventTypeService = inject(EventTypeService);
  dynamicFieldService = inject(DynamicFieldService);
  uiFieldConfigService = inject(UiFieldConfigService);
  private dialog = inject(Dialog);

  currentTab: string = '';

  locationCategories: LocationCategory[] = [];
  creatingCategory: boolean = false;

  categoryFormFields : FormField[] = [
    {
      key: 'name',
      label: 'Nome da categoria',
      value: '',
      type: 'text'
    }
  ];

  organizationTypeFormFields : FormField[] = [
    {
      key: 'name',
      label: 'Nome do Tipo de Organização',
      value: '',
      type: 'text'
    }
  ];

  objectTypeFormFields : FormField[] = [
    {
      key: 'name',
      label: 'Nome do Tipo de Objeto',
      value: '',
      type: 'text'
    }
  ];

  eventTypeFormFields : FormField[] = [
    {
      key: 'name',
      label: 'Nome do Tipo de Evento',
      value: '',
      type: 'text'
    }
  ];

  exportTextFormat : 'md' | 'txt' = 'txt';


  ignoredTables = ['Personalization',
                    'Image',
                    'DynamicField',
                    'DynamicFieldValue',
                    'Document',
                    'UiFieldConfig',
                    'UiFieldTemplate',
                    'LocationCategory',
                    'Relationship',
                    'GlobalParameter',
                    'OrganizationType',
                    'ObjectType',
                    'Timeline',
                    'GreatMark',
                    'EventType',
                    'Event',
                    'Link',

                  ];
  availableTables = schema.filter(t => !this.ignoredTables.includes(t.name)).map(t => t.name);
  fieldConfigAvailableTables = [...this.availableTables];
  selectedFieldConfigTable: string = this.fieldConfigAvailableTables[0] || '';
  fieldConfigTemplates: UiFieldTemplate[] = [];
  showNewTemplateForm = false;
  newTemplateNameInline = '';

  currentTable: string = '';

  dynamicFields : DynamicField[] = [];

  appVersion: string = '';
  electronService = inject(ElectronService);

  constructor(private locationService: LocationCategoriesService) { }

  async ngOnInit(): Promise<void> {
    this.selectTab('general_settings');
    this.appVersion = await this.electronService.getAppVersion();
  }

  selectTab(tab: string) {
    this.currentTab = tab;

    if (tab === 'location_categories') {
      this.getLocationCategories();
    }

    if (tab === 'organization_types') {
      this.getOrganizationTypes();
    }

    if (tab === 'object_types') {
      this.getObjectTypes();
    }

    if (tab === 'event_types') {
      this.getEventTypes();
    }

    if (tab === 'general_settings') {
      const format = this.globalParameterService.getParameter('exportTextFormat');
      if (format === 'md' || format === 'txt') {
        this.exportTextFormat = format;
      } else {
        this.exportTextFormat = 'txt';
      }
    }

    if (tab === 'global_field_config') {
      this.loadFieldConfigTemplates();
    }
  }

  getLocationCategories() {
    this.locationCategories = this.locationService.getLocationCategories();
  }

  saveCategory(formData: Record<string, string>, categoryId: string) {
    const categoryName = formData['name'];

    if (categoryName.trim() === '') {
      return;
    }

    const categoryToUpdate = this.locationCategories.find(c => c.id === categoryId);
    if (categoryToUpdate) {
      categoryToUpdate.name = categoryName.trim();
      this.locationService.saveLocationCategory(categoryToUpdate);
      this.getLocationCategories();
    }
  }


  createCategory(formData: Record<string, string>) {
    const categoryName = formData['name'];

    if (categoryName.trim() === '') {
      return;
    }

    const newCategory: LocationCategory = {
      id: '',
      name: categoryName.trim()
    };

    let category = this.locationService.saveLocationCategory(newCategory);
    this.locationCategories.push(category);
    this.creatingCategory = false;

  }

  deleteCategory(category: LocationCategory) {
    this.confirm.ask(`Tem certeza que deseja deletar a categoria ${category.name}?`).then(confirmed => {
      if (confirmed) {
        this.locationService.deleteLocationCategory(category);
        this.getLocationCategories();
      }
    });
  }

  //Organization Types
  organizationTypes: OrganizationType[] = [];
  createOrganizationType(formData: Record<string, string>) {
    const typeName = formData['name'];

    if (typeName.trim() === '') {
      return;
    }

    const newType: OrganizationType = {
      id: '',
      name: typeName.trim()
    };

    let orgType = this.organizationTypeService.saveOrganizationType(newType);
    this.organizationTypes.push(orgType);
  }

  saveOrganizationType(formData: Record<string, string>, typeId: string) {
    const typeName = formData['name'];

    if (typeName.trim() === '') {
      return;
    }

    const typeToUpdate = this.organizationTypes.find(t => t.id === typeId);
    if (typeToUpdate) {
      typeToUpdate.name = typeName.trim();
      this.organizationTypeService.saveOrganizationType(typeToUpdate);
      this.getOrganizationTypes();
    }
  }

  deleteOrganizationType(orgType: OrganizationType) {
    this.confirm.ask(`Tem certeza que deseja deletar o tipo de organização ${orgType.name}?`).then(confirmed => {
      if (confirmed) {
        this.organizationTypeService.deleteOrganizationType(orgType);
        this.getOrganizationTypes();
      }
    });
  }

  getOrganizationTypes() {
    this.organizationTypes = this.organizationTypeService.getOrganizationTypes();
  }

  //Object Types
  objectTypes: ObjectType[] = [];
  createObjectType(formData: Record<string, string>) {
    const typeName = formData['name'];

    if (typeName.trim() === '') {
      return;
    }

    const newType: ObjectType = {
      id: '',
      name: typeName.trim()
    };

    let objType = this.objectTypeService.saveObjectType(newType);
    this.objectTypes.push(objType);
  }

  saveObjectType(formData: Record<string, string>, typeId: string) {
    const typeName = formData['name'];

    if (typeName.trim() === '') {
      return;
    }

    const typeToUpdate = this.objectTypes.find(t => t.id === typeId);
    if (typeToUpdate) {
      typeToUpdate.name = typeName.trim();
      this.objectTypeService.saveObjectType(typeToUpdate);
      this.getObjectTypes();
    }
  }

  deleteObjectType(objType: ObjectType) {
    this.confirm.ask(`Tem certeza que deseja deletar o tipo de objeto ${objType.name}?`).then(confirmed => {
      if (confirmed) {
        this.objectTypeService.deleteObjectType(objType);
        this.getObjectTypes();
      }
    });
  }

  getObjectTypes() {
    this.objectTypes = this.objectTypeService.getObjectTypes();
  }

  eventTypes: TimelineEventType[] = [];
  createEventType(formData: Record<string, string>) {
    const typeName = formData['name'];

    if (typeName.trim() === '') {
      return;
    }

    const newType: TimelineEventType = {
      id: '',
      name: typeName.trim()
    };

    let eventType = this.eventTypeService.saveEventType(newType);
    this.eventTypes.push(eventType);
  }

  saveEventType(formData: Record<string, string>, typeId: string) {
    const typeName = formData['name'];

    if (typeName.trim() === '') {
      return;
    }

    const typeToUpdate = this.eventTypes.find(t => t.id === typeId);
    if (typeToUpdate) {
      typeToUpdate.name = typeName.trim();
      this.eventTypeService.saveEventType(typeToUpdate);
      this.getEventTypes();
    }
  }

  deleteEventType(eventType: TimelineEventType) {
    this.confirm.ask(`Tem certeza que deseja deletar o tipo de evento ${eventType.name}?`).then(confirmed => {
      if (confirmed) {
        this.eventTypeService.deleteEventType(eventType);
        this.getEventTypes();
      }
    });
  }

  getEventTypes() {
    this.eventTypes = this.eventTypeService.getEventTypes();
  }

  onTableSelected(event : any) {

    this.currentTable = event;

    this.dynamicFields = this.dynamicFieldService.getDynamicFields(this.currentTable);
  }

  openGlobalFieldConfigDialog() {
    if (!this.selectedFieldConfigTable) {
      return;
    }

    const ref = this.dialog.open(UiFieldConfigEditorComponent, {
      panelClass: 'screen-dialog',
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: {
        entityTable: this.selectedFieldConfigTable,
        scopeMode: 'global',
        allowParentSelection: true,
      },
    });
    ref.closed.subscribe(() => this.loadFieldConfigTemplates());
  }

  onFieldConfigTableChange(table: string): void {
    this.selectedFieldConfigTable = table;
    this.loadFieldConfigTemplates();
  }

  loadFieldConfigTemplates(): void {
    if (!this.selectedFieldConfigTable) {
      this.fieldConfigTemplates = [];
      return;
    }
    this.fieldConfigTemplates = this.uiFieldConfigService.getTemplates(this.selectedFieldConfigTable);
  }

  startNewTemplate(): void {
    if (!this.selectedFieldConfigTable) { return; }
    this.showNewTemplateForm = true;
    this.newTemplateNameInline = '';
  }

  confirmNewTemplate(): void {
    const name = this.newTemplateNameInline.trim();
    if (!name) { return; }

    const created = this.uiFieldConfigService.saveTemplate(
      name,
      this.selectedFieldConfigTable,
      getSystemDefaultConfig(this.selectedFieldConfigTable),
    );
    this.showNewTemplateForm = false;
    this.newTemplateNameInline = '';
    this.loadFieldConfigTemplates();

    const ref = this.dialog.open(UiFieldConfigEditorComponent, {
      panelClass: 'screen-dialog',
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: {
        entityTable: this.selectedFieldConfigTable,
        templateId: created.id,
        templateName: created.name,
      },
    });
    ref.closed.subscribe(() => this.loadFieldConfigTemplates());
  }

  openCreateTemplateDialog(): void {
    if (!this.selectedFieldConfigTable) { return; }
    const ref = this.dialog.open(UiFieldConfigEditorComponent, {
      panelClass: 'screen-dialog',
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: {
        entityTable: this.selectedFieldConfigTable,
        scopeMode: 'global',
      },
    });
    ref.closed.subscribe(() => this.loadFieldConfigTemplates());
  }

  openEditTemplateDialog(template: UiFieldTemplate): void {
    const ref = this.dialog.open(UiFieldConfigEditorComponent, {
      panelClass: 'screen-dialog',
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: {
        entityTable: template.entityTable,
        templateId: template.id,
        templateName: template.name,
      },
    });
    ref.closed.subscribe(() => this.loadFieldConfigTemplates());
  }

  deleteTemplate(template: UiFieldTemplate): void {
    this.confirm.ask(`Tem certeza que deseja deletar o template "${template.name}"?`).then((confirmed) => {
      if (confirmed) {
        this.uiFieldConfigService.deleteTemplate(template.id);
        this.loadFieldConfigTemplates();
      }
    });
  }

  createDynamicField(formData: Record<string, string>) {
    const fieldName = formData['name'];
    const fieldOptions = formData['options'];

    if (fieldName.trim() === '') {
      return;
    }

    const newField: DynamicField = {
      id: '',
      name: fieldName.trim(),
      entityTable: this.currentTable,
      options: fieldOptions,
      isEditorField: formData['isEditor'] === 'true' || formData['isEditor'] === '1'
    };

    let field = this.dynamicFieldService.saveDynamicField(newField);
    this.dynamicFields.push(field);
  }

  saveDynamicField(formData: Record<string, string>, fieldId: string) {
    const fieldName = formData['name'];
    const fieldOptions = formData['options'];

    if (fieldName.trim() === '') {
      return;
    }

    const fieldToUpdate = this.dynamicFields.find(f => f.id === fieldId);
    if (fieldToUpdate) {
      fieldToUpdate.name = fieldName.trim();
      fieldToUpdate.options = fieldOptions;
      this.dynamicFieldService.saveDynamicField(fieldToUpdate);
      this.onTableSelected(this.currentTable);
    }

  }

  deleteDynamicField(field: DynamicField) {
    this.confirm.ask(`Tem certeza que deseja deletar o campo dinâmico ${field.name}?`).then(confirmed => {
      if (confirmed) {
        this.dynamicFieldService.deleteDynamicField(field);
        this.onTableSelected(this.currentTable);
      }
    });
  }
}
