import { Component, ViewChild, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MoodboardEditComponent } from './moodboard-edit.component';
import { MoodboardService } from '../../../services/moodboard.service';
import { ImageService } from '../../../services/image.service';
import { DocumentService } from '../../../services/document.service';
import { WorldStateService } from '../../../services/world-state.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorkspaceTabViewHostService } from '../../../services/workspace-tab-view-host.service';

@Component({
  standalone: true,
  template: '<ng-container #first></ng-container><ng-container #second></ng-container>',
})
class MoodboardPaneOutletHostComponent {
  @ViewChild('first', { read: ViewContainerRef }) first!: ViewContainerRef;
  @ViewChild('second', { read: ViewContainerRef }) second!: ViewContainerRef;
}

describe('Moodboard tab lifecycle', () => {
  it('retains canvas state and sends global delete only to the focused pane', async () => {
    const moodboardService = {
      searchEntities: jasmine.createSpy('searchEntities').and.returnValue([]),
      deleteMoodboardItem: jasmine.createSpy('deleteMoodboardItem'),
    };

    TestBed.configureTestingModule({
      imports: [MoodboardEditComponent, MoodboardPaneOutletHostComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: MoodboardService, useValue: moodboardService },
        { provide: ImageService, useValue: {} },
        { provide: DocumentService, useValue: {} },
        { provide: WorldStateService, useValue: { getCurrentWorld: () => null } },
        { provide: TabManagerService, useValue: { snapshot: { panes: [] }, updateTabTitle: jasmine.createSpy('updateTabTitle') } },
      ],
    }).overrideComponent(MoodboardEditComponent, {
      set: { template: '<div class="moodboard-test"></div>' },
    });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(MoodboardPaneOutletHostComponent);
    fixture.detectChanges();
    const viewHost = TestBed.inject(WorkspaceTabViewHostService);
    const firstTab = {
      id: 'moodboard-tab-a',
      title: 'Board A',
      icon: 'fa-table-cells-large',
      entityType: 'Moodboard' as const,
      entityId: 'board-a',
      paneId: 'pane-a',
      isDirty: false,
      resolvedComponent: MoodboardEditComponent,
    };
    const secondTab = {
      ...firstTab,
      id: 'moodboard-tab-b',
      entityId: 'board-b',
      paneId: 'pane-b',
    };

    viewHost.activate(firstTab, fixture.componentInstance.first, true, {});
    viewHost.activate(secondTab, fixture.componentInstance.second, false, {});
    const boards = fixture.debugElement
      .queryAll(element => element.componentInstance instanceof MoodboardEditComponent)
      .map(element => element.componentInstance as MoodboardEditComponent);
    const firstBoard = boards.find(board => (board as any).tabContext.tabId === firstTab.id)!;
    const secondBoard = boards.find(board => (board as any).tabContext.tabId === secondTab.id)!;
    firstBoard.items.set([{ item: { id: 'item-a' }, config: {}, entity: null, document: null, documentBlocks: [] }] as any);
    secondBoard.items.set([{ item: { id: 'item-b' }, config: {}, entity: null, document: null, documentBlocks: [] }] as any);
    firstBoard.selectedItemIds.set(['item-a']);
    secondBoard.selectedItemIds.set(['item-b']);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(moodboardService.deleteMoodboardItem).toHaveBeenCalledOnceWith('item-a');
    expect(secondBoard.items().map(item => item.item.id)).toEqual(['item-b']);

    firstBoard.panX.set(321);
    firstBoard.zoom.set(1.7);
    viewHost.activate(undefined, fixture.componentInstance.first, false, {});
    viewHost.activate(firstTab, fixture.componentInstance.first, true, {});

    expect(viewHost.retainedViewCount).toBe(2);
    expect(firstBoard.panX()).toBe(321);
    expect(firstBoard.zoom()).toBe(1.7);

    viewHost.invalidateAll();
    fixture.destroy();
  });
});
