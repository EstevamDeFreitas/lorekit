import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  Type,
} from '@angular/core';
import { AsyncPipe, NgComponentOutlet } from '@angular/common';
import { TabManagerService } from '../../services/tab-manager.service';
import { NgClass } from '@angular/common';

interface SidebarSectionEntry {
  label: string;
  icon: string;
  loader: () => Promise<Type<any>>;
}

const SIDEBAR_SECTIONS: Record<string, SidebarSectionEntry> = {
  world: {
    label: 'Mundos',
    icon: 'fa-solid fa-earth',
    loader: () =>
      import('../../pages/world/world-list/world-list.component').then(
        m => m.WorldListComponent
      ),
  },
  location: {
    label: 'Localidades',
    icon: 'fa-solid fa-location-dot',
    loader: () =>
      import('../../pages/locations/location-list/location-list.component').then(
        m => m.LocationListComponent
      ),
  },
  document: {
    label: 'Documentos',
    icon: 'fa-solid fa-file',
    loader: () =>
      import('../../pages/documents/document-list/document-list.component').then(
        m => m.DocumentListComponent
      ),
  },
  timeline: {
    label: 'Linhas do Tempo',
    icon: 'fa-solid fa-timeline',
    loader: () =>
      import('../../pages/timelines/timeline-list/timeline-list.component').then(
        m => m.TimelineListComponent
      ),
  },
  moodboard: {
    label: 'Moodboards',
    icon: 'fa-solid fa-table-cells-large',
    loader: () =>
      import('../../pages/moodboards/moodboard-list/moodboard-list.component').then(
        m => m.MoodboardListComponent
      ),
  },
  specie: {
    label: 'Espécies',
    icon: 'fa-solid fa-paw',
    loader: () =>
      import('../../pages/species/specie-list/specie-list.component').then(
        m => m.SpecieListComponent
      ),
  },
  character: {
    label: 'Personagens',
    icon: 'fa-solid fa-users',
    loader: () =>
      import('../../pages/characters/character-list/character-list.component').then(
        m => m.CharacterListComponent
      ),
  },
  culture: {
    label: 'Culturas',
    icon: 'fa-solid fa-mortar-pestle',
    loader: () =>
      import('../../pages/cultures/culture-list/culture-list.component').then(
        m => m.CultureListComponent
      ),
  },
  organization: {
    label: 'Organizações',
    icon: 'fa-solid fa-building',
    loader: () =>
      import('../../pages/organizations/organization-list/organization-list.component').then(
        m => m.OrganizationListComponent
      ),
  },
  object: {
    label: 'Objetos',
    icon: 'fa-solid fa-cube',
    loader: () =>
      import('../../pages/objects/object-list/object-list.component').then(
        m => m.ObjectListComponent
      ),
  },


  //IRONPAW
  'character-sheet': {
    label: 'Fichas de Personagem',
    icon: 'fa-solid fa-address-card',
    loader: () =>
      import('../../pages/ironpaw/irpw-character-sheet/irpw-character-sheet-list.component').then(
        m => m.IrpwCharacterSheetListComponent
      ),
    },
  vocations: {
    label: 'Vocações',
    icon: 'fa-solid fa-hat-wizard',
    loader: () =>
      import('../../pages/ironpaw/irpw-vocations/irpw-vocations-list.component').then(
        m => m.IrpwVocationsListComponent
      ),
  },
};

@Component({
  selector: 'app-sidebar-panel',
  standalone: true,
  imports: [AsyncPipe, NgComponentOutlet, NgClass],
  template: `
    @if (layout$ | async; as layout) {
      @if (resolvedComponent()) {
        <div [ngClass]="layout.sidebarVisible ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0'" class="flex flex-col border-r bg-zinc-925 border-zinc-700 h-full overflow-hidden">
          <!-- Section header -->
          <div class="flex flex-row items-center justify-between px-4 py-2 border-b border-zinc-700 shrink-0">
            <div class="flex flex-row items-center gap-2 p-[0.1rem] text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <i [class]="currentSectionIcon()" class="text-[10px]"></i>
              <span>{{ currentSectionLabel() }}</span>
            </div>
            <!-- <button
              type="button"
              class="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Ocultar painel"
              (click)="tabManager.toggleSidebar()">
              <i class="fa-solid fa-angles-left text-xs"></i>
            </button> -->
          </div>
          <!-- List component rendered in panel mode -->
          <div class="flex-1 h-full overflow-y-auto scrollbar-dark">
            <ng-container
              *ngComponentOutlet="resolvedComponent()!; inputs: { panelMode: true }">
            </ng-container>
          </div>
        </div>
        <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-11 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[layout.sidebarVisible ? 'start-88' : 'start-12']" (click)="tabManager.toggleSidebar()">
          <i class="fa-solid text-zinc-400" [ngClass]="[layout.sidebarVisible ? 'fa-angles-left' : 'fa-angles-right']"></i>
        </small>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarPanelComponent implements OnInit {
  tabManager = inject(TabManagerService);
  layout$ = this.tabManager.layout$;

  resolvedComponent = signal<Type<any> | null>(null);
  currentSectionLabel = signal<string>('');
  currentSectionIcon = signal<string>('');

  private lastSection = '';

  ngOnInit(): void {
    this.layout$.subscribe(layout => {
      const section = layout.activeSidebarSection;
      if (section !== this.lastSection) {
        this.lastSection = section;
        this.loadSection(section);
      }
    });
  }

  private async loadSection(section: string): Promise<void> {
    const entry = SIDEBAR_SECTIONS[section];
    if (!entry) {
      this.resolvedComponent.set(null);
      return;
    }
    this.currentSectionLabel.set(entry.label);
    this.currentSectionIcon.set(entry.icon);
    const component = await entry.loader();
    this.resolvedComponent.set(component);
  }
}
