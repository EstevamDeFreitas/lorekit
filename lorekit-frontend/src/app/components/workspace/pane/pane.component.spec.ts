import { Component, OnDestroy, ViewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DbProvider } from '../../../app.config';
import { ComponentRegistryService } from '../../../services/component-registry.service';
import { ComponentRefreshService } from '../../../services/component-refresh.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorkspaceTabViewHostService } from '../../../services/workspace-tab-view-host.service';
import { WorkspacePaneComponent } from './pane.component';

@Component({
  selector: 'app-test-editor',
  template: '<div class="test-editor">{{ state }}</div>',
})
class TestEditorComponent implements OnDestroy {
  static activeInstances = 0;
  static createdInstances = 0;
  static instances: TestEditorComponent[] = [];
  state = 'initial';

  constructor() {
    TestEditorComponent.activeInstances++;
    TestEditorComponent.createdInstances++;
    TestEditorComponent.instances.push(this);
  }

  ngOnDestroy(): void {
    TestEditorComponent.activeInstances--;
    TestEditorComponent.instances = TestEditorComponent.instances.filter(instance => instance !== this);
  }
}

@Component({
  standalone: true,
  template: '<ng-container #first></ng-container><ng-container #second></ng-container>',
})
class TwoPaneOutletHostComponent {
  @ViewChild('first', { read: ViewContainerRef }) first!: ViewContainerRef;
  @ViewChild('second', { read: ViewContainerRef }) second!: ViewContainerRef;
}

