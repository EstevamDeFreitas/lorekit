import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TabManagerService } from '../../services/tab-manager.service';
import { SidebarPanelComponent } from './sidebar-panel.component';

describe('SidebarPanelComponent lifecycle', () => {
  it('stops responding to layout changes after destruction', async () => {
    const layoutChanges = new Subject<any>();

    await TestBed.configureTestingModule({
      imports: [SidebarPanelComponent],
      providers: [{
        provide: TabManagerService,
        useValue: {
          layout$: layoutChanges.asObservable(),
          toggleSidebar: jasmine.createSpy('toggleSidebar'),
        },
      }],
    }).compileComponents();

    const fixture: ComponentFixture<SidebarPanelComponent> =
      TestBed.createComponent(SidebarPanelComponent);
    const loadSection = spyOn<any>(fixture.componentInstance, 'loadSection').and.resolveTo();
    fixture.detectChanges();

    layoutChanges.next({ activeSidebarSection: 'documents', sidebarVisible: true });
    expect(loadSection).toHaveBeenCalledTimes(1);

    fixture.destroy();
    layoutChanges.next({ activeSidebarSection: 'characters', sidebarVisible: true });

    expect(loadSection).toHaveBeenCalledTimes(1);
  });
});
