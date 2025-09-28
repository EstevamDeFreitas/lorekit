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

@Component({
  selector: 'app-settings',
  imports: [NgClass, ButtonComponent, IconButtonComponent, InputComponent, FormOverlayDirective, OverlayModule, FormOverlayComponent],
  template: `
  <div class=" rounded-md border border-zinc-800 w-200">

    <div class="flex flex-row ">
      <div class="w-75 p-4 border-e border-zinc-700 bg-zinc-900">
        <h2 class="text-lg mb-4">Configurações</h2>
        <div class="flex flex-col gap-2">
          <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800" (click)="selectTab('location_categories')" [ngClass]="{'text-emerald-500 bg-emerald-300/10 font-bold': currentTab === 'location_categories'}">Categorias de Localidade</a>
        </div>
      </div>
      <div class="flex-1 p-4 bg-zinc-900 ">
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
                @for (item of locationCategories; track $index) {
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
        }

      </div>

    </div>
  </div>`,
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit{
  dialogref = inject<DialogRef<any>>(DialogRef<any>);

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

  constructor(private locationService: LocationCategoriesService) { }

  ngOnInit(): void {
    this.selectTab('location_categories');
  }

  selectTab(tab: string) {
    this.currentTab = tab;

    if (tab === 'location_categories') {
      this.getLocationCategories();
    }

  }

  getLocationCategories() {
    this.locationService.getLocationCategories().subscribe(categories => {
      this.locationCategories = categories;
    });
  }

  saveCategory(formData: Record<string, string>, categoryId: string) {
    const categoryName = formData['name'];

    if (categoryName.trim() === '') {
      return;
    }

    const categoryToUpdate = this.locationCategories.find(c => c.id === categoryId);
    if (categoryToUpdate) {
      categoryToUpdate.name = categoryName.trim();
      this.locationService.saveLocationCategory(categoryToUpdate).subscribe({
        next: () => {
          this.getLocationCategories();
        },
        error: (err) => {
          console.error('Erro ao atualizar categoria:', err);
        }
      });
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

    this.locationService.saveLocationCategory(newCategory).subscribe({
      next: (category) => {
        this.locationCategories.push(category);
        this.creatingCategory = false;
      },
      error: (err) => {
        console.error('Erro ao criar categoria:', err);
      }
    });
  }

  deleteCategory(category: LocationCategory) {

    if(!confirm(`Tem certeza que deseja deletar a categoria ${category.name}?`)) return;

    this.locationService.deleteLocationCategory(category).subscribe({
      next: () => {
        this.locationCategories = this.locationCategories.filter(c => c.id !== category.id);
      },
      error: (err) => {
        console.error('Erro ao deletar categoria:', err);
      }
    });
  }
}
