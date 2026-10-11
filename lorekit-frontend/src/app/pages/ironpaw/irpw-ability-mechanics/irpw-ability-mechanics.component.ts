import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { abilityCost, abilityGrades, abilitySummary, MAGIC_GRADES, REMODELING_KINDS } from '../../../models/irpw-ability.model';
import { IrpwVocationHability, IrpwSpellRemodeling } from '../../../models/irpw-vocation.model';

@Component({
  selector: 'irpw-ability-mechanics',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './irpw-ability-mechanics.component.html',
  styleUrl: './irpw-ability-mechanics.component.css',
})
export class IrpwAbilityMechanicsComponent {
  readonly ability = input.required<IrpwVocationHability>();
  readonly readonly = input(false);
  readonly changed = output<void>();
  readonly kinds = REMODELING_KINDS;
  readonly summary = abilitySummary;
  readonly cost = abilityCost;
  readonly grades = abilityGrades;
  setGrade(value: string): void {
    const ability = this.ability();
    ability.grade = value;
    ability.cost = abilityGrades(ability).find(g => g.value === value)?.cost ?? 0;
    this.changed.emit();
  }
  setSpellKind(value: 'key' | 'trick'): void {
    const ability = this.ability();
    ability.spellKind = value;
    if (value === 'trick') { ability.cost = 0; ability.grade = null; ability.variations = []; ability.remodelings = []; }
    else this.setGrade('minor');
    this.changed.emit();
  }
  addVariation(): void {
    const ability = this.ability();
    const grade = abilityGrades(ability).find(g => !ability.variations?.some(v => v.grade === g.value));
    if (!grade) return;
    ability.variations = [...(ability.variations ?? []), { grade: grade.value, cost: grade.cost, description: '' }];
    this.changed.emit();
  }
  setVariationGrade(index: number, value: string): void {
    const variation = this.ability().variations?.[index];
    if (!variation) return;
    variation.grade = value;
    variation.cost = abilityGrades(this.ability()).find(g => g.value === value)?.cost ?? 0;
    this.changed.emit();
  }
  removeVariation(index: number): void { this.ability().variations = this.ability().variations?.filter((_, i) => i !== index); this.changed.emit(); }
  addRemodeling(): void {
    const ability = this.ability();
    ability.remodelings = [...(ability.remodelings ?? []), { id: crypto.randomUUID(), name: '', kind: 'empower', grade: ability.grade ?? 'minor', description: '' }];
    this.changed.emit();
  }
  changeRemodeling(remodeling: IrpwSpellRemodeling): void {
    if (remodeling.kind === 'potential' && remodeling.grade === 'minor') remodeling.grade = 'medium';
    this.changed.emit();
  }
  removeRemodeling(index: number): void { this.ability().remodelings = this.ability().remodelings?.filter((_, i) => i !== index); this.changed.emit(); }
  remodelingGrades(remodeling: IrpwSpellRemodeling) { return MAGIC_GRADES.filter(g => remodeling.kind !== 'potential' || g.value !== 'minor'); }
  remodelingCost(remodeling: IrpwSpellRemodeling): number {
    const base = this.ability().variations?.find(v => v.grade === remodeling.grade)?.cost ?? (this.ability().grade === remodeling.grade ? abilityCost(this.ability()) : MAGIC_GRADES.find(g => g.value === remodeling.grade)?.cost ?? 2);
    return base + (this.kinds.find(k => k.value === remodeling.kind)?.cost ?? 1);
  }
  gradeLabel(value: string): string { return abilityGrades(this.ability()).find(g => g.value === value)?.label ?? value; }
  kindLabel(remodeling: IrpwSpellRemodeling): string { return this.kinds.find(k => k.value === remodeling.kind)?.label ?? ''; }
}
