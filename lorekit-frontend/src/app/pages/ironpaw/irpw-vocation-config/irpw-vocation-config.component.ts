import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { ATTRIBUTE_GROUP_LABEL, ATTRIBUTE_GROUP_ICON, ATTRIBUTE_GROUP_SKILLS, AttributeGroupCode, SkillCode, SKILL_LABEL } from '../../../models/irpw-attributes-skills.model';
import { createDefaultVocationSkills, IrpwVocationSkills, parseVocationSkills, serializeVocationSkills } from '../../../models/irpw-rules.model';
import { IrpwHabilityType, IrpwVocation, IrpwVocationHability } from '../../../models/irpw-vocation.model';
import { IrpwRepertoireEditorComponent } from '../irpw-repertoire-editor/irpw-repertoire-editor.component';
import { normalizeAbilityMechanics, changeAbilityType } from '../../../models/irpw-ability.model';
import { EntityChangeService } from '../../../services/entity-change.service';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';

@Component({
  selector: 'irpw-vocation-config',
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent, TextAreaComponent, IrpwRepertoireEditorComponent],
  templateUrl: './irpw-vocation-config.component.html',
  styleUrl: './irpw-vocation-config.component.css',
})
export class IrpwVocationConfigComponent implements OnInit {
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<{ id: string }>(DIALOG_DATA);
  private readonly vocationService = inject(IrpwVocationService);
  private readonly entityChangeService = inject(EntityChangeService);

  currentVocation: IrpwVocation = new IrpwVocation();
  readonly editorTab = signal<'base' | 'attributes' | 'repertoire'>('base');
  updateRepertoire(abilities: IrpwVocationHability[]): void {
    this.habilitiesData = abilities;
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
  readonly habilityTypeOptions: { value: IrpwHabilityType; label: string }[] = [
    { value: 'technical', label: 'Poder' },
    { value: 'magic', label: 'Magia' },
    { value: 'passive', label: 'Passiva' },
  ];
  readonly skillShortcutOptions = Object.entries(SKILL_LABEL).map(([id, name]) => ({ id: id as SkillCode, name }));

  ngOnInit(): void {
    const vocationId = this.data?.id || '';
    this.currentVocation = this.vocationService.getVocation(vocationId) ?? new IrpwVocation(vocationId);
    this.baseHealthValue = this.parseInteger(this.currentVocation.basehealth);
    this.baseDefenseValue = this.parseInteger(this.currentVocation.basedefense);
    this.passiveData = this.parseHability(this.currentVocation.passive, `vocation:${vocationId}:passive`, 'passive');
    this.habilitiesData = this.parseHabilities(this.currentVocation.habilities);
    this.attributesData = parseVocationSkills(this.currentVocation.attributes);
  }

  getHabilityLabel(type: IrpwHabilityType | undefined): string { return this.habilityTypeOptions.find(kind => kind.value === type)?.label ?? 'Poder'; }

  addHability(type: IrpwHabilityType = 'technical'): void {
    this.habilitiesData = [...this.habilitiesData, { ...this.createEmptyHability(), type, ...(type === 'magic' ? { rollSkill: 'CONJURATION' as SkillCode } : {}) }];
  }

  setHabilityType(index: number, type: IrpwHabilityType): void {
    this.habilitiesData = this.habilitiesData.map((ability, i) => i === index ? changeAbilityType(ability, type) : ability);

  }

  removeHability(index: number): void {
    this.habilitiesData = this.habilitiesData.filter((_, currentIndex) => currentIndex !== index);
  }

  getSkillLevel(group: string, skill: string): number {
    return this.normalizeSkillLevel(this.attributesData[group as AttributeGroupCode]?.skills[skill as SkillCode]);
  }

  onCircleClick(event: Event, group: string, skill: string, level: number): void {
    event.preventDefault();
    const current = this.getSkillLevel(group, skill);
    this.attributesData[group as AttributeGroupCode].skills[skill as SkillCode] = current === level ? 0 : this.normalizeSkillLevel(level);
  }

  getSkillLevelLabel(level: number): string {
    return ['Sem habilidade', 'Treinado', 'Intermediário', 'Mestre'][this.normalizeSkillLevel(level)];
  }

  saveNow(): void {
    this.currentVocation.basehealth = this.serializeInteger(this.baseHealthValue);
    this.currentVocation.basedefense = this.serializeInteger(this.baseDefenseValue);
    this.currentVocation.passive = this.serializeHability(this.passiveData);
    this.currentVocation.habilities = this.serializeHabilities(this.habilitiesData);
    this.currentVocation.attributes = serializeVocationSkills(this.attributesData);
    this.vocationService.saveVocation(this.currentVocation);
    this.entityChangeService.notifySave('IRPWVocation', this.currentVocation.id);
    this.close();
  }

  close(): void {
    this.dialogRef.close();
  }

  private parseHabilities(rawValue: string | null | undefined): IrpwVocationHability[] {
    if (!rawValue) return [];
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed.map((item, index) => this.normalizeHability(item, `vocation:${this.data?.id || 'new'}:power:${index}`, 'technical')).filter((item): item is IrpwVocationHability => item != null) : [];
    } catch {
      return [];
    }
  }

  private parseHability(rawValue: string | null | undefined, fallbackId: string, defaultType: IrpwHabilityType): IrpwVocationHability {
    if (!rawValue) return { ...this.createEmptyHability(), id: fallbackId, type: defaultType };
    try {
      return this.normalizeHability(JSON.parse(rawValue), fallbackId, defaultType) ?? { ...this.createEmptyHability(), id: fallbackId, type: defaultType };
    } catch {
      return { ...this.createEmptyHability(), id: fallbackId, type: defaultType };
    }
  }

  private serializeHabilities(value: IrpwVocationHability[]): string | null {
    const normalized = value.map(item => this.normalizeHability(item)).filter((item): item is IrpwVocationHability => item != null);
    return normalized.length ? JSON.stringify(normalized) : null;
  }

  private serializeHability(value: IrpwVocationHability): string | null {
    const normalized = this.normalizeHability(value);
    return normalized ? JSON.stringify(normalized) : null;
  }

  private normalizeHability(value: unknown, fallbackId: string = crypto.randomUUID(), defaultType: IrpwHabilityType = 'technical'): IrpwVocationHability | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Partial<IrpwVocationHability>;
    const name = (source.name || '').trim();
    const description = (source.description || '').trim();
    if (!name && !description) return null;
    const validType = ['technical', 'magic', 'passive'].includes(String(source.type)) ? source.type : defaultType;
    const rollSkill = source.rollSkill && Object.hasOwn(SKILL_LABEL, source.rollSkill) ? source.rollSkill : null;
    return { id: source.id?.trim() || fallbackId, ...(name ? { name } : {}), description, type: validType, rollSkill, ...normalizeAbilityMechanics({ ...source, description, type: validType }) };
  }

  private createEmptyHability(): IrpwVocationHability {
    return { id: crypto.randomUUID(), name: null, description: '', type: 'technical', rollSkill: null };
  }

  private parseInteger(value: string | null | undefined): number | null {
    if (value == null || value === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.trunc(numericValue) : null;
  }

  private serializeInteger(value: number | null | undefined): string | null {
    if (value == null) return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? `${Math.trunc(numericValue)}` : null;
  }

  private normalizeSkillLevel(value: number | null | undefined): number {
    if (value == null) return 0;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.min(3, Math.max(0, Math.trunc(numericValue))) : 0;
  }
}
