import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { SettingsComponent } from '../../settings/settings/settings.component';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { WorkspaceComponent } from '../../../components/workspace/workspace.component';
import { SidebarPanelComponent } from '../../../components/sidebar-panel/sidebar-panel.component';
import { TabManagerService } from '../../../services/tab-manager.service';
import { AppearanceEffectsService } from '../../../services/appearance-effects.service';

@Component({
  selector: 'app-main-ui',
  imports: [AsyncPipe, NavButtonComponent, WorkspaceComponent, SidebarPanelComponent],
  templateUrl: './main-ui.component.html',
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainUiComponent {
  settingsDialog = inject(Dialog);
  tabManager = inject(TabManagerService);
  private readonly appearanceEffects = inject(AppearanceEffectsService);

  private layoutTouchStartX: number | null = null;

  onLayoutTouchStart(event: TouchEvent): void {
    this.layoutTouchStartX = event.touches[0]?.clientX ?? null;
  }

  onLayoutTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0]?.clientX;
    if (
      this.layoutTouchStartX !== null &&
      endX !== undefined &&
      this.layoutTouchStartX <= 24 &&
      endX - this.layoutTouchStartX > 60
    ) {
      this.tabManager.setSidebarVisible(true);
    }
    this.layoutTouchStartX = null;
  }

  openSettings() {
    this.settingsDialog.open(SettingsComponent, {
      autoFocus: false,
      restoreFocus: false,
    });
  }
}
