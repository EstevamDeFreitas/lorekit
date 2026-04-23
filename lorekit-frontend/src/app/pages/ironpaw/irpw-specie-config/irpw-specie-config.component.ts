import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { IrpwSpecie, IrpwSpecieHability, IrpwSpeciePerceptions } from '../../../models/irpw-specie.model';
import { EntityChangeService } from '../../../services/entity-change.service';
import { IrpwSpecieService } from '../../../services/irpw-specie.service';

@Component({
  selector: 'irpw-specie-config',
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent, TextAreaComponent],
  template: `
    <div class="w-[min(48rem,90vw)] max-h-[80vh] overflow-y-auto scrollbar-dark rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-white shadow-xl">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-semibold">Configuração IRPW da Espécie</h2>
          <p class="text-xs text-zinc-500">Ajuste percepções, vida base, passive e weakness.</p>
        </div>
        @if (isSaving) {
          <span class="text-xs text-zinc-500">Salvando...</span>
        }
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Percepções</h3>
          <div class="grid grid-cols-3 gap-3">
            <app-input label="Olfato" type="number" [(value)]="perceptionsData.smell" (valueChange)="onPerceptionsChange()"></app-input>
            <app-input label="Visão" type="number" [(value)]="perceptionsData.vision" (valueChange)="onPerceptionsChange()"></app-input>
            <app-input label="Audição" type="number" [(value)]="perceptionsData.hearing" (valueChange)="onPerceptionsChange()"></app-input>
          </div>
        </div>

        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Base</h3>
          <app-input label="Vida base" type="number" [(value)]="baseHealthValue" (valueChange)="onBaseHealthChange()"></app-input>
        </div>

        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Passive</h3>
          <div class="flex flex-col gap-3">
            <div class="flex justify-end">
              <div class="w-32">
                <app-button label="Adicionar" buttonType="secondary" size="xs" (click)="addPassive()"></app-button>
              </div>
            </div>

            @for (passive of passiveData; track $index) {
              <div class="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="text-xs font-semibold uppercase tracking-wide text-zinc-300">Passive {{ $index + 1 }}</span>
                  <div class="w-24">
                    <app-button label="Remover" buttonType="danger" size="xs" (click)="removePassive($index)"></app-button>
                  </div>
                </div>

                <div class="flex flex-col gap-3">
                  <app-input label="Nome" placeholder="Opcional" [(value)]="passive.name" (valueChange)="onPassiveChange()"></app-input>
                  <app-text-area label="Descrição" placeholder="Descreva o efeito passivo." height="h-36" [(value)]="passive.description" (valueChange)="onPassiveChange()"></app-text-area>
                </div>
              </div>
            }

            @if (passiveData.length === 0) {
              <div class="rounded-md border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                Nenhuma passive cadastrada.
              </div>
            }
          </div>
        </div>

        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Weakness</h3>
          <div class="flex flex-col gap-3">
            <app-input label="Nome" placeholder="Opcional" [(value)]="weaknessData.name" (valueChange)="onWeaknessChange()"></app-input>
            <app-text-area label="Descrição" placeholder="Descreva a fraqueza." height="h-36" [(value)]="weaknessData.description" (valueChange)="onWeaknessChange()"></app-text-area>
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <div class="w-28">
          <app-button label="Fechar" buttonType="secondary" size="sm" (click)="close()"></app-button>
        </div>
        <div class="w-28">
          <app-button label="Salvar" size="sm" (click)="saveNow()"></app-button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './irpw-specie-config.component.css',
})
export class IrpwSpecieConfigComponent implements OnInit {
  dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  data = inject<{ id: string }>(DIALOG_DATA);
  private irpwSpecieService = inject(IrpwSpecieService);
  private entityChangeService = inject(EntityChangeService);

  currentConfig: IrpwSpecie = new IrpwSpecie();
  isSaving = false;
  private saveTimeout?: ReturnType<typeof setTimeout>;

  perceptionsData: IrpwSpeciePerceptions = { smell: null, vision: null, hearing: null };
  passiveData: IrpwSpecieHability[] = [];
  weaknessData: IrpwSpecieHability = this.createEmptyHability();
  baseHealthValue: number | null = null;

  ngOnInit() {
    const specieId = this.data?.id || '';
    this.currentConfig = this.irpwSpecieService.getConfig(specieId) ?? new IrpwSpecie(specieId);
    this.parseConfig();
  }

  onPerceptionsChange() {
    this.currentConfig.perceptions = JSON.stringify(this.perceptionsData);
    this.scheduleAutoSave();
  }

  onBaseHealthChange() {
    this.currentConfig.basehealth = this.serializeInteger(this.baseHealthValue);
    this.scheduleAutoSave();
  }

  onPassiveChange() {
    const normalizedPassives = this.passiveData
      .map(passive => this.normalizeHability(passive))
      .filter((passive): passive is IrpwSpecieHability => passive != null);

    this.currentConfig.passive = normalizedPassives.length ? JSON.stringify(normalizedPassives) : null;
    this.scheduleAutoSave();
  }

  addPassive() {
    this.passiveData = [...this.passiveData, this.createEmptyHability()];
    this.onPassiveChange();
  }

  removePassive(index: number) {
    this.passiveData = this.passiveData.filter((_, currentIndex) => currentIndex !== index);
    this.onPassiveChange();
  }

  onWeaknessChange() {
    this.currentConfig.weakness = this.serializeHability(this.weaknessData);
    this.scheduleAutoSave();
  }

  saveNow() {
    this.persistConfig();
    this.close();
  }

  close() {
    this.dialogRef.close();
  }

  private parseConfig() {
    this.baseHealthValue = this.parseInteger(this.currentConfig.basehealth);
    this.perceptionsData = this.parsePerceptions(this.currentConfig.perceptions);
    this.passiveData = this.parsePassiveList(this.currentConfig.passive);
    this.weaknessData = this.parseHability(this.currentConfig.weakness);
  }

  private parsePassiveList(rawValue: string | null | undefined): IrpwSpecieHability[] {
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue);

      if (Array.isArray(parsed)) {
        return parsed
          .map(item => this.normalizeHability(item))
          .filter((item): item is IrpwSpecieHability => item != null);
      }

      const singlePassive = this.normalizeHability(parsed);
      return singlePassive ? [singlePassive] : [];
    } catch {
      return [];
    }
  }

  private parsePerceptions(rawValue: string | null | undefined): IrpwSpeciePerceptions {
    if (!rawValue) return { smell: null, vision: null, hearing: null };

    try {
      const parsed = JSON.parse(rawValue);
      return {
        smell: this.parseNumericValue(parsed?.smell),
        vision: this.parseNumericValue(parsed?.vision),
        hearing: this.parseNumericValue(parsed?.hearing),
      };
    } catch {
      return { smell: null, vision: null, hearing: null };
    }
  }

  private parseHability(rawValue: string | null | undefined): IrpwSpecieHability {
    if (!rawValue) return this.createEmptyHability();

    try {
      const parsed = JSON.parse(rawValue);
      return this.normalizeHability(parsed) ?? this.createEmptyHability();
    } catch {
      return this.createEmptyHability();
    }
  }

  private serializeHability(hability: IrpwSpecieHability): string | null {
    const normalized = this.normalizeHability(hability);
    return normalized ? JSON.stringify(normalized) : null;
  }

  private normalizeHability(value: unknown): IrpwSpecieHability | null {
    if (!value || typeof value !== 'object') return null;

    const source = value as Partial<IrpwSpecieHability>;
    const description = (source.description || '').trim();
    const name = (source.name || '').trim();

    if (!description && !name) return null;

    return {
      ...(name ? { name } : {}),
      description,
    };
  }

  private createEmptyHability(): IrpwSpecieHability {
    return { name: null, description: '' };
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

  private parseNumericValue(value: unknown): number | null {
    if (value == null || value === '') return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return numericValue;
  }

  private scheduleAutoSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.isSaving = true;
    this.saveTimeout = setTimeout(() => {
      this.persistConfig();
    }, 600);
  }

  private persistConfig() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = undefined;
    }

    if (!this.currentConfig.id) {
      this.isSaving = false;
      return;
    }

    this.currentConfig = this.irpwSpecieService.saveConfig(this.currentConfig.id, this.currentConfig);
    this.entityChangeService.notifySave('IRPWSpecie', this.currentConfig.id);
    this.isSaving = false;
  }
}
