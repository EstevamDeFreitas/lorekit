import { Component, inject, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import type { ComponentRef } from '@angular/core';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { LocationCategory } from '../../../models/location.model';
import { InputComponent } from "../../../components/input/input.component";
import {OverlayModule} from '@angular/cdk/overlay';
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { GlobalParameterService } from '../../../services/global-parameter.service';
import { FormsModule } from '@angular/forms';
import { OrganizationType } from '../../../models/organization.model';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { ObjectType } from '../../../models/object.model';
import { ObjectTypeService } from '../../../services/object-type.service';
import { schema } from '../../../database/schema';
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { ElectronService } from '../../../services/electron.service';
import type { UiFieldConfigEditorComponent } from '../../ui-field-config/ui-field-config-editor/ui-field-config-editor.component';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';
import { UiFieldTemplate } from '../../../models/ui-field-config.model';
import { UiFieldLayoutImportDestination, UiFieldLayoutImportPlan, UiFieldLayoutPortabilityService } from '../../../services/ui-field-layout-portability.service';
import { EventType as TimelineEventType } from '../../../models/event-type.model';
import { EventTypeService } from '../../../services/event-type.service';
import { AppearanceEffectsService } from '../../../services/appearance-effects.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, ButtonComponent, IconButtonComponent, FormOverlayDirective, OverlayModule, ComboBoxComponent, InputComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit{
  confirm = inject<ConfirmService>(ConfirmService);
  globalParameterService = inject(GlobalParameterService);
  appearanceEffects = inject(AppearanceEffectsService);
  organizationTypeService = inject(OrganizationTypeService);
  objectTypeService = inject(ObjectTypeService);
  eventTypeService = inject(EventTypeService);
  uiFieldConfigService = inject(UiFieldConfigService);
  uiFieldLayoutPortabilityService = inject(UiFieldLayoutPortabilityService);
  private layoutEditorRef: ComponentRef<UiFieldConfigEditorComponent> | null = null;
  private layoutEditorContainer?: ViewContainerRef;
  private editorLoadingContainer?: ViewContainerRef;
  layoutEditorLoading = false;
  layoutEditorLoadError = '';

  @ViewChild('layoutEditorHost', { read: ViewContainerRef })
  set layoutEditorHost(container: ViewContainerRef | undefined) {
    this.layoutEditorContainer = container;
    if (!container) {
      this.layoutEditorRef?.destroy();
      this.layoutEditorRef = null;
      this.layoutEditorLoading = false;
      return;
    }
    void this.attachLayoutEditor(container);
  }

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

  textEditorEngine: 'editorjs' | 'tiptap' = 'editorjs';

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
  selectedLayoutTemplateId = '';
  fieldConfigTemplates: UiFieldTemplate[] = [];
  showNewTemplateForm = false;
  newTemplateNameInline = '';
  showLayoutImportForm = false;
  layoutImportSerialized = '';
  layoutImportPlan: UiFieldLayoutImportPlan | null = null;
  layoutImportError = '';
  layoutImportDestination: UiFieldLayoutImportDestination | null = null;
  layoutImportTemplateName = 'Layout importado';

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
      const editorEngine = this.globalParameterService.getParameter('textEditorEngine');
      this.textEditorEngine = editorEngine === 'tiptap' || editorEngine === 'editorjs'
        ? editorEngine
        : 'editorjs';
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

  selectGlobalLayout(): void {
    this.selectedLayoutTemplateId = '';
    this.layoutEditorRef?.instance.useGlobalLayout();
  }

  onFieldConfigTableChange(table: string): void {
    this.selectedFieldConfigTable = table;
    this.selectedLayoutTemplateId = '';
    this.showNewTemplateForm = false;
    this.newTemplateNameInline = '';
    this.loadFieldConfigTemplates();
    this.layoutEditorRef?.instance.setEntityTable(table);
  }

  selectLayoutTemplate(template: UiFieldTemplate): void {
    this.selectedLayoutTemplateId = template.id;
    this.layoutEditorRef?.instance.onTemplateSelected(template.id);
  }

  onEditorTemplatesChanged(): void {
    this.loadFieldConfigTemplates();
    this.selectedLayoutTemplateId = this.layoutEditorRef?.instance.activeTemplateId ?? '';
  }

  private async attachLayoutEditor(container: ViewContainerRef): Promise<void> {
    if (this.layoutEditorRef || this.editorLoadingContainer === container) return;

    this.editorLoadingContainer = container;
    this.layoutEditorLoading = true;
    this.layoutEditorLoadError = '';

    try {
      const { UiFieldConfigEditorComponent } = await import(
        '../../ui-field-config/ui-field-config-editor/ui-field-config-editor.component'
      );
      if (this.layoutEditorContainer !== container) return;

      const ref = container.createComponent(UiFieldConfigEditorComponent);
      this.layoutEditorRef = ref;
      ref.setInput('entityTable', this.selectedFieldConfigTable);
      ref.setInput('templateId', this.selectedLayoutTemplateId);
      ref.setInput('scopeMode', 'global');
      ref.setInput('embeddedMode', true);
      ref.instance.templatesChanged.subscribe(() => this.onEditorTemplatesChanged());
    } catch {
      this.layoutEditorLoadError = 'Não foi possível carregar o editor de layouts.';
    } finally {
      if (this.editorLoadingContainer === container) this.editorLoadingContainer = undefined;
      if (this.layoutEditorContainer === container) this.layoutEditorLoading = false;
    }
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
    this.selectLayoutTemplate(created);
  }

  openLayoutImport(): void {
    this.showLayoutImportForm = true;
    this.layoutImportSerialized = '';
    this.layoutImportPlan = null;
    this.layoutImportError = '';
    this.layoutImportDestination = null;
    this.layoutImportTemplateName = 'Layout importado';
  }

  closeLayoutImport(): void {
    this.showLayoutImportForm = false;
    this.layoutImportPlan = null;
    this.layoutImportError = '';
    this.layoutImportDestination = null;
  }

  async selectLayoutImportFile(): Promise<void> {
    const serialized = await this.readLayoutImportFile();
    if (!serialized) {
      return;
    }
    this.layoutImportSerialized = serialized;
    this.analyzeLayoutImport();
  }

  analyzeLayoutImport(): void {
    this.layoutImportPlan = null;
    this.layoutImportError = '';
    this.layoutImportDestination = null;

    try {
      const plan = this.uiFieldLayoutPortabilityService.prepareLayoutImport(this.layoutImportSerialized);
      this.layoutImportPlan = plan;
      this.layoutImportDestination = plan.hasExistingGlobalConfig ? null : 'replace-global';
    } catch (error) {
      this.layoutImportError = error instanceof Error ? error.message : 'Nao foi possivel validar o layout informado.';
    }
  }

  selectLayoutImportDestination(destination: UiFieldLayoutImportDestination): void {
    this.layoutImportDestination = destination;
    this.layoutImportError = '';
  }

  applyLayoutImport(): void {
    const plan = this.layoutImportPlan;
    const destination = this.layoutImportDestination;
    if (!plan || !destination) {
      this.layoutImportError = 'Valide o arquivo e escolha o destino antes de aplicar a importacao.';
      return;
    }

    try {
      const imported = this.uiFieldLayoutPortabilityService.applyLayoutImport(
        plan,
        destination,
        destination === 'create-template' ? this.layoutImportTemplateName : undefined,
      );
      this.selectedFieldConfigTable = plan.document.entityTable;
      this.selectedLayoutTemplateId = '';
      this.loadFieldConfigTemplates();
      this.layoutEditorRef?.instance.setEntityTable(plan.document.entityTable);
      this.closeLayoutImport();

      if (destination === 'create-template') {
        this.selectLayoutTemplate(imported as UiFieldTemplate);
      }
    } catch (error) {
      this.layoutImportError = error instanceof Error ? error.message : 'Nao foi possivel aplicar a importacao.';
    }
  }

  private readLayoutImportFile(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
      input.click();
    });
  }
}
