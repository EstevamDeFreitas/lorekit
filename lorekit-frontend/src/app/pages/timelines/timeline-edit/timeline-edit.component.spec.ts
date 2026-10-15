import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TimelineEditComponent } from './timeline-edit.component';
import { TimelineEvent } from '../../../models/timeline-event.model';
import { TimelineService } from '../../../services/timeline.service';
import { AgeService } from '../../../services/age.service';
import { GreatMarkService } from '../../../services/great-mark.service';
import { EventService } from '../../../services/event.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarTimelineService } from '../../../services/calendar-timeline.service';
import { flushPendingComponentSaves } from '../../../utils/pending-save-event';

describe('free timeline event resizing', () => {
  const save = jasmine.createSpy('saveEventPlacement');
  beforeEach(() => {
    save.calls.reset(); save.and.resolveTo();
    TestBed.configureTestingModule({ imports: [TimelineEditComponent], providers: [
      { provide: Dialog, useValue: {} },
      { provide: Router, useValue: {} },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      { provide: TimelineService, useValue: {} },
      { provide: AgeService, useValue: {} },
      { provide: GreatMarkService, useValue: {} },
      { provide: EventService, useValue: { saveEventPlacement: save } },
      { provide: EntityChangeService, useValue: { changes$: new Subject(), notifySave: jasmine.createSpy() } },
      { provide: CalendarService, useValue: {} },
      { provide: CalendarTimelineService, useValue: {} },
    ] }).overrideComponent(TimelineEditComponent, { set: { imports: [], template: '' } });
  });

  for (const boundary of ['start', 'end'] as const) {
    it('collapses an interval using its ' + boundary + ' handle, saves equal limits and can expand it again', async () => {
      const fixture = TestBed.createComponent(TimelineEditComponent);
      try {
        fixture.detectChanges();
        const component = fixture.componentInstance;
        const item = new TimelineEvent('event', 'Evento', '', 0, 0, 0, 10);
        component.events = [item]; component.pixelsPerYear = 8;
        component.startDrag(new PointerEvent('pointerdown', { button: 0, pointerId: 7, clientX: 200 }), boundary === 'start' ? 'event-start' : 'event-end', item);
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: boundary === 'start' ? 400 : 0 }));
        expect(item.startDate).toBe(item.endDate); expect(component.isCompactEvent(item)).toBeTrue();
        await flushPendingComponentSaves();
        expect(save).toHaveBeenCalledWith('event', item.startDate, item.startDate, 0);
        const point = item.startDate; component.pixelsPerYear = 8;
        component.startDrag(new PointerEvent('pointerdown', { button: 0, pointerId: 8, clientX: 100 }), 'event-end', item);
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 8, clientX: 180 }));
        expect(item.startDate).toBe(point); expect(item.endDate).toBe(point + 10);
        expect(component.isCompactEvent(item)).toBeFalse();
        await flushPendingComponentSaves(); expect(save).toHaveBeenCalledWith('event', point, point + 10, 0);
      } finally { fixture.destroy(); }
    });
  }
});
