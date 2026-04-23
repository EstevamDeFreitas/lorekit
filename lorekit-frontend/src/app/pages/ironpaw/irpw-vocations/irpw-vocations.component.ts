import { CommonModule, NgClass } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import {
  ATTRIBUTE_GROUP_LABEL,
  ATTRIBUTE_GROUP_SKILLS,
  SKILL_LABEL,
  AttributeGroupCode,
  SkillCode,
} from '../../../models/irpw-attributes-skills.model';
import {
  IrpwVocation,
  IrpwVocationAttributeGroup,
  IrpwVocationAttributes,
  IrpwVocationHability,
} from '../../../models/irpw-vocation.model';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { EntityChangeService } from '../../../services/entity-change.service';
import { getPersonalizationValue, getTextColorStyle } from '../../../models/personalization.model';

@Component({
  selector: 'irpw-vocations',
  imports: [CommonModule, NgClass, FormsModule, ButtonComponent, InputComponent, TextAreaComponent, SafeDeleteButtonComponent, PersonalizationButtonComponent, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4 relative">
        <div class="transition-all duration-300 overflow-clip shrink-0" [ngClass]="showSidebar ? 'w-80' : 'w-0'">
          <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
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

        <small
          class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer"
          [ngClass]="showSidebar ? 'start-92' : 'start-12'"
          (click)="showSidebar = !showSidebar">
          <i class="fa-solid text-zinc-400" [ngClass]="showSidebar ? 'fa-angles-left' : 'fa-angles-right'"></i>
        </small>

        <div class="flex-1 min-h-[60vh] p-4 flex flex-col">
          @if (currentVocation) {
            <div class="flex items-center justify-between gap-3 mb-4">
              <div>
                <h1 class="text-lg">{{ currentVocation.name || 'Nova vocação' }}</h1>
                <p class="text-xs text-zinc-500">Edite os campos sem lidar com JSON bruto.</p>
              </div>
              <div class="flex items-center gap-2">
                @if (isSaving) {
                  <span class="text-xs text-zinc-500">Salvando...</span>
                }
                <div class="flex flex-row gap-2">
                  <app-personalization-button [entityId]="currentVocation.id" [entityTable]="'IRPWVocation'" [size]="'xl'" (onClose)="onPersonalizationClose()"></app-personalization-button>
                  <app-safe-delete-button [entityName]="currentVocation.name ?? ''" [entityId]="currentVocation.id" [entityTable]="'IRPWVocation'" [size]="'xl'"></app-safe-delete-button>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3 col-span-2">
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                    <app-input
                      label="Nome"
                      placeholder="Ex.: Guardião da Aurora"
                      [(value)]="currentVocation.name"
                      (valueChange)="onMainFieldsChange()">
                    </app-input>
                  </div>

                  <div class="col-span-2">
                    <app-text-area
                      label="Descrição"
                      placeholder="Resumo da proposta da vocação."
                      height="h-28"
                      [(value)]="currentVocation.description"
                      (valueChange)="onMainFieldsChange()">
                    </app-text-area>
                  </div>

                  <app-input
                    label="Vida base"
                    type="number"
                    [(value)]="baseHealthValue"
                    (valueChange)="onBaseStatsChange()">
                  </app-input>

                  <app-input
                    label="Defesa base"
                    type="number"
                    [(value)]="baseDefenseValue"
                    (valueChange)="onBaseStatsChange()">
                  </app-input>
                </div>
              </div>

              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3">
                <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Passive</h2>
                <div class="flex flex-col gap-2">
                  <app-input
                    label="Nome"
                    placeholder="Opcional"
                    [(value)]="passiveData.name"
                    (valueChange)="onPassiveChange()">
                  </app-input>
                  <app-text-area
                    label="Descrição"
                    placeholder="Descreva o efeito passivo."
                    height="h-36"
                    [(value)]="passiveData.description"
                    (valueChange)="onPassiveChange()">
                  </app-text-area>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 mt-2 flex-1">
              <div class="col-span-2 rounded-md bg-zinc-925 border border-zinc-800 p-3 overflow-y-auto">
                <div class="flex items-center justify-between gap-3 mb-3">
                  <h2 class="text-sm">Poderes</h2>
                  <div class="w-36">
                    <app-button label="Adicionar poder" buttonType="secondary" size="xs" (click)="addHability()"></app-button>
                  </div>
                </div>

                <div class="flex flex-col gap-3">
                  @for (hability of habilitiesData; track $index) {
                    <div class="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                      <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Poder {{ $index + 1 }}</span>
                        <div class="w-24">
                          <app-button label="Remover" buttonType="danger" size="xs" (click)="removeHability($index)"></app-button>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        <app-input
                          label="Nome"
                          placeholder="Opcional"
                          [(value)]="hability.name"
                          (valueChange)="onHabilitiesChange()">
                        </app-input>

                        <div></div>

                        <div class="col-span-2">
                          <app-text-area
                            label="Descrição"
                            placeholder="Efeito do poder."
                            height="h-28"
                            [(value)]="hability.description"
                            (valueChange)="onHabilitiesChange()">
                          </app-text-area>
                        </div>
                      </div>
                    </div>
                  }

                  @if (habilitiesData.length === 0) {
                    <div class="rounded-md border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                      Nenhum poder cadastrado.
                    </div>
                  }
                </div>
              </div>

              <div class="rounded-md bg-zinc-925 border border-zinc-800 p-3 overflow-y-auto">
                <h2 class="text-center mb-3">Atributos</h2>
                <div class="flex flex-col gap-4">
                  @for (entry of attributeGroupEntries; track entry[0]) {
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-semibold text-zinc-200 uppercase tracking-wide">{{ attributeGroupLabel[entry[0]] }}</span>
                        <input
                          type="number"
                          class="w-12 text-center bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-white outline-none focus:border-zinc-500"
                          [(ngModel)]="attributesData[entry[0]].value"
                          (ngModelChange)="onAttributesChange()">
                      </div>
                      <div class="flex flex-col gap-1.5 pl-1">
                        @for (skill of entry[1]; track skill) {
                          <div class="flex items-center justify-between gap-3">
                            <span class="text-xs text-zinc-400">{{ skillLabel[skill] }}</span>
                            <div class="flex gap-1.5">
                              @for (level of [0,1,2,3]; track level) {
                                <input
                                  type="checkbox"
                                  class="circle-checkbox level-{{level}}"
                                  [checked]="getSkillLevel(entry[0], skill) >= level"
                                  [title]="getSkillLevelLabel(level)"
                                  (click)="onCircleClick($event, entry[0], skill, level)">
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          } @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione uma vocação para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './irpw-vocations.component.css',
})
export class IrpwVocationsComponent implements OnInit, OnDestroy {
  private vocationService = inject(IrpwVocationService);
  private entityChangeService = inject(EntityChangeService);

  vocations: IrpwVocation[] = [];
  filteredVocations: IrpwVocation[] = [];
  currentVocation: IrpwVocation | null = null;
  selectedVocationId = '';
  searchTerm = '';
  showSidebar = true;
  isSaving = false;
  private saveTimeout?: ReturnType<typeof setTimeout>;

  baseHealthValue: number | null = null;
  baseDefenseValue: number | null = null;
  passiveData: IrpwVocationHability = this.createEmptyHability();
  habilitiesData: IrpwVocationHability[] = [];
  attributesData: IrpwVocationAttributes = this.createDefaultAttributes();

  readonly attributeGroupEntries = Object.entries(ATTRIBUTE_GROUP_SKILLS) as [AttributeGroupCode, SkillCode[]][];
  readonly attributeGroupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly skillLabel = SKILL_LABEL;
  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit() {
    this.loadVocations();

    this.entityChangeService.changes$.subscribe(event => {
      if (event.table === 'IRPWVocation' || event.table === 'Personalization') {
        const selectedId = this.selectedVocationId;
        this.loadVocations();

        if (selectedId) {
          this.currentVocation = this.vocationService.getVocation(selectedId);
          if (this.currentVocation) {
            this.parseSelectedVocation();
          }
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  loadVocations() {
    this.vocations = this.vocationService
      .getVocations()
      .sort((left, right) => (left.name || 'Vocação sem nome').localeCompare(right.name || 'Vocação sem nome'));

    this.applySearch();

    if (this.selectedVocationId && !this.vocations.some(vocation => vocation.id === this.selectedVocationId)) {
      this.selectedVocationId = '';
      this.currentVocation = null;
      this.resetFormState();
    }
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

  selectVocation(vocationId: string) {
    //if (this.selectedVocationId === vocationId) return;

    this.flushPendingSave();
    this.selectedVocationId = vocationId;
    this.currentVocation = this.vocationService.getVocation(vocationId);
    this.parseSelectedVocation();
  }

  createVocation(formData?: Record<string, string>) {
    this.flushPendingSave();
    const name = formData?.['name']?.trim() || '';
    const newVocation = new IrpwVocation();
    newVocation.name = name;

    const created = this.vocationService.saveVocation(newVocation);
    this.loadVocations();
    this.selectedVocationId = created.id;
    this.currentVocation = this.vocationService.getVocation(created.id);
    this.parseSelectedVocation();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
    ];
  }

  onPersonalizationClose() {
    if (!this.selectedVocationId) return;

    this.loadVocations();
    this.currentVocation = this.vocationService.getVocation(this.selectedVocationId);
    if (this.currentVocation) {
      this.parseSelectedVocation();
    }
  }

  deleteCurrentVocation() {
    if (!this.currentVocation?.id) return;

    this.vocationService.deleteVocation(this.currentVocation.id);
    this.selectedVocationId = '';
    this.currentVocation = null;
    this.resetFormState();
    this.loadVocations();
  }

  onMainFieldsChange() {
    this.syncCurrentVocationListEntry();
    this.scheduleAutoSave();
  }

  onBaseStatsChange() {
    if (!this.currentVocation) return;

    this.currentVocation.basehealth = this.serializeInteger(this.baseHealthValue);
    this.currentVocation.basedefense = this.serializeInteger(this.baseDefenseValue);
    this.scheduleAutoSave();
  }

  onPassiveChange() {
    if (!this.currentVocation) return;

    this.currentVocation.passive = this.serializeHability(this.passiveData);
    this.scheduleAutoSave();
  }

  addHability() {
    this.habilitiesData = [...this.habilitiesData, this.createEmptyHability()];
    this.onHabilitiesChange();
  }

  removeHability(index: number) {
    this.habilitiesData = this.habilitiesData.filter((_, currentIndex) => currentIndex !== index);
    this.onHabilitiesChange();
  }

  onHabilitiesChange() {
    if (!this.currentVocation) return;

    const cleanedHabilities = this.habilitiesData
      .map(hability => this.normalizeHability(hability))
      .filter((hability): hability is IrpwVocationHability => hability != null);

    this.currentVocation.habilities = cleanedHabilities.length ? JSON.stringify(cleanedHabilities) : null;
    this.scheduleAutoSave();
  }

  onAttributesChange() {
    if (!this.currentVocation) return;

    this.currentVocation.attributes = JSON.stringify(this.attributesData);
    this.scheduleAutoSave();
  }

  getSkillLevel(group: string, skill: string): number {
    return this.normalizeSkillLevel(this.attributesData[group as AttributeGroupCode]?.skills[skill]);
  }

  onCircleClick(event: Event, group: string, skill: string, level: number) {
    event.preventDefault();
    const currentLevel = this.getSkillLevel(group, skill);
    this.attributesData[group as AttributeGroupCode].skills[skill] = currentLevel === level ? 0 : this.normalizeSkillLevel(level);
    this.onAttributesChange();
  }

  getSkillLevelLabel(level: number): string {
    return ['Sem habilidade', 'Treinado', 'Intermediario', 'Mestre'][this.normalizeSkillLevel(level)];
  }

  private parseSelectedVocation() {
    this.baseHealthValue = this.parseInteger(this.currentVocation?.basehealth);
    this.baseDefenseValue = this.parseInteger(this.currentVocation?.basedefense);
    this.passiveData = this.parseHability(this.currentVocation?.passive);
    this.habilitiesData = this.parseHabilities(this.currentVocation?.habilities);
    this.attributesData = this.parseAttributes(this.currentVocation?.attributes);
  }

  private resetFormState() {
    this.baseHealthValue = null;
    this.baseDefenseValue = null;
    this.passiveData = this.createEmptyHability();
    this.habilitiesData = [];
    this.attributesData = this.createDefaultAttributes();
  }

  private parseHabilities(rawValue: string | null | undefined): IrpwVocationHability[] {
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(item => this.normalizeHability(item))
        .filter((item): item is IrpwVocationHability => item != null);
    } catch {
      return [];
    }
  }

  private parseHability(rawValue: string | null | undefined): IrpwVocationHability {
    if (!rawValue) return this.createEmptyHability();

    try {
      const parsed = JSON.parse(rawValue);
      return this.normalizeHability(parsed) ?? this.createEmptyHability();
    } catch {
      return this.createEmptyHability();
    }
  }

  private serializeHability(hability: IrpwVocationHability): string | null {
    const normalized = this.normalizeHability(hability);
    return normalized ? JSON.stringify(normalized) : null;
  }

  private normalizeHability(value: unknown): IrpwVocationHability | null {
    if (!value || typeof value !== 'object') return null;

    const source = value as Partial<IrpwVocationHability>;
    const description = (source.description || '').trim();
    const name = (source.name || '').trim();

    if (!description && !name) return null;

    return {
      ...(name ? { name } : {}),
      description,
    };
  }

  private parseAttributes(rawValue: string | null | undefined): IrpwVocationAttributes {
    let parsed: Partial<IrpwVocationAttributes> = {};

    if (rawValue) {
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        parsed = {};
      }
    }

    const attributes = this.createDefaultAttributes();
    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      attributes[group].value = this.normalizeAttributeValue(parsed[group]?.value);
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        attributes[group].skills[skill] = this.normalizeSkillLevel(parsed[group]?.skills?.[skill]);
      }
    }

    return attributes;
  }

  private createDefaultAttributes(): IrpwVocationAttributes {
    const result = {} as IrpwVocationAttributes;

    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[]) {
      const attributeGroup: IrpwVocationAttributeGroup = { value: null, skills: {} };
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group]) {
        attributeGroup.skills[skill] = 0;
      }
      result[group] = attributeGroup;
    }

    return result;
  }

  private parseInteger(value: string | null | undefined): number | null {
    if (value == null || value === '') return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return Math.trunc(numericValue);
  }

  private serializeInteger(value: number | null | undefined): string | null {
    if (value == null) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return `${Math.trunc(numericValue)}`;
  }

  private normalizeAttributeValue(value: number | null | undefined): number | null {
    if (value == null) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return Math.trunc(numericValue);
  }

  private normalizeSkillLevel(value: number | null | undefined): number {
    if (value == null) return 0;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.min(3, Math.max(0, Math.trunc(numericValue)));
  }

  private createEmptyHability(): IrpwVocationHability {
    return { name: null, description: '' };
  }

  private syncCurrentVocationListEntry() {
    if (!this.currentVocation?.id) return;

    const updateEntry = (vocation: IrpwVocation) => vocation.id === this.currentVocation?.id
      ? { ...vocation, name: this.currentVocation.name, description: this.currentVocation.description }
      : vocation;

    this.vocations = this.vocations.map(updateEntry);
    this.filteredVocations = this.filteredVocations.map(updateEntry);
  }

  private flushPendingSave() {
    if (!this.saveTimeout) return;

    clearTimeout(this.saveTimeout);
    this.persistCurrentVocation();
  }

  private scheduleAutoSave() {
    if (!this.currentVocation) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.isSaving = true;
    this.saveTimeout = setTimeout(() => {
      this.persistCurrentVocation();
    }, 600);
  }

  private persistCurrentVocation() {
    this.saveTimeout = undefined;

    if (!this.currentVocation) {
      this.isSaving = false;
      return;
    }

    const savedVocation = this.vocationService.saveVocation(this.currentVocation);
    this.currentVocation = { ...this.currentVocation, ...savedVocation };
    this.loadVocations();
    this.selectedVocationId = this.currentVocation.id;
    this.isSaving = false;
  }
}
