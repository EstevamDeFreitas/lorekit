import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CalendarListComponent } from './calendar-list.component';
import { CalendarService } from '../../../services/calendar.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { DbProvider } from '../../../database/db-provider.service';
import { CalendarEngine, defaultCalendarRules } from '../../../utils/calendar-engine';

describe('world calendar navigation', () => {
  it('filters independent calendars by world and opens the calendar workspace tab', () => {
    const entries = [{ id: 'one', worldId: 'w1', name: 'Imperial', latestRevisionId: 'r1' }, { id: 'two', worldId: 'w1', name: 'Lunar', latestRevisionId: 'r2' }, { id: 'other', worldId: 'w2', name: 'Outro mundo', latestRevisionId: 'r3' }];
    const openTab = jasmine.createSpy('openTab').and.resolveTo(true);
    TestBed.configureTestingModule({ imports: [CalendarListComponent], providers: [{ provide: CalendarService, useValue: { list: (id: string) => entries.filter(c => c.worldId === id), resolve: () => ({ engine: new CalendarEngine(defaultCalendarRules()) }) } }, { provide: WorldService, useValue: { getWorlds: () => [{ id: 'w1', name: 'Um' }, { id: 'w2', name: 'Dois' }] } }, { provide: WorldStateService, useValue: { currentWorld$: of({ id: 'w1' }) } }, { provide: TabManagerService, useValue: { openTab } }, { provide: DbProvider, useValue: { subscribeToMutations: () => () => {} } }] });
    const fixture = TestBed.createComponent(CalendarListComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.calendar-open').length).toBe(2);
    fixture.nativeElement.querySelector('.calendar-open').click(); expect(openTab).toHaveBeenCalledWith('Calendar', 'one', 'Imperial', 'fa-solid fa-calendar-days');
    fixture.componentInstance.worldId.set('w2'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.calendar-open').length).toBe(1); expect(fixture.nativeElement.textContent).toContain('Outro mundo'); fixture.destroy();
  });
});
