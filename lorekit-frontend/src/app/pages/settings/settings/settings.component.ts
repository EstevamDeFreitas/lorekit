import { DialogRef } from '@angular/cdk/dialog';
import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { LocationCategory } from '../../../models/location.model';
import { OverlayModule } from '@angular/cdk/overlay';
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { GlobalParameterService } from '../../../services/global-parameter.service';
import { FormsModule } from '@angular/forms';
import { OrganizationType } from '../../../models/organization.model';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { schema } from '../../../database/schema';
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DynamicField } from '../../../models/dynamicfields.model';
import { ElectronService, PluginDownloadProgress } from '../../../services/electron.service';
import { UiFieldConfigEditorComponent } from '../../ui-field-config/ui-field-config-editor/ui-field-config-editor.component';
import { PluginCatalogEntry, PluginMarketplaceService } from '../../../services/plugin-marketplace.service';
import { PluginRegistryService } from '../../../services/plugin-registry.service';

@Component({
  selector: 'app-settings',
  imports: [NgClass, FormsModule, ButtonComponent, IconButtonComponent, FormOverlayDirective, OverlayModule, ComboBoxComponent],
  template: `
  <div class="w-[60vw] h-[60vh] rounded-md border border-zinc-800">

    <div class="flex flex-row ">
      <div class="w-75 h-[60vh] p-4 border-e border-zinc-700 bg-zinc-900">
        <h2 class="text-lg mb-4">Configurações</h2>
        <div class="flex flex-col gap-2">
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('general_settings')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'general_settings'}">Configurações Gerais</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('location_categories')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'location_categories'}">Categorias de Localidade</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('organization_types')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'organization_types'}">Tipos de Organização</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('dynamic_fields')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'dynamic_fields'}">Campos Dinâmicos</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('global_field_config')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'global_field_config'}">Campos Globais</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('plugin_marketplace')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'plugin_marketplace'}">Marketplace de Plugins</a>
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
                  <div class="flex flex-row gap-2">
                    <input type="radio" name="format" value="txt" [checked]="exportTextFormat === 'txt'" (change)="setExportTextFormat('txt')">
                    <span>.txt</span>
                  </div>
                  <div class="flex flex-row gap-2">
                    <input type="radio" name="format" value="md" [checked]="exportTextFormat === 'md'" (change)="setExportTextFormat('md')">
                    <span>.md</span>
                  </div>
                </div>
              </div>
            </div>
          }
          @case ('organization_types') {
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
              <div class="flex flex-col gap-4 max-w-96">
                <app-combo-box
                  class="w-full"
                  label="Entidade"
                  [items]="fieldConfigAvailableTables"
                  [comboValue]="selectedFieldConfigTable"
                  (comboValueChange)="selectedFieldConfigTable = $event">
                </app-combo-box>

                <div class="flex flex-row gap-2">
                  <app-button
                    label="Configurar Layout Global"
                    buttonType="primary"
                    size="sm"
                    icon="fa-solid fa-table-cells-large"
                    (click)="openGlobalFieldConfigDialog()">
                  </app-button>
                </div>
              </div>
            </div>
          }
          @case ('plugin_marketplace') {
            <div>
              <div class="flex justify-between items-center mb-3">
                <h3 class="text-base">Marketplace de Plugins</h3>
                <app-button label="Atualizar catálogo" buttonType="secondary" size="xs" icon="fa-solid fa-rotate" (click)="loadPluginCatalog()"></app-button>
              </div>
              @if (catalogError) {
                <p class="text-sm text-red-400 mb-3">{{ catalogError }}</p>
              }
              <div class="grid grid-cols-[260px_1fr] gap-4 h-[45vh]">
                <div class="border border-zinc-700 rounded-md overflow-y-auto">
                  @for (plugin of catalogPlugins; track plugin.id) {
                    <button class="w-full text-left p-3 border-b border-zinc-800 hover:bg-zinc-800/60" [ngClass]="{'bg-yellow-300/10': selectedPlugin?.id === plugin.id}" (click)="selectPlugin(plugin)">
                      <div class="font-semibold">{{ plugin.name }}</div>
                      <div class="text-xs text-zinc-400">v{{ plugin.version }} • {{ plugin.author }}</div>
                    </button>
                  }
                  @empty {
                    <p class="p-3 text-sm text-zinc-400">Nenhum plugin no catálogo.</p>
                  }
                </div>

                <div class="border border-zinc-700 rounded-md p-4">
                  @if (selectedPlugin) {
                    <h4 class="text-lg">{{ selectedPlugin.name }} <span class="text-zinc-400 text-sm">v{{ selectedPlugin.version }}</span></h4>
                    <p class="text-sm text-zinc-300 mt-2">{{ selectedPlugin.description }}</p>
                    <p class="text-xs text-zinc-400 mt-2">Compatível com app {{ selectedPlugin.minAppVersion }} - {{ selectedPlugin.maxAppVersion || 'latest' }}</p>
                    <p class="text-xs text-zinc-500 mt-2">Assinatura catálogo: {{ selectedPlugin.signature }}</p>

                    @if (selectedPlugin.changelog) {
                      <p class="text-xs text-zinc-400 mt-3">{{ selectedPlugin.changelog }}</p>
                    }

                    @if (getInstallationState(selectedPlugin.id)) {
                      <p class="text-xs mt-3" [ngClass]="getInstallationState(selectedPlugin.id)?.status === 'failed' ? 'text-red-400' : 'text-zinc-300'">
                        Status: {{ getInstallationState(selectedPlugin.id)?.status }}
                        @if (getInstallationState(selectedPlugin.id)?.lastError) {
                          • {{ getInstallationState(selectedPlugin.id)?.lastError }}
                        }
                      </p>
                    }

                    @if (installProgressByPlugin[selectedPlugin.id] !== undefined) {
                      <div class="mt-3">
                        <div class="h-2 w-full rounded bg-zinc-800 overflow-hidden">
                          <div class="h-full bg-yellow-500" [style.width.%]="(installProgressByPlugin[selectedPlugin.id] || 0) * 100"></div>
                        </div>
                        <p class="text-xs text-zinc-400 mt-1">Progresso: {{ ((installProgressByPlugin[selectedPlugin.id] || 0) * 100).toFixed(0) }}%</p>
                      </div>
                    }

                    <div class="mt-4">
                      <app-button label="Instalar" buttonType="primary" size="sm" icon="fa-solid fa-download" (click)="installSelectedPlugin()"></app-button>
                    </div>
                  } @else {
                    <p class="text-sm text-zinc-400">Selecione um plugin para ver os detalhes.</p>
                  }
                </div>
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
export class SettingsComponent implements OnInit, OnDestroy {
  dialogref = inject<DialogRef<any>>(DialogRef<any>);
  confirm = inject<ConfirmService>(ConfirmService);
  globalParameterService = inject(GlobalParameterService);
  organizationTypeService = inject(OrganizationTypeService);
  dynamicFieldService = inject(DynamicFieldService);
  private dialog = inject(Dialog);
  private marketplaceService = inject(PluginMarketplaceService);
  private pluginRegistryService = inject(PluginRegistryService);

  currentTab: string = '';
  locationCategories: LocationCategory[] = [];
  creatingCategory: boolean = false;
  exportTextFormat: 'md' | 'txt' = 'txt';

  categoryFormFields: FormField[] = [{ key: 'name', label: 'Nome da categoria', value: '', type: 'text' }];
  organizationTypeFormFields: FormField[] = [{ key: 'name', label: 'Nome do Tipo de Organização', value: '', type: 'text' }];

  ignoredTables = ['Personalization', 'Image', 'DynamicField', 'DynamicFieldValue', 'Document', 'UiFieldConfig', 'LocationCategory', 'Relationship', 'GlobalParameter', 'OrganizationType', 'Link'];
  availableTables = schema.filter(t => !this.ignoredTables.includes(t.name)).map(t => t.name);
  fieldConfigAvailableTables = [...this.availableTables];
  selectedFieldConfigTable: string = this.fieldConfigAvailableTables[0] || '';
  currentTable: string = '';
  dynamicFields: DynamicField[] = [];
  organizationTypes: OrganizationType[] = [];

  appVersion: string = '';
  electronService = inject(ElectronService);

  catalogPlugins: PluginCatalogEntry[] = [];
  selectedPlugin: PluginCatalogEntry | null = null;
  catalogError: string = '';
  installProgressByPlugin: Record<string, number> = {};
  private unsubscribeDownloadProgress: (() => void) | null = null;

  constructor(private locationService: LocationCategoriesService) { }

  async ngOnInit(): Promise<void> {
    this.selectTab('general_settings');
    this.appVersion = await this.electronService.getAppVersion();
    this.unsubscribeDownloadProgress = this.electronService.onPluginDownloadProgress((payload) => this.handlePluginDownloadProgress(payload));
  }

  ngOnDestroy(): void {
    this.unsubscribeDownloadProgress?.();
  }

  async loadPluginCatalog(): Promise<void> {
    this.catalogError = '';
    try {
      const catalog = await this.marketplaceService.fetchCatalog();
      if (!catalog.catalogSignature) {
        throw new Error('Catálogo inválido: assinatura ausente.');
      }
      this.catalogPlugins = catalog.plugins;
      this.selectedPlugin = this.catalogPlugins[0] ?? null;
    } catch (error) {
      this.catalogError = `Erro ao carregar catálogo: ${error instanceof Error ? error.message : 'desconhecido'}`;
    }
  }

  selectPlugin(plugin: PluginCatalogEntry): void {
    this.selectedPlugin = plugin;
  }

  getInstallationState(pluginId: string) {
    return this.pluginRegistryService.getPluginById(pluginId);
  }

  private handlePluginDownloadProgress(progress: PluginDownloadProgress): void {
    this.installProgressByPlugin[progress.pluginId] = progress.progress;
  }

  async installSelectedPlugin(): Promise<void> {
    if (!this.selectedPlugin) {
      return;
    }

    const plugin = this.selectedPlugin;
    const requestId = crypto.randomUUID();

    if (!this.isVersionCompatible(this.appVersion, plugin.minAppVersion, plugin.maxAppVersion)) {
      const message = `Versão incompatível. App ${this.appVersion}, plugin exige ${plugin.minAppVersion}${plugin.maxAppVersion ? ` até ${plugin.maxAppVersion}` : '+'}.`;
      this.pluginRegistryService.registerPlugin({
        id: plugin.id,
        version: plugin.version,
        status: 'failed',
        source: plugin.downloadUrl,
        checksum: plugin.checksum,
        appVersion: this.appVersion,
        lastError: message,
      });
      return;
    }

    this.pluginRegistryService.markPluginDownloading({
      id: plugin.id,
      version: plugin.version,
      source: plugin.downloadUrl,
      appVersion: this.appVersion,
    });

    this.installProgressByPlugin[plugin.id] = 0;

    try {
      const result = await this.electronService.downloadPlugin({
        requestId,
        pluginId: plugin.id,
        version: plugin.version,
        url: plugin.downloadUrl,
        expectedChecksum: plugin.checksum,
      });

      this.pluginRegistryService.markPluginDownloaded(plugin.id, result.checksum);
      this.pluginRegistryService.updatePluginStatus(plugin.id, 'installed');
      this.installProgressByPlugin[plugin.id] = 1;
    } catch (error) {
      const normalized = this.normalizeInstallError(error);
      this.pluginRegistryService.markPluginFailed(plugin.id, normalized);
    }
  }

  private normalizeInstallError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error || 'unknown');

    if (message.includes('PLUGIN_DOWNLOAD_INCOMPLETE')) {
      return 'Download incompleto.';
    }

    if (message.includes('PLUGIN_DOWNLOAD_CHECKSUM_INVALID')) {
      return 'Checksum inválido.';
    }

    if (message.includes('PLUGIN_DOWNLOAD_INVALID_PROTOCOL')) {
      return 'A URL de download deve usar HTTPS.';
    }

    return `Falha no download: ${message}`;
  }

  private parseVersion(version: string): [number, number, number] {
    const cleaned = version.replace(/^v/, '').split('-')[0].split('.').map(v => Number.parseInt(v, 10));
    return [cleaned[0] || 0, cleaned[1] || 0, cleaned[2] || 0];
  }

  private compareVersion(a: string, b: string): number {
    const [a1, a2, a3] = this.parseVersion(a);
    const [b1, b2, b3] = this.parseVersion(b);

    if (a1 !== b1) return a1 > b1 ? 1 : -1;
    if (a2 !== b2) return a2 > b2 ? 1 : -1;
    if (a3 !== b3) return a3 > b3 ? 1 : -1;
    return 0;
  }

  private isVersionCompatible(appVersion: string, minVersion: string, maxVersion?: string): boolean {
    if (this.compareVersion(appVersion, minVersion) < 0) return false;
    if (maxVersion && this.compareVersion(appVersion, maxVersion) > 0) return false;
    return true;
  }

  selectTab(tab: string) {
    this.currentTab = tab;

    if (tab === 'location_categories') {
      this.getLocationCategories();
    }

    if (tab === 'organization_types') {
      this.getOrganizationTypes();
    }

    if (tab === 'general_settings') {
      const format = this.globalParameterService.getParameter('exportTextFormat');
      if (format === 'md' || format === 'txt') {
        this.exportTextFormat = format;
      } else {
        this.exportTextFormat = 'txt';
      }
    }

    if (tab === 'plugin_marketplace') {
      this.loadPluginCatalog();
    }
  }

  setExportTextFormat(format: 'md' | 'txt') {
    this.exportTextFormat = format;
    this.globalParameterService.setParameter('exportTextFormat', format);
  }

  getLocationCategories() {
    this.locationCategories = this.locationService.getLocationCategories();
  }

  saveCategory(formData: Record<string, string>, categoryId: string) {
    const categoryName = formData['name'];
    if (categoryName.trim() === '') return;

    const categoryToUpdate = this.locationCategories.find(c => c.id === categoryId);
    if (categoryToUpdate) {
      categoryToUpdate.name = categoryName.trim();
      this.locationService.saveLocationCategory(categoryToUpdate);
      this.getLocationCategories();
    }
  }

  createCategory(formData: Record<string, string>) {
    const categoryName = formData['name'];
    if (categoryName.trim() === '') return;

    const newCategory: LocationCategory = { id: '', name: categoryName.trim() };
    const category = this.locationService.saveLocationCategory(newCategory);
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

  createOrganizationType(formData: Record<string, string>) {
    const typeName = formData['name'];
    if (typeName.trim() === '') return;

    const newType: OrganizationType = { id: '', name: typeName.trim() };
    const orgType = this.organizationTypeService.saveOrganizationType(newType);
    this.organizationTypes.push(orgType);
  }

  saveOrganizationType(formData: Record<string, string>, typeId: string) {
    const typeName = formData['name'];
    if (typeName.trim() === '') return;

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

  onTableSelected(event: any) {
    this.currentTable = event;
    this.dynamicFields = this.dynamicFieldService.getDynamicFields(this.currentTable);
  }

  openGlobalFieldConfigDialog() {
    if (!this.selectedFieldConfigTable) return;

    this.dialog.open(UiFieldConfigEditorComponent, {
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
  }

  createDynamicField(formData: Record<string, string>) {
    const fieldName = formData['name'];
    const fieldOptions = formData['options'];
    if (fieldName.trim() === '') return;

    const newField: DynamicField = {
      id: '',
      name: fieldName.trim(),
      entityTable: this.currentTable,
      options: fieldOptions,
      isEditorField: formData['isEditor'] === 'true' || formData['isEditor'] === '1'
    };

    const field = this.dynamicFieldService.saveDynamicField(newField);
    this.dynamicFields.push(field);
  }

  saveDynamicField(formData: Record<string, string>, fieldId: string) {
    const fieldName = formData['name'];
    const fieldOptions = formData['options'];
    if (fieldName.trim() === '') return;

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
