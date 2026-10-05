import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { WorkspaceTabViewHostService } from '../../services/workspace-tab-view-host.service';

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
        class="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden"
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
            [flexRatio]="layout.splitRatios[i]"
            [focused]="pane.id === layout.focusedPaneId" />
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceComponent {
  private tabManager = inject(TabManagerService);
  private readonly tabViewHost = inject(WorkspaceTabViewHostService);
  private readonly destroyRef = inject(DestroyRef);
  layout$ = this.tabManager.layout$;

  constructor() {
    const subscription = this.tabManager.layout$.subscribe(layout => this.tabViewHost.reconcile(layout));
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  onRatioChange(layout: WorkspaceLayout, leftIndex: number, ratios: [number, number]): void {
    // Live update while dragging — update in-memory without persisting yet
    const newRatios = [...layout.splitRatios];
    newRatios[leftIndex] = ratios[0];
    newRatios[leftIndex + 1] = ratios[1];
    this.tabManager.previewPaneRatios(newRatios);
  }

  onRatioCommit(layout: WorkspaceLayout, leftIndex: number, ratios: [number, number]): void {
    const newRatios = [...layout.splitRatios];
    newRatios[leftIndex] = ratios[0];
    newRatios[leftIndex + 1] = ratios[1];
    this.tabManager.commitPaneRatios(newRatios);
  }
}
