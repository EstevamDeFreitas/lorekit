import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, input, OnInit } from '@angular/core';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { InputComponent } from '../../../components/input/input.component';
import { IrpwVocation } from '../../../models/irpw-vocation.model';
import { getPersonalizationValue, getTextColorStyle } from '../../../models/personalization.model';
import { EntityChangeService } from '../../../services/entity-change.service';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';
import { TabManagerService } from '../../../services/tab-manager.service';

import { Dialog } from '@angular/cdk/dialog';
import { ContextMenuOption } from '../../../models/context-menu-option.interface';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';
import {
  ContextMenuDirective
} from '../../../directives/context-menu.directive';

@Component({
  selector: 'irpw-vocations-list',
  imports: [CommonModule, NgClass, InputComponent, IconButtonComponent, FormOverlayDirective, ContextMenuDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4 relative">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showSidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">
            <div class="flex items-center justify-between gap-2 mb-4">
              <h2 class="text-base">Vocações</h2>
              <app-icon-button
                size="sm"
                buttonType="secondary"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="'Criar Vocação'"
                [fields]="getFormFields()"
                (onSave)="createVocation($event)">
              </app-icon-button>
            </div>

            <div class="mb-4">
              <app-input
                placeholder="Buscar vocação..."
                [(value)]="searchTerm"
                (valueChange)="onSearch()">
              </app-input>
            </div>

            <div class="flex flex-col gap-3 w-full">
              @for (vocation of filteredVocations; track vocation.id) {
                <button
                  type="button"
                  appContextMenu
                  [options]="menuOptions"
                  [contextId]="vocation.id"
                  class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                  [ngClass]="selectedVocationId === vocation.id ? 'text-yellow-300' : 'text-zinc-400'"
                  [ngStyle]="{'color': getTextColorStyle(getPersonalizationValue(vocation, 'color'))}"
                  (click)="selectVocation(vocation.id)">
                  <div class="flex flex-row items-center">
                    <i class="fa-solid" [ngClass]="getPersonalizationValue(vocation, 'icon') || 'fa-hat-wizard'"></i>
                  </div>
                  <h2 [title]="vocation.name || 'Vocação sem nome'" class="text-xs truncate">{{ vocation.name || 'Vocação sem nome' }}</h2>
                </button>
              }

              @if (filteredVocations.length === 0) {
                <p class="text-xs text-zinc-500">Nenhuma vocação encontrada.</p>
              }
            </div>
          </div>
        </div>

        @if (!panelMode()) {
          <small
            class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer"
            [ngClass]="showSidebar ? 'start-92' : 'start-12'"
            (click)="showSidebar = !showSidebar">
            <i class="fa-solid text-zinc-400" [ngClass]="showSidebar ? 'fa-angles-left' : 'fa-angles-right'"></i>
          </small>
        }

        @if (!panelMode()) {
          <div class="flex-1 min-h-[60vh] p-4 flex flex-col">
            @if (selectedVocationId) {
              @if (showVocationEditor && vocationEditComponent) {
                <ng-container *ngComponentOutlet="vocationEditComponent; inputs: { vocationIdInput: selectedVocationId }"></ng-container>
              } @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando vocação...
                </div>
              }
            } @else {
              <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                Selecione uma vocação para editar
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class IrpwVocationsListComponent implements OnInit {
  private vocationService = inject(IrpwVocationService);
  private entityChangeService = inject(EntityChangeService);
  private tabManager = inject(TabManagerService);

  panelMode = input<boolean>(false);

  vocations: IrpwVocation[] = [];
  filteredVocations: IrpwVocation[] = [];
  searchTerm = '';
  showSidebar = true;
  selectedVocationId = '';
  showVocationEditor = false;
  vocationEditComponent: any = null;

  safeDeleteDialog = inject(Dialog);

  menuOptions : ContextMenuOption[] = [
    { label: 'Abrir nova guia', action: (id: string) => this.openNewTabVocation(id), customIcon: 'fa-arrow-up-right-from-square' },
    { label: 'Excluir', action: (id: string) => this.deleteVocation(id), customClass: 'text-red-500', customIcon: 'fa-trash' },
  ];

  deleteVocation(vocationId: string) {

    const vocation = this.vocationService.getVocation(vocationId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: vocation?.name,
        entityTable: 'IRPWVocation',
        entityId: vocationId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit(): void {
    this.loadVocations();

    this.entityChangeService.changes$.subscribe(event => {
      if (event.table === 'IRPWVocation' || event.table === 'Personalization') {
        this.loadVocations();
      }
    });
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
    ];
  }

  onSearch() {
    this.applySearch();
  }

  applySearch() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredVocations = term
      ? this.vocations.filter(vocation => (vocation.name || '').toLowerCase().includes(term))
      : [...this.vocations];
  }

  loadVocations() {
    this.vocations = this.vocationService
      .getVocations()
      .sort((left, right) => (left.name || 'Vocação sem nome').localeCompare(right.name || 'Vocação sem nome'));

    this.applySearch();

    if (this.selectedVocationId && !this.vocations.some(vocation => vocation.id === this.selectedVocationId)) {
      this.selectedVocationId = '';
      this.showVocationEditor = false;
    }
  }

  async openNewTabVocation(vocationId: string) {
    const vocation = this.vocations.find(item => item.id === vocationId);
    const icon = this.getPersonalizationValue(vocation, 'icon') || 'fa-solid fa-hat-wizard';

    if (this.panelMode()) {
      this.tabManager.openTab('Vocations', vocationId, vocation?.name || 'Vocação', icon);
      this.selectedVocationId = vocationId;
      return;
    }

    if (this.selectedVocationId === vocationId) {
      return;
    }

    this.showVocationEditor = false;
    this.selectedVocationId = '';

    if (!this.vocationEditComponent) {
      const { IrpwVocationsComponent } = await import('./irpw-vocations.component');
      this.vocationEditComponent = IrpwVocationsComponent;
    }

    setTimeout(() => {
      this.selectedVocationId = vocationId;
      this.showVocationEditor = true;
    }, 0);
  }

  async selectVocation(vocationId: string) {
    const vocation = this.vocations.find(item => item.id === vocationId);
    const icon = this.getPersonalizationValue(vocation, 'icon') || 'fa-solid fa-hat-wizard';

    if (this.panelMode()) {
      this.tabManager.substituteCurrentTab('Vocations', vocationId, vocation?.name || 'Vocação', icon);
      this.selectedVocationId = vocationId;
      return;
    }

    if (this.selectedVocationId === vocationId) {
      return;
    }

    this.showVocationEditor = false;
    this.selectedVocationId = '';

    if (!this.vocationEditComponent) {
      const { IrpwVocationsComponent } = await import('./irpw-vocations.component');
      this.vocationEditComponent = IrpwVocationsComponent;
    }

    setTimeout(() => {
      this.selectedVocationId = vocationId;
      this.showVocationEditor = true;
    }, 0);
  }

  createVocation(formData: Record<string, string>) {
    const name = formData['name']?.trim();

    const newVocation = new IrpwVocation();
    newVocation.name = name || '';

    const created = this.vocationService.saveVocation(newVocation);
    this.loadVocations();

    if (this.panelMode()) {
      const icon = this.getPersonalizationValue(created, 'icon') || 'fa-solid fa-hat-wizard';
      this.tabManager.substituteCurrentTab('Vocations', created.id, created.name || 'Vocação', icon);
      this.selectedVocationId = created.id;
    }
  }
}
