import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { TabManagerService } from '../../services/tab-manager.service';
import { WorkspacePaneComponent } from './pane/pane.component';
import { PaneResizeHandleComponent } from './resize-handle/resize-handle.component';
import { WorkspaceLayout } from '../../models/workspace.model';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    AsyncPipe,
    CdkDropListGroup,
    WorkspacePaneComponent,
    PaneResizeHandleComponent,
  ],
  template: `
    @if (layout$ | async; as layout) {
      <div
        class="flex flex-row h-full overflow-hidden"
        cdkDropListGroup>
        @for (pane of layout.panes; track pane.id; let i = $index) {
          <!-- Resize handle before pane (skip first) -->
          @if (i > 0) {
            <app-pane-resize-handle
              [leftRatio]="layout.splitRatios[i - 1]"
              [rightRatio]="layout.splitRatios[i]"
              (ratioChange)="onRatioChange(layout, i - 1, $event)"
              (ratioCommit)="onRatioCommit(layout, i - 1, $event)" />
          }
          <app-workspace-pane
            [pane]="pane"
            [flexRatio]="layout.splitRatios[i]" />
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceComponent {
  private tabManager = inject(TabManagerService);
  layout$ = this.tabManager.layout$;

  onRatioChange(layout: WorkspaceLayout, leftIndex: number, ratios: [number, number]): void {
    // Live update while dragging — update in-memory without persisting yet
    const newRatios = [...layout.splitRatios];
    newRatios[leftIndex] = ratios[0];
    newRatios[leftIndex + 1] = ratios[1];
    this.tabManager.setPaneRatios(newRatios);
  }

  onRatioCommit(layout: WorkspaceLayout, leftIndex: number, ratios: [number, number]): void {
    // Commit final ratio on mouse-up (already persisted by setPaneRatios above)
  }
}
