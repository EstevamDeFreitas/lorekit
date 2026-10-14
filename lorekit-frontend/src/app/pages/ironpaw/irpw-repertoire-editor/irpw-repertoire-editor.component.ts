import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { IrpwHabilityType, IrpwVocationHability } from '../../../models/irpw-vocation.model';
import { SKILL_LABEL, SkillCode } from '../../../models/irpw-attributes-skills.model';
import { abilitySummary, changeAbilityType } from '../../../models/irpw-ability.model';
import { IrpwAbilityMechanicsComponent } from '../irpw-ability-mechanics/irpw-ability-mechanics.component';

@Component({
  selector: 'irpw-repertoire-editor',
  imports: [FormsModule, InputComponent, TextAreaComponent, IrpwAbilityMechanicsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './irpw-repertoire-editor.component.html',
  styleUrl: './irpw-repertoire-editor.component.css',
})
export class IrpwRepertoireEditorComponent {
  readonly abilities = input.required<IrpwVocationHability[]>();
  readonly historyRead = input<(() => string) | null>(null);
  readonly mode = input<'abilities' | 'passives' | 'weaknesses'>('abilities');
  readonly changed = output<IrpwVocationHability[]>();
  readonly query = signal('');
  readonly filter = signal<IrpwHabilityType | 'all'>('all');
  readonly selectedId = signal<string | null>(null);
  readonly kinds = [{ value: 'technical', label: 'Poderes', singular: 'Poder', icon: 'fa-bolt' }, { value: 'magic', label: 'Magias', singular: 'Magia', icon: 'fa-book-sparkles' }, { value: 'passive', label: 'Passivas', singular: 'Passiva', icon: 'fa-leaf' }] as const;
  readonly skills = Object.entries(SKILL_LABEL).map(([id, name]) => ({ id: id as SkillCode, name }));
  readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('pt-BR');
    return this.abilities().filter(a => (this.filter() === 'all' || (a.type ?? 'technical') === this.filter()) && (!query || ((a.name ?? '') + ' ' + a.description).toLocaleLowerCase('pt-BR').includes(query)));
  });
  readonly selected = computed(() => this.visible().find(a => a.id === this.selectedId()) ?? this.visible()[0] ?? null);
  readonly summary = abilitySummary;
  label(ability: IrpwVocationHability): string { return this.mode() === 'weaknesses' ? 'Fraqueza' : this.mode() === 'passives' ? 'Passiva' : this.kinds.find(k => k.value === (ability.type ?? 'technical'))!.singular; }
  icon(ability: IrpwVocationHability): string { return this.mode() === 'weaknesses' ? 'fa-triangle-exclamation' : this.mode() === 'passives' ? 'fa-leaf' : this.kinds.find(k => k.value === (ability.type ?? 'technical'))!.icon; }
  count(type: IrpwHabilityType): number { return this.abilities().filter(a => (a.type ?? 'technical') === type).length; }
  setFilter(type: IrpwHabilityType | 'all'): void { this.filter.set(type); this.selectedId.set(null); }
  notify(): void { this.changed.emit([...this.abilities()]); }
  add(type: IrpwHabilityType = 'passive'): void {
    const ability: IrpwVocationHability = { id: crypto.randomUUID(), name: '', description: '', type, rollSkill: type === 'magic' ? 'CONJURATION' : null };
    this.query.set(''); this.filter.set('all'); this.selectedId.set(ability.id!);
    this.changed.emit([...this.abilities(), ability]);
  }
  duplicate(ability: IrpwVocationHability): void {
    const copy = { ...structuredClone(ability), id: crypto.randomUUID(), name: (ability.name || this.label(ability)) + ' — cópia' };
    this.query.set(''); this.filter.set('all'); this.selectedId.set(copy.id);
    this.changed.emit([...this.abilities(), copy]);
  }
  remove(ability: IrpwVocationHability): void { this.selectedId.set(null); this.changed.emit(this.abilities().filter(a => a !== ability)); }
  setType(ability: IrpwVocationHability, type: IrpwHabilityType): void { this.changed.emit(this.abilities().map(a => a === ability ? changeAbilityType(a, type) : a)); }
}
