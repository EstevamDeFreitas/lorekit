import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import {
  ATTRIBUTE_GROUP_LABEL,
  ATTRIBUTE_GROUP_SKILLS,
  AttributeGroupCode,
  SKILL_LABEL,
  SkillCode,
} from '../../../models/irpw-attributes-skills.model';
import {
  CONDITION_CATEGORY,
  CONDITION_CATEGORY_LABEL,
  CONDITION_SEVERITY,
  CONDITION_SEVERITY_LABEL,
  ConditionCategoryCode,
  ConditionDefinition,
  ConditionSeverityCode,
} from '../../../models/irpw-conditions.model';
import { IrpwConditionCatalogService } from '../../../services/irpw-condition-catalog.service';

type ImpactMode = 'none' | 'modifier' | 'minus-dice' | 'disadvantage';

interface EditableSeverity {
  enabled: boolean;
  label: string;
  description: string;
  targets: string[];
  mode: ImpactMode;
  value: number;
}

interface ConditionDraft {
  code: string;
  label: string;
  category: ConditionCategoryCode;
  description: string;
  effects: Record<ConditionSeverityCode, EditableSeverity>;
}

@Component({
  selector: 'irpw-conditions',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="condition-catalog">
      <header class="condition-catalog__header">
        <div>
          <h2>Condições</h2>
          <p>Edite efeitos e alcance das condições usadas nas fichas.</p>
        </div>
        <button type="button" class="condition-catalog__close" (click)="close()" aria-label="Fechar">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="condition-catalog__layout">
        <nav class="condition-catalog__list" aria-label="Catálogo de condições">
          <button type="button" class="condition-catalog__new" (click)="createCondition()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            Nova condição
          </button>
          @for (definition of definitions; track definition.code) {
            <button type="button"
              class="condition-catalog__item"
              [class.is-active]="draft?.code === definition.code"
              (click)="selectCondition(definition)">
              <span>{{ definition.label }}</span>
              <small>{{ categoryLabel[definition.category] }}</small>
            </button>
          }
        </nav>

        @if (draft; as condition) {
          <div class="condition-catalog__editor">
            <div class="condition-catalog__identity">
              <label>
                Nome
                <input type="text" [(ngModel)]="condition.label" maxlength="80" placeholder="Ex.: Desorientado">
              </label>
              <label>
                Categoria
                <select [(ngModel)]="condition.category">
                  @for (category of categories; track category) {
                    <option [ngValue]="category">{{ categoryLabel[category] }}</option>
                  }
                </select>
              </label>
              <label class="condition-catalog__description">
                Resumo
                <textarea [(ngModel)]="condition.description" rows="2" placeholder="Descreva a condição."></textarea>
              </label>
            </div>

            <div class="condition-catalog__effect-heading">
              <div>
                <h3>Efeito nas rolagens</h3>
                <p>Escolha a intensidade e as perícias afetadas em cada severidade.</p>
              </div>
            </div>

            <div class="condition-catalog__severities">
              @for (severity of severityOptions; track severity.code) {
                @let effect = condition.effects[severity.code];
                <section class="condition-catalog__severity" [class.is-disabled]="!effect.enabled">
                  <div class="condition-catalog__severity-heading">
                    <label class="condition-catalog__toggle">
                      <input type="checkbox" [(ngModel)]="effect.enabled">
                      <span>{{ severity.label }}</span>
                    </label>
                  </div>

                  @if (effect.enabled) {
                    <label class="condition-catalog__field">
                      Descrição do efeito
                      <input type="text" [(ngModel)]="effect.description" placeholder="Ex.: Penalidade em testes de precisão">
                    </label>

                    <label class="condition-catalog__field">
                      Impacto
                      <select [(ngModel)]="effect.mode">
                        @for (mode of impactModes; track mode.value) {
                          <option [ngValue]="mode.value">{{ mode.label }}</option>
                        }
                      </select>
                    </label>
                    @if (effect.mode === 'modifier') {
                      <p class="condition-catalog__hint">Valor positivo dá bônus; valor negativo aplica penalidade.</p>
                    }

                    @if (effect.mode === 'modifier' || effect.mode === 'minus-dice') {
                      <label class="condition-catalog__field condition-catalog__value">
                        {{ effect.mode === 'modifier' ? 'Modificador' : 'Dados removidos' }}
                        <input type="number" [min]="effect.mode === 'modifier' ? -99 : 1" [max]="effect.mode === 'modifier' ? 99 : 10" step="1" [(ngModel)]="effect.value">
                      </label>
                    }

                    @if (effect.mode !== 'none') {
                      <div class="condition-catalog__targets">
                        <span class="condition-catalog__targets-label">Perícias e testes afetados</span>
                        @for (group of attributeGroups; track group) {
                          <fieldset>
                            <legend>{{ groupLabel[group] }}</legend>
                            <div class="condition-catalog__skills">
                              @for (skill of skillsByGroup[group]; track skill) {
                                <label>
                                  <input type="checkbox"
                                    [checked]="effect.targets.includes(skill)"
                                    (change)="toggleTarget(effect, skill, $any($event.target).checked)">
                                  <span>{{ skillLabel[skill] }}</span>
                                </label>
                              }
                            </div>
                          </fieldset>
                        }
                        <fieldset>
                          <legend>Outros testes</legend>
                          <div class="condition-catalog__skills">
                            @for (target of specialTargets; track target.code) {
                              <label>
                                <input type="checkbox"
                                  [checked]="effect.targets.includes(target.code)"
                                  (change)="toggleTarget(effect, target.code, $any($event.target).checked)">
                                <span>{{ target.label }}</span>
                              </label>
                            }
                          </div>
                        </fieldset>
                      </div>
                    }
                  }
                </section>
              }
            </div>

            <footer class="condition-catalog__footer">
              <span class="condition-catalog__code">Código: {{ condition.code }}</span>
              <div>
                <button type="button" class="condition-catalog__cancel" (click)="close()">Cancelar</button>
                <button type="button" class="condition-catalog__save" [disabled]="!condition.label.trim()" (click)="save()">Salvar condições</button>
              </div>
            </footer>
          </div>
        } @else {
          <div class="condition-catalog__empty">Selecione uma condição ou crie uma nova.</div>
        }
      </div>
    </section>
  `,
  styleUrl: './irpw-conditions.component.css',
})
export class IrpwConditionsComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly catalog = inject(IrpwConditionCatalogService);

  definitions = this.catalog.getDefinitions();
  readonly categories = Object.values(CONDITION_CATEGORY) as ConditionCategoryCode[];
  readonly categoryLabel = CONDITION_CATEGORY_LABEL;
  readonly severityOptions = [
    { code: CONDITION_SEVERITY.LIGHT, label: CONDITION_SEVERITY_LABEL.LIGHT },
    { code: CONDITION_SEVERITY.MODERATE, label: CONDITION_SEVERITY_LABEL.MODERATE },
    { code: CONDITION_SEVERITY.SEVERE, label: CONDITION_SEVERITY_LABEL.SEVERE },
  ] as const;
  draft: ConditionDraft | null = this.definitions[0] ? this.toDraft(this.definitions[0]) : null;
  readonly impactModes: { value: ImpactMode; label: string }[] = [
    { value: 'none', label: 'Sem modificador de rolagem' },
    { value: 'modifier', label: 'Bônus ou penalidade fixa' },
    { value: 'minus-dice', label: 'Remover dados d10' },
    { value: 'disadvantage', label: 'Desvantagem' },
  ];
  readonly attributeGroups = Object.keys(ATTRIBUTE_GROUP_SKILLS) as AttributeGroupCode[];
  readonly skillsByGroup = ATTRIBUTE_GROUP_SKILLS;
  readonly groupLabel = ATTRIBUTE_GROUP_LABEL;
  readonly skillLabel = SKILL_LABEL;
  readonly specialTargets = [
    { code: 'PERCEPTION', label: 'Percepção' },
    { code: 'CONJURATION', label: 'Conjuração' },
    { code: 'MOVEMENT', label: 'Movimento' },
    { code: 'EXHAUSTION', label: 'Ações prolongadas' },
  ];

  selectCondition(definition: ConditionDefinition): void {
    this.commitDraftToList();
    this.draft = this.toDraft(definition);
  }

  createCondition(): void {
    this.commitDraftToList();
    const code = this.createCode('NOVA_CONDICAO');
    this.draft = {
      code,
      label: 'Nova condição',
      category: CONDITION_CATEGORY.SPECIAL,
      description: '',
      effects: {
        LIGHT: this.emptySeverity(true),
        MODERATE: this.emptySeverity(false),
        SEVERE: this.emptySeverity(false),
      },
    };
  }

  toggleTarget(effect: EditableSeverity, target: SkillCode | string, checked: boolean): void {
    effect.targets = checked
      ? [...new Set([...effect.targets, target])]
      : effect.targets.filter(value => value !== target);
  }

  save(): void {
    this.commitDraftToList();
    this.catalog.saveDefinitions(this.definitions);
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(false);
  }

  private commitDraftToList(): void {
    if (!this.draft) return;
    const saved = this.fromDraft(this.draft);
    const existingIndex = this.definitions.findIndex(definition => definition.code === saved.code);
    if (existingIndex === -1) this.definitions = [...this.definitions, saved];
    else this.definitions = this.definitions.map((definition, index) => index === existingIndex ? saved : definition);
  }

  private toDraft(definition: ConditionDefinition): ConditionDraft {
    const severities = {} as Record<ConditionSeverityCode, EditableSeverity>;
    for (const severity of this.severityOptions) {
      const effect = definition.effects?.[severity.code];
      const rawEntries = effect?.conditionEffect
        ? (Array.isArray(effect.conditionEffect) ? effect.conditionEffect : [effect.conditionEffect])
        : [];
      const parsedEntries = rawEntries.map(entry => this.parseEffect(entry));
      const firstImpact = parsedEntries.find(entry => entry.mode !== 'none');
      severities[severity.code] = {
        enabled: !!effect,
        label: effect?.label ?? severity.label,
        description: effect?.description ?? '',
        targets: [...new Set(parsedEntries.flatMap(entry => entry.targets))],
        mode: firstImpact?.mode ?? 'none',
        value: firstImpact?.value ?? 2,
      };
    }

    return {
      code: definition.code,
      label: definition.label,
      category: definition.category,
      description: definition.description ?? '',
      effects: severities,
    };
  }

  private fromDraft(draft: ConditionDraft): ConditionDefinition {
    const effects: NonNullable<ConditionDefinition['effects']> = {};
    for (const severity of this.severityOptions) {
      const effect = draft.effects[severity.code];
      if (!effect.enabled) continue;
      const impact = this.serializeImpact(effect);
      effects[severity.code] = {
        label: severity.label,
        description: effect.description.trim(),
        ...(impact.length ? { conditionEffect: impact } : {}),
      };
    }

    return {
      code: draft.code,
      label: draft.label.trim(),
      category: draft.category,
      description: draft.description.trim() || undefined,
      ...(Object.keys(effects).length ? { effects } : {}),
    };
  }

  private serializeImpact(effect: EditableSeverity): string[] {
    if (effect.mode === 'none' || effect.targets.length === 0) return [];
    let value = '';
    if (effect.mode === 'modifier') {
      const amount = Math.max(-99, Math.min(99, Math.trunc(Number(effect.value) || 0)));
      value = `${amount}`;
      if (amount === 0) return [];
    } else if (effect.mode === 'minus-dice') {
      const amount = Math.max(1, Math.min(10, Math.trunc(Math.abs(Number(effect.value) || 1))));
      value = `MINUS ${amount}d10`;
    } else {
      value = 'DISADVANTAGE';
    }
    return effect.targets.map(target => `${target}:${value}`);
  }

  private parseEffect(raw: string): { targets: string[]; mode: ImpactMode; value: number } {
    const separator = raw.indexOf(':');
    if (separator === -1) return { targets: [], mode: 'none', value: 2 };
    const rawTarget = raw.slice(0, separator).trim().toUpperCase();
    const rawValue = raw.slice(separator + 1).trim().toUpperCase();
    const groupSkills = ATTRIBUTE_GROUP_SKILLS[rawTarget as AttributeGroupCode];
    const targets = groupSkills ? [...groupSkills] : [rawTarget];
    if (/^-?\d+$/.test(rawValue)) return { targets, mode: 'modifier', value: Number(rawValue) };
    const dice = rawValue.match(/^MINUS\s+(\d+)D10$/);
    if (dice) return { targets, mode: 'minus-dice', value: Number(dice[1]) };
    if (rawValue === 'DISADVANTAGE') return { targets, mode: 'disadvantage', value: 2 };
    return { targets, mode: 'none', value: 2 };
  }

  private emptySeverity(enabled: boolean): EditableSeverity {
    return { enabled, label: '', description: '', targets: [], mode: 'none', value: 2 };
  }

  private createCode(base: string): string {
    const normalized = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'CONDICAO';
    let code = `CUSTOM_${normalized}`;
    let suffix = 2;
    while (this.definitions.some(definition => definition.code === code) || this.draft?.code === code) {
      code = `CUSTOM_${normalized}_${suffix++}`;
    }
    return code;
  }
}
