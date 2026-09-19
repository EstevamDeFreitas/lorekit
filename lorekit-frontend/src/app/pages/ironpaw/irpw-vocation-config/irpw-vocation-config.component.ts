import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { ATTRIBUTE_GROUP_LABEL, ATTRIBUTE_GROUP_SKILLS, AttributeGroupCode, SkillCode, SKILL_LABEL } from '../../../models/irpw-attributes-skills.model';
import { createDefaultVocationSkills, IrpwVocationSkills, parseVocationSkills, serializeVocationSkills } from '../../../models/irpw-rules.model';
import { IrpwVocation, IrpwVocationHability } from '../../../models/irpw-vocation.model';
import { EntityChangeService } from '../../../services/entity-change.service';
import { IrpwVocationService } from '../../../services/irpw-vocation.service';

@Component({
  selector: 'irpw-vocation-config',
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent, TextAreaComponent],
  template: `
    <div class="w-full h-full min-h-0 box-border overflow-y-auto scrollbar-dark bg-zinc-950 p-5 text-white">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-semibold">Configuração IRPW da Vocação</h2>
          <p class="text-xs text-zinc-500">Configure poderes, vida base, defesa base e as perícias mínimas.</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3 col-span-2">
          <div class="grid grid-cols-2 gap-3">
            <app-input label="Nome" [(value)]="currentVocation.name"></app-input>
            <app-input label="Vida base" type="number" [(value)]="baseHealthValue"></app-input>
            <app-input label="Defesa base" type="number" [(value)]="baseDefenseValue"></app-input>
            <div></div>
            <div class="col-span-2">
              <app-text-area label="Descrição" height="h-24" [(value)]="currentVocation.description"></app-text-area>
            </div>
          </div>
        </div>

        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Passiva</h3>
          </div>
          <div class="flex flex-col gap-3">
            <app-input label="Nome" [(value)]="passiveData.name"></app-input>
            <app-text-area label="Descrição" height="h-32" [(value)]="passiveData.description"></app-text-area>
          </div>
        </div>

        <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Poderes</h3>
            <app-button label="Adicionar" buttonType="secondary" size="xs" (click)="addHability()"></app-button>
          </div>
          <div class="flex flex-col gap-3">
            @for (hability of habilitiesData; track $index) {
              <div class="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="text-xs text-zinc-300">Poder {{ $index + 1 }}</span>
                  <app-button label="Remover" buttonType="danger" size="xs" (click)="removeHability($index)"></app-button>
                </div>
                <div class="flex flex-col gap-2">
                  <app-input label="Nome" [(value)]="hability.name"></app-input>
                  <app-text-area label="Descrição" height="h-24" [(value)]="hability.description"></app-text-area>
                </div>
              </div>
            }
            @if (habilitiesData.length === 0) {
              <span class="text-xs text-zinc-500">Nenhum poder cadastrado.</span>
            }
          </div>
        </div>
      </div>

      <div class="rounded-md border border-zinc-800 bg-zinc-925 p-3 mt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Perícias mínimas</h3>
        <div class="grid grid-cols-2 gap-4">
          @for (entry of attributeGroupEntries; track entry[0]) {
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-zinc-200 mb-2">{{ attributeGroupLabel[entry[0]] }}</div>
              <div class="flex flex-col gap-1.5">
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

      <div class="mt-4 flex justify-end gap-2">
        <app-button label="Fechar" buttonType="secondary" size="sm" (click)="close()"></app-button>
        <app-button label="Salvar" size="sm" (click)="saveNow()"></app-button>
      </div>
    </div>
  `,
})
export class IrpwVocationConfigComponent implements OnInit {
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<{ id: string }>(DIALOG_DATA);
  private readonly vocationService = inject(IrpwVocationService);
  private readonly entityChangeService = inject(EntityChangeService);

  currentVocation: IrpwVocation = new IrpwVocation();
  baseHealthValue: number | null = null;
  baseDefenseValue: number | null = null;
  passiveData: IrpwVocationHability = this.createEmptyHability();
  habilitiesData: IrpwVocationHability[] = [];
  attributesData: IrpwVocationSkills = createDefaultVocationSkills();

  readonly attributeGroupEntries = Object.entries(ATTRIBUTE_GROUP_SKILLS) as [AttributeGroupCode, SkillCode[]][];
  readonly attributeGroupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly skillLabel = SKILL_LABEL;

  ngOnInit(): void {
    const vocationId = this.data?.id || '';
    this.currentVocation = this.vocationService.getVocation(vocationId) ?? new IrpwVocation(vocationId);
    this.baseHealthValue = this.parseInteger(this.currentVocation.basehealth);
    this.baseDefenseValue = this.parseInteger(this.currentVocation.basedefense);
    this.passiveData = this.parseHability(this.currentVocation.passive);
    this.habilitiesData = this.parseHabilities(this.currentVocation.habilities);
    this.attributesData = parseVocationSkills(this.currentVocation.attributes);
  }

  addHability(): void {
    this.habilitiesData = [...this.habilitiesData, this.createEmptyHability()];
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
    return ['Sem habilidade', 'Treinado', 'Intermediario', 'Mestre'][this.normalizeSkillLevel(level)];
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
      return Array.isArray(parsed) ? parsed.map(item => this.normalizeHability(item)).filter((item): item is IrpwVocationHability => item != null) : [];
    } catch {
      return [];
    }
  }

  private parseHability(rawValue: string | null | undefined): IrpwVocationHability {
    if (!rawValue) return this.createEmptyHability();
    try {
      return this.normalizeHability(JSON.parse(rawValue)) ?? this.createEmptyHability();
    } catch {
      return this.createEmptyHability();
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

  private normalizeHability(value: unknown): IrpwVocationHability | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Partial<IrpwVocationHability>;
    const name = (source.name || '').trim();
    const description = (source.description || '').trim();
    if (!name && !description) return null;
    return { ...(name ? { name } : {}), description };
  }

  private createEmptyHability(): IrpwVocationHability {
    return { name: null, description: '' };
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