describe('WorkspacePaneComponent', () => {
  let fixture: ComponentFixture<WorkspacePaneComponent>;

  beforeEach(async () => {
    TestEditorComponent.activeInstances = 0;
    TestEditorComponent.createdInstances = 0;
    TestEditorComponent.instances = [];

    await TestBed.configureTestingModule({
      imports: [WorkspacePaneComponent, TwoPaneOutletHostComponent],
      providers: [
        {
          provide: TabManagerService,
          useValue: {
            setFocusedPane: jasmine.createSpy('setFocusedPane'),
            transitionError: () => false,
          },
        },
        {
          provide: ComponentRegistryService,
          useValue: {
            getTabInputs: () => ({}),
          },
        },
        {
          provide: DbProvider,
          useValue: {
            getCrudHelper: () => ({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspacePaneComponent);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.inject(WorkspaceTabViewHostService).invalidateAll();
    expect(TestEditorComponent.activeInstances).toBe(0);
  });

  it('retains a tab instance and its local state when switching away and back', () => {
    const tabs = Array.from({ length: 20 }, (_, index) => ({
      id: 'tab-' + index,
      title: 'Tab ' + index,
      icon: 'fa-file',
      entityType: 'Document' as const,
      entityId: 'document-' + index,
      paneId: 'pane-1',
      isDirty: false,
      resolvedComponent: TestEditorComponent,
    }));

    fixture.componentRef.setInput('pane', {
      id: 'pane-1',
      tabs,
      activeTabId: tabs[0].id,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.test-editor').length).toBe(1);
    expect(TestEditorComponent.activeInstances).toBe(1);
    expect(TestEditorComponent.createdInstances).toBe(1);
    const firstInstance = TestEditorComponent.instances[0];
    firstInstance.state = 'canvas state';

    fixture.componentRef.setInput('pane', {
      id: 'pane-1',
      tabs,
      activeTabId: tabs[19].id,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.test-editor').length).toBe(1);
    expect(TestEditorComponent.activeInstances).toBe(2);
    expect(TestEditorComponent.createdInstances).toBe(2);

    fixture.componentRef.setInput('pane', {
      id: 'pane-1',
      tabs,
      activeTabId: tabs[0].id,
    });
    fixture.detectChanges();

    expect(TestEditorComponent.activeInstances).toBe(2);
    expect(TestEditorComponent.createdInstances).toBe(2);
    expect(TestEditorComponent.instances).toContain(firstInstance);
    expect(fixture.nativeElement.querySelector('.test-editor').textContent.trim()).toBe('canvas state');
  });

  it('tracks retained view growth across many open tabs and releases all views when closed', () => {
    const tabs = Array.from({ length: 20 }, (_, index) => ({
      id: 'profile-tab-' + index,
      title: 'Profile tab ' + index,
      icon: 'fa-file',
      entityType: 'Document' as const,
      entityId: 'profile-document-' + index,
      paneId: 'pane-profile',
      isDirty: false,
      resolvedComponent: TestEditorComponent,
    }));
    const tabViewHost = TestBed.inject(WorkspaceTabViewHostService);

    for (const tab of tabs) {
      fixture.componentRef.setInput('pane', {
        id: 'pane-profile',
        tabs,
        activeTabId: tab.id,
      });
      fixture.detectChanges();
    }

    expect(tabViewHost.retainedViewCount).toBe(20);
    expect(TestEditorComponent.createdInstances).toBe(20);

    tabViewHost.reconcile({
      panes: [{ id: 'pane-profile', tabs: [], activeTabId: null }],
      splitRatios: [100],
      focusedPaneId: 'pane-profile',
      activeSidebarSection: 'character',
      sidebarVisible: true,
    });

    expect(tabViewHost.retainedViewCount).toBe(0);
    expect(TestEditorComponent.activeInstances).toBe(0);
  });

  it('remounts the active component when a refresh is requested', () => {
    const tab = {
      id: 'tab-1',
      title: 'Tab',
      icon: 'fa-file',
      entityType: 'Document' as const,
      entityId: 'document-1',
      paneId: 'pane-1',
      isDirty: false,
      resolvedComponent: TestEditorComponent,
    };

    fixture.componentRef.setInput('pane', {
      id: 'pane-1',
      tabs: [tab],
      activeTabId: tab.id,
    });
    fixture.detectChanges();

    TestBed.inject(ComponentRefreshService).refresh();
    fixture.detectChanges();

    expect(TestEditorComponent.activeInstances).toBe(1);
    expect(TestEditorComponent.createdInstances).toBe(2);
  });

  it('releases the retained view when its tab is removed from the runtime host', () => {
    const tab = {
      id: 'tab-close',
      title: 'Tab',
      icon: 'fa-file',
      entityType: 'Document' as const,
      entityId: 'document-close',
      paneId: 'pane-1',
      isDirty: false,
      resolvedComponent: TestEditorComponent,
    };
    fixture.componentRef.setInput('pane', { id: 'pane-1', tabs: [tab], activeTabId: tab.id });
    fixture.detectChanges();

    const tabViewHost = TestBed.inject(WorkspaceTabViewHostService);
    tabViewHost.reconcile({
      panes: [{ id: 'pane-1', tabs: [], activeTabId: null }],
      splitRatios: [100],
      focusedPaneId: 'pane-1',
      activeSidebarSection: 'character',
      sidebarVisible: true,
    });

    expect(TestEditorComponent.activeInstances).toBe(0);
    expect(tabViewHost.retainedViewCount).toBe(0);
  });

  it('moves a retained component between pane outlets without creating another instance', () => {
    const hostFixture = TestBed.createComponent(TwoPaneOutletHostComponent);
    hostFixture.detectChanges();
    const tab = {
      id: 'tab-move',
      title: 'Movable tab',
      icon: 'fa-file',
      entityType: 'Document' as const,
      entityId: 'document-move',
      paneId: 'pane-1',
      isDirty: false,
      resolvedComponent: TestEditorComponent,
    };
    const tabViewHost = TestBed.inject(WorkspaceTabViewHostService);
    tabViewHost.activate(tab, hostFixture.componentInstance.first, true, {});
    const originalInstance = TestEditorComponent.instances[0];
    originalInstance.state = 'moved state';

    tabViewHost.activate(
      { ...tab, paneId: 'pane-2' },
      hostFixture.componentInstance.second,
      true,
      {}
    );

    expect(TestEditorComponent.createdInstances).toBe(1);
    expect(TestEditorComponent.instances[0]).toBe(originalInstance);
    expect(hostFixture.componentInstance.first.length).toBe(0);
    expect(hostFixture.componentInstance.second.length).toBe(1);
    expect(hostFixture.nativeElement.textContent).toContain('moved state');

    tabViewHost.destroy(tab.id);
    hostFixture.destroy();
  });
});
