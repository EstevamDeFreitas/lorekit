import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarLayoutAssociation, UiFieldLayoutImportPlan, UiFieldLayoutPortabilityService } from '../../services/ui-field-layout-portability.service';
import { CalendarService } from '../../services/calendar.service';
import { WorldService } from '../../services/world.service';
import { PortableCalendarReference } from '../../models/ui-field-config.model';
import { calendarRuleDifferences } from '../../utils/calendar-portability';

@Component({ selector: 'app-calendar-layout-associations', imports: [FormsModule], templateUrl: './calendar-layout-associations.component.html', styleUrls: ['../calendar-controls.css', './calendar-layout-associations.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarLayoutAssociationsComponent {
  readonly plan = input.required<UiFieldLayoutImportPlan>(); readonly planChange = output<UiFieldLayoutImportPlan>();
  readonly worlds = inject(WorldService).getWorlds(); readonly calendars = inject(CalendarService);
  private readonly portability = inject(UiFieldLayoutPortabilityService);
  readonly associations = signal<Record<string, CalendarLayoutAssociation>>({}); readonly error = signal('');
  readonly references = computed(() => this.plan().document.calendarReferences ?? []);
  association(key: string): CalendarLayoutAssociation { return this.associations()[key] ?? this.plan().calendarAssociations?.[key] ?? { worldId: '', binding: { calendarId: '', revisionId: '' }, acceptDifferences: false }; }
  set(reference: PortableCalendarReference, property: 'world' | 'calendar' | 'revision' | 'count' | 'format' | 'accepted', value: string | boolean): void {
    const a = structuredClone(this.association(reference.key));
    if (property === 'world') { a.worldId = String(value); a.binding = { calendarId: '', revisionId: '' }; a.acceptDifferences = false; }
    if (property === 'calendar') { const calendar = this.calendars.get(String(value)); a.binding = { calendarId: calendar?.id ?? '', revisionId: calendar?.latestRevisionId ?? '' }; a.acceptDifferences = false; }
    if (property === 'revision') { a.binding.revisionId = String(value); delete a.binding.countId; delete a.binding.formatId; a.acceptDifferences = false; }
    if (property === 'count') { if (value) a.binding.countId = String(value); else delete a.binding.countId; }
    if (property === 'format') { if (value) a.binding.formatId = String(value); else delete a.binding.formatId; }
    if (property === 'accepted') a.acceptDifferences = !!value;
    this.associations.update(current => ({ ...current, [reference.key]: a }));
    // Changing a previously resolved association invalidates its plan until reviewed again.
    this.planChange.emit({ ...this.plan(), unresolvedCalendarReferences: this.references() });
  }
  rules(reference: PortableCalendarReference) { try { return this.calendars.resolve(this.association(reference.key).binding, this.association(reference.key).worldId).engine.rules; } catch { return null; } }
  differences(reference: PortableCalendarReference): string[] { const rules = this.rules(reference); return rules ? calendarRuleDifferences(reference.rules, rules) : []; }
  resolve(): void {
    try {
      const plan = this.plan(), associations = Object.fromEntries(this.references().map(ref => [ref.key, this.association(ref.key)]));
      if (!plan.serialized) throw new Error('Reanalise o documento antes de associar.');
      const next = this.portability.prepareLayoutImport(plan.serialized, associations);
      if (next.unresolvedCalendarReferences?.length) throw new Error('Associe todas as referências de calendário.');
      this.planChange.emit(next); this.error.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível associar.'); }
  }
}
