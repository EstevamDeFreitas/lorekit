import { NavButtonComponent } from '../../../components/nav-button/nav-button.component';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { DestroyRef, Component, inject, OnInit, signal } from '@angular/core';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { FormsModule } from '@angular/forms';
import { IrpwRepertoireEditorComponent } from '../irpw-repertoire-editor/irpw-repertoire-editor.component';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { IrpwSpecie, IrpwSpecieHability, IrpwSpeciePerceptions } from '../../../models/irpw-specie.model';
import { EntityChangeService } from '../../../services/entity-change.service';
import { IrpwSpecieService } from '../../../services/irpw-specie.service';

@Component({
  selector: 'irpw-specie-config',
  imports: [NavButtonComponent, CommonModule, FormsModule, ButtonComponent, InputComponent, IrpwRepertoireEditorComponent],
  templateUrl: './irpw-specie-config.component.html',
  styleUrl: './irpw-specie-config.component.css',
})
export class IrpwSpecieConfigComponent implements OnInit {
  dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  data = inject<{ id: string }>(DIALOG_DATA);
  private irpwSpecieService = inject(IrpwSpecieService);
  private entityChangeService = inject(EntityChangeService);

  currentConfig: IrpwSpecie = new IrpwSpecie();
  isSaving = false;
  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 600);

  readonly editorTab = signal<'base' | 'passives' | 'weaknesses'>('base');
  updatePassives(abilities: IrpwSpecieHability[]): void { this.passiveData = abilities; this.onPassiveChange(); }
  updateWeaknesses(abilities: IrpwSpecieHability[]): void { this.weaknessData = abilities; this.onWeaknessChange(); }

  perceptionsData: IrpwSpeciePerceptions = { smell: null, vision: null, hearing: null };
  passiveData: IrpwSpecieHability[] = [];
  weaknessData: IrpwSpecieHability[] = [];
  baseHealthValue: number | null = null;

  ngOnInit() {
    const specieId = this.data?.id || '';
    this.currentConfig = this.irpwSpecieService.getConfig(specieId) ?? new IrpwSpecie(specieId);
    this.parseConfig();
  }

  addWeakness() {
    this.weaknessData = [...this.weaknessData, this.createEmptyHability()];
    this.onWeaknessChange();
  }

  removeWeakness(index: number) {
    this.weaknessData = this.weaknessData.filter((_, currentIndex) => currentIndex !== index);
    this.onWeaknessChange();
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
      .map((passive, index) => this.normalizeHability(passive, `species:${this.currentConfig.id}:passive:${index}`))
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
    const normalizedWeaknesses = this.weaknessData
      .map((weakness, index) => this.normalizeHability(weakness, `species:${this.currentConfig.id}:weakness:${index}`))
      .filter((weakness): weakness is IrpwSpecieHability => weakness != null);

    this.currentConfig.weakness = normalizedWeaknesses.length ? JSON.stringify(normalizedWeaknesses) : null;
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
    this.passiveData = this.parsePassiveList(this.currentConfig.passive, 'passive');
    this.weaknessData = this.parsePassiveList(this.currentConfig.weakness, 'weakness');
  }

  private parsePassiveList(rawValue: string | null | undefined, source: 'passive' | 'weakness'): IrpwSpecieHability[] {
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue);

      if (Array.isArray(parsed)) {
        return parsed
          .map((item, index) => this.normalizeHability(item, `species:${this.currentConfig.id}:${source}:${index}`))
          .filter((item): item is IrpwSpecieHability => item != null);
      }

      const singlePassive = this.normalizeHability(parsed, `species:${this.currentConfig.id}:${source}:0`);
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

  private normalizeHability(value: unknown, fallbackId: string = crypto.randomUUID()): IrpwSpecieHability | null {
    if (!value || typeof value !== 'object') return null;

    const source = value as Partial<IrpwSpecieHability>;
    const description = (source.description || '').trim();
    const name = (source.name || '').trim();

    if (!description && !name) return null;

    return {
      id: source.id?.trim() || fallbackId,
      ...(name ? { name } : {}),
      description,
    };
  }

  private createEmptyHability(): IrpwSpecieHability {
    return { id: crypto.randomUUID(), name: null, description: '' };
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
    this.isSaving = true;
    this.saveTask.schedule(() => {
      this.persistConfig();
    });
  }

  private persistConfig() {

    if (!this.currentConfig.id) {
      this.isSaving = false;
      return;
    }

    this.currentConfig = this.irpwSpecieService.saveConfig(this.currentConfig.id, this.currentConfig);
    this.entityChangeService.notifySave('IRPWSpecie', this.currentConfig.id);
    this.isSaving = false;
  }
}
