import { DialogRef } from '@angular/cdk/dialog';
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

@Component({
  selector: 'app-settings',
  imports: [NgClass, FormsModule, ButtonComponent, IconButtonComponent, InputComponent, FormOverlayDirective, OverlayModule, FormOverlayComponent],
  template: `
  <div class=" rounded-md border border-zinc-800">

    <div class="flex flex-row ">
      <div class="w-75 p-4 border-e border-zinc-700 bg-zinc-900">
        <h2 class="text-lg mb-4">Configurações</h2>
        <div class="flex flex-col gap-2">
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('general_settings')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'general_settings'}">Configurações Gerais</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('location_categories')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'location_categories'}">Categorias de Localidade</a>
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('organization_types')" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'organization_types'}">Tipos de Organização</a>
        </div>
      </div>
      <div class="flex-1 p-4 bg-zinc-900 overflow-y-auto scrollbar-dark">
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
        }

      </div>

    </div>
  </div>`,
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit{
  dialogref = inject<DialogRef<any>>(DialogRef<any>);
  confirm = inject<ConfirmService>(ConfirmService);
  globalParameterService = inject(GlobalParameterService);
  organizationTypeService = inject(OrganizationTypeService);

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

  exportTextFormat : 'md' | 'txt' = 'txt';

  constructor(private locationService: LocationCategoriesService) { }

  ngOnInit(): void {
    this.selectTab('general_settings');
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
}
