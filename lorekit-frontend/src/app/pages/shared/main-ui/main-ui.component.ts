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
  <div class="h-screen w-screen overflow-hidden flex flex-col pt-9">
  <div class="flex flex-row flex-1 overflow-hidden">

    <!-- Activity bar (icon strip) -->
    <div class="flex flex-col bg-zinc-900 justify-between ps-4 w-15 border-r pt-4 pb-4 border-zinc-700 shrink-0">
      <div>
        <div class="pr-3 mb-8">
          <img src="assets/lorekit-logo.png" alt="Lorekit">
        </div>
        <div class="flex flex-col gap-4 mb-4">
          <app-nav-button [label]="'Mundos'" [showLabel]="false" [icon]="'fa-solid fa-earth'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'world'"
            (click)="tabManager.setActiveSidebarSection('world')"></app-nav-button>
          <app-nav-button [label]="'Localidades'" [showLabel]="false" [icon]="'fa-solid fa-location-dot'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'location'"
            (click)="tabManager.setActiveSidebarSection('location')"></app-nav-button>
          <app-nav-button [label]="'Documentos'" [showLabel]="false" [icon]="'fa-solid fa-file'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'document'"
            (click)="tabManager.setActiveSidebarSection('document')"></app-nav-button>
          <app-nav-button [label]="'Linhas do Tempo'" [showLabel]="false" [icon]="'fa-solid fa-timeline'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'timeline'"
            (click)="tabManager.setActiveSidebarSection('timeline')"></app-nav-button>
          <app-nav-button [label]="'Moodboards'" [showLabel]="false" [icon]="'fa-solid fa-table-cells-large'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'moodboard'"
            (click)="tabManager.setActiveSidebarSection('moodboard')"></app-nav-button>
          <app-nav-button [label]="'Espécies'" [showLabel]="false" [icon]="'fa-solid fa-paw'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'specie'"
            (click)="tabManager.setActiveSidebarSection('specie')"></app-nav-button>
          <app-nav-button [label]="'Personagens'" [showLabel]="false" [icon]="'fa-solid fa-users'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'character'"
            (click)="tabManager.setActiveSidebarSection('character')"></app-nav-button>
          <app-nav-button [label]="'Culturas'" [showLabel]="false" [icon]="'fa-solid fa-mortar-pestle'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'culture'"
            (click)="tabManager.setActiveSidebarSection('culture')"></app-nav-button>
          <app-nav-button [label]="'Organizações'" [showLabel]="false" [icon]="'fa-solid fa-building'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'organization'"
            (click)="tabManager.setActiveSidebarSection('organization')"></app-nav-button>
          <app-nav-button [label]="'Objetos'" [showLabel]="false" [icon]="'fa-solid fa-cube'" size="xl" [fullWidth]="true" [direction]="'right'"
            [active]="layout.activeSidebarSection === 'object'"
            (click)="tabManager.setActiveSidebarSection('object')"></app-nav-button>
          <app-nav-button [label]="'Relações'" [showLabel]="false" [icon]="'fa-solid fa-share-nodes'" size="xl" [fullWidth]="true" [direction]="'right'"
            (click)="tabManager.setActiveSidebarSection('relations')"></app-nav-button>
          <div class="border-b border-zinc-700 w-7.5"></div>
          <app-nav-button [label]="'Fichas de Personagem'" buttonType="pink" [showLabel]="false" [icon]="'fa-solid fa-address-card'" size="xl" [fullWidth]="true" [direction]="'right'"
            (click)="tabManager.setActiveSidebarSection('character-sheet')"></app-nav-button>
          <app-nav-button [label]="'Vocações'" buttonType="pink" [showLabel]="false" [icon]="'fa-solid fa-hat-wizard'" size="xl" [fullWidth]="true" [direction]="'right'"
            (click)="tabManager.setActiveSidebarSection('vocations')"></app-nav-button>
        </div>
      </div>

      <div>
        <app-nav-button [label]="'Configurações'" (click)="openSettings()" [showLabel]="false" [icon]="'fa-solid fa-gears'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
      </div>
    </div>

    <!-- Sidebar panel (entity list for active section) -->
    <app-sidebar-panel />

    <!-- Workspace (tabbed editor panes) -->
    <div class="flex-1 h-full overflow-hidden">
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

  openSettings() {
    this.settingsDialog.open(SettingsComponent, {
      autoFocus: false,
      restoreFocus: false,
    });
  }
}
