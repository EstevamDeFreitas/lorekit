import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
} from '@angular/core';

/**
 * Draggable vertical divider between two panes.
 * Emits (ratioChange) with the new [leftPercent, rightPercent] pair during drag.
 * The parent is responsible for committing the final ratio.
 */
@Component({
  selector: 'app-pane-resize-handle',
  standalone: true,
  template: `
    <div
      class="w-1 cursor-col-resize h-full relative group flex items-center justify-center shrink-0"
      (mousedown)="onMouseDown($event)">
      <div class="w-px h-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors duration-150"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaneResizeHandleComponent implements OnDestroy {
  /** flex-basis percent of the LEFT sibling pane */
  leftRatio = input.required<number>();
  /** flex-basis percent of the RIGHT sibling pane */
  rightRatio = input.required<number>();
  /** Emits updated [left, right] ratios while dragging */
  ratioChange = output<[number, number]>();
  /** Emits final [left, right] ratios on mouseup */
  ratioCommit = output<[number, number]>();

  private el = inject(ElementRef);
  private startX = 0;
  private startLeft = 0;
  private startRight = 0;
  private containerWidth = 0;

  private onMouseMoveBound = this.onMouseMove.bind(this);
  private onMouseUpBound = this.onMouseUp.bind(this);

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.startX = event.clientX;
    this.startLeft = this.leftRatio();
    this.startRight = this.rightRatio();

    // Container is the grandparent (workspace flex row)
    const container = (this.el.nativeElement as HTMLElement).parentElement;
    this.containerWidth = container?.clientWidth ?? window.innerWidth;

    document.addEventListener('mousemove', this.onMouseMoveBound);
    document.addEventListener('mouseup', this.onMouseUpBound);
  }

  private onMouseMove(event: MouseEvent): void {
    const delta = event.clientX - this.startX;
    const deltaPercent = (delta / this.containerWidth) * 100;
    const minPanePercent = (200 / this.containerWidth) * 100; // 200px minimum

    let newLeft = Math.max(minPanePercent, this.startLeft + deltaPercent);
    let newRight = Math.max(minPanePercent, this.startRight - deltaPercent);

    // Clamp so total doesn't drift
    const total = this.startLeft + this.startRight;
    if (newLeft + newRight !== total) {
      newRight = total - newLeft;
      if (newRight < minPanePercent) {
        newRight = minPanePercent;
        newLeft = total - newRight;
      }
    }

    this.ratioChange.emit([newLeft, newRight]);
  }

  private onMouseUp(event: MouseEvent): void {
    const delta = event.clientX - this.startX;
    const deltaPercent = (delta / this.containerWidth) * 100;
    const minPanePercent = (200 / this.containerWidth) * 100;

    let newLeft = Math.max(minPanePercent, this.startLeft + deltaPercent);
    let newRight = Math.max(minPanePercent, this.startRight - deltaPercent);
    const total = this.startLeft + this.startRight;
    if (newRight < minPanePercent) {
      newRight = minPanePercent;
      newLeft = total - newRight;
    }

    this.ratioCommit.emit([newLeft, newRight]);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('mouseup', this.onMouseUpBound);
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('mouseup', this.onMouseUpBound);
  }
}
