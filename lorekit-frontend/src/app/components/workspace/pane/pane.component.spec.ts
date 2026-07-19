import { Component, OnDestroy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRegistryService } from '../../../services/component-registry.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorkspacePaneComponent } from './pane.component';

@Component({
  selector: 'app-test-editor',
  template: '<div class="test-editor"></div>',
})
class TestEditorComponent implements OnDestroy {
  static activeInstances = 0;
  static createdInstances = 0;

  constructor() {
    TestEditorComponent.activeInstances++;
    TestEditorComponent.createdInstances++;
  }

  ngOnDestroy(): void {
    TestEditorComponent.activeInstances--;
  }
}

describe('WorkspacePaneComponent', () => {
  let fixture: ComponentFixture<WorkspacePaneComponent>;

  beforeEach(async () => {
    TestEditorComponent.activeInstances = 0;
    TestEditorComponent.createdInstances = 0;

    await TestBed.configureTestingModule({
      imports: [WorkspacePaneComponent],
      providers: [
        {
          provide: TabManagerService,
          useValue: {
            setFocusedPane: jasmine.createSpy('setFocusedPane'),
          },
        },
        {
          provide: ComponentRegistryService,
          useValue: {
            getTabInputs: () => ({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspacePaneComponent);
  });

  afterEach(() => {
    fixture.destroy();
    expect(TestEditorComponent.activeInstances).toBe(0);
  });

  it('keeps all tab metadata but mounts only the active tab content', () => {
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

    fixture.componentRef.setInput('pane', {
      id: 'pane-1',
      tabs,
      activeTabId: tabs[19].id,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.test-editor').length).toBe(1);
    expect(TestEditorComponent.activeInstances).toBe(1);
    expect(TestEditorComponent.createdInstances).toBe(2);
  });
});