import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { provideRouter } from '@angular/router';
import { TreeViewListComponent } from './entity-lateral-menu.component';
import { TreeViewDragDropService } from './tree-view-drag-drop.service';
import { TreeViewNode, TreeViewReparentRequest } from './tree-view.models';

@Component({
  standalone: true,
  imports: [TreeViewListComponent],
  template: `
    <app-tree-view-list
      [documentArray]="nodes"
      [openInDialog]="false"
      [dragContextId]="'test-tree'"
      (onReparentRequested)="lastReparent = $event">
    </app-tree-view-list>
  `
})
class TreeViewHostComponent {
  nodes: TreeViewNode[] = [
    {
      id: 'alpha',
      title: 'Alpha',
      SubDocuments: [
        {
          id: 'beta',
          title: 'Beta',
          SubDocuments: [],
        },
      ],
    },
    {
      id: 'gamma',
      title: 'Gamma',
      SubDocuments: [],
    },
  ];

  lastReparent: TreeViewReparentRequest | null = null;
}

describe('TreeViewListComponent', () => {
  let dragDropService: TreeViewDragDropService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeViewHostComponent],
      providers: [
        provideRouter([]),
        {
          provide: Dialog,
          useValue: { open: jasmine.createSpy('open') },
        },
      ],
    }).compileComponents();

    dragDropService = TestBed.inject(TreeViewDragDropService);
  });

  afterEach(() => {
    dragDropService.cancelDrag();
  });

  it('only starts drag from the dedicated handle', () => {
    const fixture = TestBed.createComponent(TreeViewHostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    const gammaRow = fixture.nativeElement.querySelector('[data-tree-node-id="gamma"]') as HTMLElement;

    gammaRow.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      bubbles: true,
    }));

    document.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 40,
      clientY: 40,
      pointerId: 1,
      bubbles: true,
    }));
    document.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 40,
      clientY: 40,
      pointerId: 1,
      bubbles: true,
    }));

    expect(host.lastReparent).toBeNull();
  });

  it('emits a reparent request when dropping over another item', () => {
    const fixture = TestBed.createComponent(TreeViewHostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    const gammaHandle = fixture.nativeElement.querySelector('[data-tree-node-id="gamma"] button[title="Arrastar para reorganizar"]') as HTMLElement;
    const alphaRow = fixture.nativeElement.querySelector('[data-tree-node-id="alpha"]') as HTMLElement;

    spyOn(document, 'elementsFromPoint').and.returnValue([alphaRow]);

    gammaHandle.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 2,
      bubbles: true,
    }));

    document.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 50,
      clientY: 50,
      pointerId: 2,
      bubbles: true,
    }));
    document.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 50,
      clientY: 50,
      pointerId: 2,
      bubbles: true,
    }));

    expect(host.lastReparent).toEqual({
      draggedId: 'gamma',
      newParentId: 'alpha',
    });
  });

  it('emits null as parent when dropping on the root area', () => {
    const fixture = TestBed.createComponent(TreeViewHostComponent);
    const treeComponent = fixture.debugElement.children[0].componentInstance as TreeViewListComponent;
    treeComponent.openDocuments.add('alpha');
    fixture.detectChanges();

    const host = fixture.componentInstance;
    const betaHandle = fixture.nativeElement.querySelector('[data-tree-node-id="beta"] button[title="Arrastar para reorganizar"]') as HTMLElement;
    const rootElement = fixture.nativeElement.querySelector('[data-tree-root-context="test-tree"]') as HTMLElement;

    spyOn(document, 'elementsFromPoint').and.returnValue([rootElement]);

    betaHandle.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 3,
      bubbles: true,
    }));

    document.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 52,
      clientY: 52,
      pointerId: 3,
      bubbles: true,
    }));
    document.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 52,
      clientY: 52,
      pointerId: 3,
      bubbles: true,
    }));

    expect(host.lastReparent).toEqual({
      draggedId: 'beta',
      newParentId: null,
    });
  });

  it('cancels the drag when the pointer is released outside the tree', () => {
    const fixture = TestBed.createComponent(TreeViewHostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    const gammaHandle = fixture.nativeElement.querySelector('[data-tree-node-id="gamma"] button[title="Arrastar para reorganizar"]') as HTMLElement;

    spyOn(document, 'elementsFromPoint').and.returnValue([]);

    gammaHandle.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 4,
      bubbles: true,
    }));

    document.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 70,
      clientY: 70,
      pointerId: 4,
      bubbles: true,
    }));
    document.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 70,
      clientY: 70,
      pointerId: 4,
      bubbles: true,
    }));

    expect(host.lastReparent).toBeNull();
  });
});
