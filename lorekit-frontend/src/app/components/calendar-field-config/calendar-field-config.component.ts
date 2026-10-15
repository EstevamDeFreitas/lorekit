import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarDateFieldOptions } from '../../models/calendar.model';
import { parseCalendarFieldOptions } from '../../utils/calendar-field-options';
import { CalendarService } from '../../services/calendar.service';
import { WorldService } from '../../services/world.service';

@Component({ selector: 'app-calendar-field-config', imports: [FormsModule], templateUrl: './calendar-field-config.component.html', styleUrls: ['../calendar-controls.css', './calendar-field-config.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarFieldConfigComponent {
  private readonly calendars = inject(CalendarService);
  readonly worlds = inject(WorldService).getWorlds();
  readonly options = input<string | undefined>(''); readonly optionsChange = output<string>();
  readonly worldId = signal(''); readonly error = signal('');
  readonly config = computed(() => { try { return parseCalendarFieldOptions(this.options()); } catch { return null; } });
  readonly choices = computed(() => this.calendars.list(this.worldId()));
  readonly binding = computed(() => this.config()?.bindings[this.worldId()] ?? null);
  readonly revisions = computed(() => this.binding() ? this.calendars.revisions(this.binding()!.calendarId) : []);
  readonly rules = computed(() => { try { const binding = this.binding(); return binding ? this.calendars.resolve(binding, this.worldId()).engine.rules : null; } catch { return null; } });
  configBindingCount(): number { return Object.keys(this.config()?.bindings ?? {}).length; }
  update(change: (config: CalendarDateFieldOptions) => void): void {
    try { const config = structuredClone(parseCalendarFieldOptions(this.options())); change(config); const serialized = JSON.stringify(config); parseCalendarFieldOptions(serialized); this.optionsChange.emit(serialized); this.error.set(''); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Configuração inválida.'); }
  }
  mode(value: 'fixed' | 'selectable'): void { this.update(c => { c.mode = value; }); }
  time(value: boolean): void { this.update(c => { c.allowTime = value; }); }
  calendar(value: string): void { this.update(c => { if (!value) delete c.bindings[this.worldId()]; else { const calendar = this.calendars.get(value); if (!calendar || calendar.worldId !== this.worldId()) throw new Error('Selecione um calendário deste mundo.'); c.bindings[this.worldId()] = { calendarId: calendar.id, revisionId: calendar.latestRevisionId }; } }); }
  revision(value: string): void { this.update(c => { const b = c.bindings[this.worldId()]; if (b) { b.revisionId = value; delete b.countId; delete b.formatId; this.calendars.resolve(b, this.worldId()); } }); }
  count(value: string): void { this.update(c => { const b = c.bindings[this.worldId()]; if (b) { if (value) b.countId = value; else delete b.countId; } }); }
  format(value: string): void { this.update(c => { const b = c.bindings[this.worldId()]; if (b) { if (value) b.formatId = value; else delete b.formatId; } }); }
}
