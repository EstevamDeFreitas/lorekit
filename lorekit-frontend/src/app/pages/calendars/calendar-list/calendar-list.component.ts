import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CalendarService } from '../../../services/calendar.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { DbProvider } from '../../../database/db-provider.service';
import { defaultCalendarRules } from '../../../utils/calendar-engine';
import { WorldCalendar } from '../../../models/calendar.model';

@Component({ selector: 'app-calendar-list', imports: [FormsModule], templateUrl: './calendar-list.component.html', styleUrls: ['../../../components/calendar-controls.css', './calendar-list.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarListComponent {
  private readonly service = inject(CalendarService);
  private readonly tabs = inject(TabManagerService);
  readonly worlds = inject(WorldService).getWorlds();
  readonly worldId = signal('');
  readonly search = signal('');
  readonly creating = signal(false);
  readonly newName = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly deleteId = signal('');
  private readonly refresh = signal(0);
  readonly calendars = computed(() => { this.refresh(); return this.service.list(this.worldId()).filter(c => c.name.toLocaleLowerCase().includes(this.search().toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name)); });
  constructor() {
    const destroy = inject(DestroyRef);
    inject(WorldStateService).currentWorld$.pipe(takeUntilDestroyed(destroy)).subscribe(w => this.worldId.set(w?.id ?? ''));
    const unsubscribe = inject(DbProvider).subscribeToMutations(() => this.refresh.update(n => n + 1)); destroy.onDestroy(unsubscribe);
  }
  async create(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const saved = await this.service.save({ id: '', worldId: this.worldId(), name: this.newName(), description: '', latestRevisionId: '' }, defaultCalendarRules());
      this.creating.set(false); this.newName.set(''); this.refresh.update(n => n + 1); await this.open(saved.calendar);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível criar.'); }
    finally { this.busy.set(false); }
  }
  open(calendar: WorldCalendar): Promise<boolean> { return this.tabs.openTab('Calendar', calendar.id, calendar.name, 'fa-solid fa-calendar-days'); }
  async remove(id: string): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { await this.service.delete(id); this.deleteId.set(''); this.refresh.update(n => n + 1); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível excluir.'); }
    finally { this.busy.set(false); }
  }
  summary(calendar: WorldCalendar): string {
    try { const { engine } = this.service.resolve({ calendarId: calendar.id, revisionId: calendar.latestRevisionId }); return engine.daysPerYear + ' dias por ano · ' + engine.rules.months.length + ' meses · ' + engine.rules.clock.hoursPerDay + ' horas por dia'; }
    catch { return 'Revisão indisponível; dados preservados.'; }
  }
}
