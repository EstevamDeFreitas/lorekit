import { Injectable, signal } from '@angular/core';

type DragStartPayload = {
  contextId: string;
  draggedId: string;
  title: string;
};

type RawDropTarget = {
  contextId: string;
  type: 'node' | 'root';
  nodeId: string | null;
};

type ActiveTreeDrag = DragStartPayload & {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dragging: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class TreeViewDragDropService {
  private readonly dragThreshold = 6;

  private readonly activeDragState = signal<ActiveTreeDrag | null>(null);
  private readonly dropTargetState = signal<RawDropTarget | null>(null);

  readonly activeDrag = this.activeDragState.asReadonly();
  readonly dropTarget = this.dropTargetState.asReadonly();

  private dragPreviewElement: HTMLDivElement | null = null;
  private onComplete: ((result: { draggedId: string; newParentId: string | null }) => void) | null = null;

  startDrag(
    event: PointerEvent,
    payload: DragStartPayload,
    onComplete: (result: { draggedId: string; newParentId: string | null }) => void,
  ) {
    if (event.button !== 0) {
      return;
    }

    this.cancelDrag();

    event.preventDefault();
    event.stopPropagation();

    this.onComplete = onComplete;
    this.activeDragState.set({
      ...payload,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      dragging: false,
    });
    this.dropTargetState.set(null);

    this.ensureDragPreview(payload.title);
    this.updateDragPreviewPosition(event.clientX, event.clientY, false);

    document.addEventListener('pointermove', this.handlePointerMove, true);
    document.addEventListener('pointerup', this.handlePointerUp, true);
    document.addEventListener('pointercancel', this.handlePointerUp, true);
  }

  cancelDrag() {
    this.clearDocumentListeners();
    this.clearBodyDragState();
    this.removeDragPreview();
    this.onComplete = null;
    this.activeDragState.set(null);
    this.dropTargetState.set(null);
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    const activeDrag = this.activeDragState();
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - activeDrag.startX;
    const deltaY = event.clientY - activeDrag.startY;
    const hasCrossedThreshold = Math.hypot(deltaX, deltaY) >= this.dragThreshold;

    const nextDrag = {
      ...activeDrag,
      currentX: event.clientX,
      currentY: event.clientY,
      dragging: activeDrag.dragging || hasCrossedThreshold,
    };

    if (nextDrag.dragging) {
      this.applyBodyDragState();
    }

    this.activeDragState.set(nextDrag);
    this.updateDragPreviewPosition(event.clientX, event.clientY, nextDrag.dragging);
    this.dropTargetState.set(nextDrag.dragging ? this.resolveDropTarget(event.clientX, event.clientY, nextDrag.contextId) : null);
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    const activeDrag = this.activeDragState();
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    const dropTarget = activeDrag.dragging
      ? this.resolveDropTarget(event.clientX, event.clientY, activeDrag.contextId)
      : null;
    const completionHandler = this.onComplete;

    this.cancelDrag();

    if (!activeDrag.dragging || !dropTarget || !completionHandler) {
      return;
    }

    completionHandler({
      draggedId: activeDrag.draggedId,
      newParentId: dropTarget.type === 'node' ? dropTarget.nodeId : null,
    });
  };

  private resolveDropTarget(clientX: number, clientY: number, contextId: string): RawDropTarget | null {
    const elements = document.elementsFromPoint(clientX, clientY);

    for (const candidate of elements) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }

      const rowElement = candidate.closest('[data-tree-node-row]') as HTMLElement | null;
      if (rowElement && rowElement.dataset['treeContext'] === contextId) {
        return {
          contextId,
          type: 'node',
          nodeId: rowElement.dataset['treeNodeId'] || null,
        };
      }
    }

    for (const candidate of elements) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }

      const rootElement = candidate.closest('[data-tree-root-context]') as HTMLElement | null;
      if (rootElement && rootElement.dataset['treeRootContext'] === contextId) {
        return {
          contextId,
          type: 'root',
          nodeId: null,
        };
      }
    }

    return null;
  }

  private ensureDragPreview(title: string) {
    if (this.dragPreviewElement) {
      this.dragPreviewElement.remove();
    }

    const preview = document.createElement('div');
    preview.className = 'tree-view-drag-preview';
    preview.style.position = 'fixed';
    preview.style.pointerEvents = 'none';
    preview.style.zIndex = '1000';
    preview.style.top = '0';
    preview.style.left = '0';
    preview.style.opacity = '0';
    preview.style.transform = 'translate3d(-9999px, -9999px, 0)';
    preview.style.padding = '0.45rem 0.75rem';
    preview.style.borderRadius = '0.5rem';
    preview.style.border = '1px solid rgba(161, 161, 170, 0.55)';
    preview.style.background = 'rgba(24, 24, 27, 0.95)';
    preview.style.color = '#FFFFFF';
    preview.style.fontSize = '0.75rem';
    preview.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.25)';
    preview.textContent = title;

    document.body.appendChild(preview);
    this.dragPreviewElement = preview;
  }

  private updateDragPreviewPosition(clientX: number, clientY: number, visible: boolean) {
    if (!this.dragPreviewElement) {
      return;
    }

    this.dragPreviewElement.style.opacity = visible ? '1' : '0';
    this.dragPreviewElement.style.transform = `translate3d(${clientX + 14}px, ${clientY + 14}px, 0)`;
  }

  private removeDragPreview() {
    this.dragPreviewElement?.remove();
    this.dragPreviewElement = null;
  }

  private applyBodyDragState() {
    document.body.classList.add('tree-view-dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }

  private clearBodyDragState() {
    document.body.classList.remove('tree-view-dragging');
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
  }

  private clearDocumentListeners() {
    document.removeEventListener('pointermove', this.handlePointerMove, true);
    document.removeEventListener('pointerup', this.handlePointerUp, true);
    document.removeEventListener('pointercancel', this.handlePointerUp, true);
  }
}
