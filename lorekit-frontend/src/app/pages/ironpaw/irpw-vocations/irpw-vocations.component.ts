import { IrpwRepertoireEditorComponent } from '../irpw-repertoire-editor/irpw-repertoire-editor.component';
import { normalizeAbilityMechanics, changeAbilityType } from '../../../models/irpw-ability.model';
import { IrpwHabilityType } from '../../../models/irpw-vocation.model';
import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { CommonModule, NgClass } from '@angular/common';
import { inject, DestroyRef, Component, effect, input, signal, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { FormsModule } from '@angular/forms';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import {
  ATTRIBUTE_GROUP_LABEL, ATTRIBUTE_GROUP_ICON,
  ATTRIBUTE_GROUP_SKILLS,
  SKILL_LABEL,
  AttributeGroupCode,
  SkillCode,
} from '../../../models/irpw-attributes-skills.model';
import {
  IrpwVocation,
  IrpwVocationHability,
} from '../../../models/irpw-vocation.model';
import { createDefaultVocationSkills, IrpwVocationSkills, parseVocationSkills, serializeVocationSkills } from '../../../models/irpw-rules.model';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { EntityChangeService } from '../../../services/entity-change.service';
import { getPersonalizationValue, getTextColorStyle } from '../../../models/personalization.model';

@Component({
  selector: 'irpw-vocations',
  imports: [EntityHistoryContextDirective, CommonModule, NgClass, FormsModule, InputComponent, TextAreaComponent, SafeDeleteButtonComponent, PersonalizationButtonComponent, IconButtonComponent, FormOverlayDirective, IrpwRepertoireEditorComponent],
  templateUrl: './irpw-vocations.component.html',
  styleUrl: './irpw-vocations.component.css',
})
export class IrpwVocationsComponent implements OnInit, OnDestroy {
  readonly readPassiveHistory = (): string => this.currentVocation?.passive || '';
  readonly readHabilitiesHistory = (): string => this.currentVocation?.habilities || '';
  restoreVocationHistory(): void { this.parseSelectedVocation(); }
  private readonly destroyRef = inject(DestroyRef);
  private vocationService = inject(IrpwVocationService);
  private entityChangeService = inject(EntityChangeService);

  vocationIdInput = input<string>('');

  private syncInputSelectionEffect = effect(() => {
    const vocationId = this.vocationIdInput().trim();
    if (!vocationId || vocationId === this.selectedVocationId) {
      return;
    }

    this.selectVocation(vocationId, true);
  });

  vocations: IrpwVocation[] = [];
  filteredVocations: IrpwVocation[] = [];
  currentVocation: IrpwVocation | null = null;
  selectedVocationId = '';
  searchTerm = '';
  showSidebar = true;
  isSaving = false;
  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 600);

  readonly editorTab = signal<'base' | 'attributes' | 'repertoire'>('base');
  updateRepertoire(abilities: IrpwVocationHability[]): void {
    this.habilitiesData = abilities;
    this.onHabilitiesChange();
  }

  baseHealthValue: number | null = null;
  baseDefenseValue: number | null = null;
  passiveData: IrpwVocationHability = this.createEmptyHability();
  habilitiesData: IrpwVocationHability[] = [];
  attributesData: IrpwVocationSkills = createDefaultVocationSkills();

  readonly attributeGroupEntries = Object.entries(ATTRIBUTE_GROUP_SKILLS) as [AttributeGroupCode, SkillCode[]][];
  readonly attributeGroupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly attributeGroupIcon = ATTRIBUTE_GROUP_ICON;
  readonly skillLabel = SKILL_LABEL;
  public getPersonalizationValue = getPersonalizationValue;
  public getTextColorStyle = getTextColorStyle;

  ngOnInit() {
    this.loadVocations();

    const initialVocationId = this.vocationIdInput();
    if (initialVocationId) {
      this.selectVocation(initialVocationId, true);
    }

    this.entityChangeService.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.table === 'IRPWVocation' || event.table === 'Personalization') {
        const selectedId = this.vocationIdInput() || this.selectedVocationId;
        this.loadVocations();

        if (selectedId) {
          this.selectVocation(selectedId, true);
        }
      }
    });
  }

  ngOnDestroy() {
    this.flushPendingSave();
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

  selectVocation(vocationId: string, force = false) {
    if (!force && this.selectedVocationId === vocationId) {
      return;
    }

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

  readonly habilityTypeOptions = [{ value: 'technical', label: 'Poder' }, { value: 'magic', label: 'Magia' }, { value: 'passive', label: 'Passiva' }];
  readonly skillShortcutOptions = Object.entries(SKILL_LABEL).map(([id, name]) => ({ id: id as SkillCode, name }));

  addHability(type: IrpwHabilityType = 'technical') {
    this.habilitiesData = [...this.habilitiesData, { ...this.createEmptyHability(), type, rollSkill: type === 'magic' ? 'CONJURATION' : null }];
    this.onHabilitiesChange();
  }

  setHabilityType(index: number, type: IrpwHabilityType): void {
    this.habilitiesData = this.habilitiesData.map((ability, i) => i === index ? changeAbilityType(ability, type) : ability);
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

    this.currentVocation.attributes = serializeVocationSkills(this.attributesData);
    this.scheduleAutoSave();
  }

  getSkillLevel(group: string, skill: string): number {
    return this.normalizeSkillLevel(this.attributesData[group as AttributeGroupCode]?.skills[skill as SkillCode]);
  }

  onCircleClick(event: Event, group: string, skill: string, level: number) {
    event.preventDefault();
    const currentLevel = this.getSkillLevel(group, skill);
    this.attributesData[group as AttributeGroupCode].skills[skill as SkillCode] = currentLevel === level ? 0 : this.normalizeSkillLevel(level);
    this.onAttributesChange();
  }

  getSkillLevelLabel(level: number): string {
    return ['Sem habilidade', 'Treinado', 'Intermediário', 'Mestre'][this.normalizeSkillLevel(level)];
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
    this.attributesData = createDefaultVocationSkills();
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
      id: source.id || crypto.randomUUID(),
      ...(name ? { name } : {}),
      description,
      type: source.type || 'technical',
      rollSkill: source.rollSkill && Object.hasOwn(SKILL_LABEL, source.rollSkill) ? source.rollSkill : null,
      ...normalizeAbilityMechanics({ ...source, description, type: source.type || 'technical' }),
    };
  }

  private parseAttributes(rawValue: string | null | undefined): IrpwVocationSkills {
    return parseVocationSkills(rawValue);
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


  private normalizeSkillLevel(value: number | null | undefined): number {
    if (value == null) return 0;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.min(3, Math.max(0, Math.trunc(numericValue)));
  }

  private createEmptyHability(): IrpwVocationHability {
    return { id: crypto.randomUUID(), name: null, description: '', type: 'technical', rollSkill: null };
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
    this.saveTask.flush();
  }

  private scheduleAutoSave() {
    if (!this.currentVocation) return;

    this.isSaving = true;
    this.saveTask.schedule(() => {
      this.persistCurrentVocation();
    });
  }

  private persistCurrentVocation() {
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
