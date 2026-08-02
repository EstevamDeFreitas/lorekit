import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { SettingsComponent } from '../../settings/settings/settings.component';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { WorkspaceComponent } from '../../../components/workspace/workspace.component';
import { SidebarPanelComponent } from '../../../components/sidebar-panel/sidebar-panel.component';
import { TabManagerService } from '../../../services/tab-manager.service';

@Component({
  selector: 'app-main-ui',
  imports: [AsyncPipe, NavButtonComponent, WorkspaceComponent, SidebarPanelComponent],
  template: `
  @if (tabManager.layout$ | async; as layout) {
  <div class="h-dvh w-full overflow-hidden flex flex-col pt-9">
  <div class="relative flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden" (touchstart)="onLayoutTouchStart($event)" (touchend)="onLayoutTouchEnd($event)">

    <!-- Activity bar (icon strip) -->
    <div class="flex flex-row md:flex-col bg-zinc-900 items-center md:items-stretch md:justify-between px-2 md:ps-4 md:w-15 h-14 md:h-auto border-b md:border-b-0 md:border-r py-2 md:pt-4 md:pb-4 border-zinc-700 shrink-0 overflow-x-auto scrollbar-hide">
      <div class="flex flex-row md:flex-col items-center md:items-stretch min-w-max shrink-0">
        <div class="w-8 shrink-0 me-4 md:me-0 md:pr-3 md:mb-8">
          <img src="assets/lorekit-logo.png" alt="Lorekit">
        </div>
        <div class="flex flex-row md:flex-col gap-3 md:gap-4 mb-0 md:mb-4">
          <app-nav-button [label]="'Mundos'" [showLabel]="false" [icon]="'fa-solid fa-earth'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'world'"
            activeColor="yellow-400"
            (click)="tabManager.setActiveSidebarSection('world')"></app-nav-button>
          <app-nav-button [label]="'Localidades'" [showLabel]="false" [icon]="'fa-solid fa-location-dot'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'location'"
            activeColor="emerald-400"
            (click)="tabManager.setActiveSidebarSection('location')"></app-nav-button>
          <app-nav-button [label]="'Documentos'" [showLabel]="false" [icon]="'fa-solid fa-file'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'document'"
            activeColor="olive-400"
            (click)="tabManager.setActiveSidebarSection('document')"></app-nav-button>
          <app-nav-button [label]="'Linhas do Tempo'" [showLabel]="false" [icon]="'fa-solid fa-timeline'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'timeline'"
            activeColor="mist-400"
            (click)="tabManager.setActiveSidebarSection('timeline')"></app-nav-button>
          <app-nav-button [label]="'Moodboards'" [showLabel]="false" [icon]="'fa-solid fa-table-cells-large'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'moodboard'"
            activeColor="pink-400"
            (click)="tabManager.setActiveSidebarSection('moodboard')"></app-nav-button>
          <app-nav-button [label]="'Espécies'" [showLabel]="false" [icon]="'fa-solid fa-paw'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'specie'"
            activeColor="lime-400"
            (click)="tabManager.setActiveSidebarSection('specie')"></app-nav-button>
          <app-nav-button [label]="'Personagens'" [showLabel]="false" [icon]="'fa-solid fa-users'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'character'"
            activeColor="sky-400"
            (click)="tabManager.setActiveSidebarSection('character')"></app-nav-button>
          <app-nav-button [label]="'Culturas'" [showLabel]="false" [icon]="'fa-solid fa-mortar-pestle'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'culture'"
            activeColor="amber-400"
            (click)="tabManager.setActiveSidebarSection('culture')"></app-nav-button>
          <app-nav-button [label]="'Organizações'" [showLabel]="false" [icon]="'fa-solid fa-building'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'organization'"
            activeColor="blue-400"
            (click)="tabManager.setActiveSidebarSection('organization')"></app-nav-button>
          <app-nav-button [label]="'Objetos'" [showLabel]="false" [icon]="'fa-solid fa-cube'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'object'"
            activeColor="rose-400"
            (click)="tabManager.setActiveSidebarSection('object')"></app-nav-button>
          <app-nav-button [label]="'Relações'" [showLabel]="false" [icon]="'fa-solid fa-share-nodes'" size="xl" [fullWidth]="true" [direction]="'right'"
            activeColor="green-400"
            (click)="tabManager.setActiveSidebarSection('relations')"></app-nav-button>
          <div class="border-b border-zinc-700 w-7.5"></div>
          <app-nav-button [label]="'Fichas de Personagem'" buttonType="pink" [showLabel]="false" [icon]="'fa-solid fa-address-card'" size="xl" [fullWidth]="true" [direction]="'right'"
            (click)="tabManager.setActiveSidebarSection('character-sheet')"></app-nav-button>
          <app-nav-button [label]="'Vocações'" buttonType="pink" [showLabel]="false" [icon]="'fa-solid fa-hat-wizard'" size="xl" [fullWidth]="true" [direction]="'right'"
            (click)="tabManager.setActiveSidebarSection('vocations')"></app-nav-button>
        </div>
      </div>

      <div class="ms-3 md:ms-0 shrink-0">
        <app-nav-button [label]="'Configurações'" (click)="openSettings()" [showLabel]="false" [icon]="'fa-solid fa-gears'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
      </div>
    </div>

    <!-- Sidebar panel (entity list for active section) -->
    <app-sidebar-panel />

    <!-- Workspace (tabbed editor panes) -->
    <div class="flex-1 min-h-0 min-w-0 h-full overflow-hidden">
      <app-workspace />
    </div>

  </div>
  </div>
  }
  `,
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainUiComponent {
  settingsDialog = inject(Dialog);
  tabManager = inject(TabManagerService);

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
