import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DbProvider } from '../../../database/db-provider.service';
import { StoryNavigationService } from '../../../services/story-navigation.service';
import { Dialog } from '@angular/cdk/dialog';
import { SettingsComponent } from '../../settings/settings/settings.component';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { WorkspaceComponent } from '../../../components/workspace/workspace.component';
import { SidebarPanelComponent } from '../../../components/sidebar-panel/sidebar-panel.component';
import { TabManagerService } from '../../../services/tab-manager.service';
import { AppearanceEffectsService } from '../../../services/appearance-effects.service';

@Component({
  selector: 'app-main-ui',
  imports: [AsyncPipe, RouterLink, NavButtonComponent, WorkspaceComponent, SidebarPanelComponent],
  templateUrl: './main-ui.component.html',
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainUiComponent {
  settingsDialog = inject(Dialog);
  tabManager = inject(TabManagerService);
  readonly database = inject(DbProvider);
  private readonly storyNavigation = inject(StoryNavigationService);
  private readonly appearanceEffects = inject(AppearanceEffectsService);

  constructor() {
    effect(() => {
      const target = this.storyNavigation.target();
      if (!target) return;
      void this.tabManager.whenRestored.then(() => {
        if (this.storyNavigation.target() === target)
          return this.tabManager.openStoriesTab();
        return false;
      });
    });
  }

  private layoutTouchStartX: number | null = null;
  private layoutTouchStartY: number | null = null;
  readonly mobileNavigationVisible = signal(false);

  onLayoutTouchStart(event: TouchEvent): void {
    this.layoutTouchStartX = event.touches[0]?.clientX ?? null;
    this.layoutTouchStartY = event.touches[0]?.clientY ?? null;
  }

  onLayoutTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0]?.clientX;
    const endY = event.changedTouches[0]?.clientY;
    if (
      this.layoutTouchStartX !== null &&
      endX !== undefined &&
      this.layoutTouchStartX <= 24 &&
      endX - this.layoutTouchStartX > 60
    ) {
      this.tabManager.setSidebarVisible(true);
    }
    if (window.matchMedia('(max-width: 767px)').matches && this.layoutTouchStartX !== null && this.layoutTouchStartY !== null && endX !== undefined && endY !== undefined) {
      const dx = endX - this.layoutTouchStartX;
      const dy = endY - this.layoutTouchStartY;
      if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx) * 1.4) this.mobileNavigationVisible.set(dy < 0);
    }
    this.layoutTouchStartX = null;
    this.layoutTouchStartY = null;
  }

  openSettings() {
    this.settingsDialog.open(SettingsComponent, {
      autoFocus: false,
      restoreFocus: false,
    });
  }
}
