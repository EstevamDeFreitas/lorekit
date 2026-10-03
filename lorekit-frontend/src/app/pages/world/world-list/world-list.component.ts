import { inject, DestroyRef, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { CommonModule, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { WorldStateService } from '../../../services/world-state.service';
import {OverlayModule} from '@angular/cdk/overlay';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { TabManagerService } from '../../../services/tab-manager.service';

import { Dialog } from '@angular/cdk/dialog';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';

import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { buildFlatTreeViewNodes, filterFlatTreeViewNodes, TreeViewNode } from '../../../components/entity-lateral-menu/tree-view.models';
@Component({
  selector: 'app-world-list',
  imports: [CommonModule, FormsModule, IconButtonComponent, ComboBoxComponent, NgClass, OverlayModule, FormOverlayDirective, TreeViewListComponent],
  templateUrl: './world-list.component.html',
  styleUrl: './world-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldListComponent {
  private readonly destroyRef = inject(DestroyRef);
  worldCreationOpen = false;
  newWorldName = '';

  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  showsidebar = true;
  panelMode = input<boolean>(false);
  tabManager = inject(TabManagerService);

  safeDeleteDialog = inject(Dialog);


  deleteWorld(worldId: string) {

    const world = this.worldService.getWorldById(worldId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: world.name,
        entityTable: 'World',
        entityId: worldId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  worlds: World[] = [];
  filteredWorlds: World[] = [];
  worldTreeNodes: TreeViewNode[] = [];
  filteredWorldTreeNodes: TreeViewNode[] = [];
  selectedWorldFilter = '';
  searchTerm = '';

  currentWorldId = '';
  selectedEntityId = '';
  showEntityEditor = false;
  worldInfoComponent: any = null;

  constructor(private worldService: WorldService, private worldStateService : WorldStateService, private router:Router) { }

  ngOnInit() {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      this.currentWorldId = world ? world.id : '';
    })
    this.loadWorlds();
  }

  trackById(index: number, world: World) {
    return world.id;
  }

  loadWorlds() {
    this.worlds = this.worldService.getWorlds().sort((a, b) => a.name.localeCompare(b.name));
    this.worldTreeNodes = buildFlatTreeViewNodes(this.worlds, world => world.name);
    this.filterWorlds();
  }

  filterWorlds() {
    const worldNodes = this.selectedWorldFilter
      ? this.worldTreeNodes.filter(node => node.id === this.selectedWorldFilter)
      : this.worldTreeNodes;

    this.filteredWorldTreeNodes = filterFlatTreeViewNodes(worldNodes, this.searchTerm);
    const visibleIds = new Set(this.filteredWorldTreeNodes.map(node => node.id));
    this.filteredWorlds = this.worlds.filter(world => visibleIds.has(world.id));
  }

  clearWorldFilters() {
    this.searchTerm = '';
    this.selectedWorldFilter = '';
    this.filterWorlds();
  }

  onWorldSelected(worldId : string) {
    const world = this.worlds.find(w => w.id === worldId);

    if (!world) {
      return;
    }

    this.router.navigate(['/app/world/info', worldId]);
  }

  getWorldColor(world: World): string {
    const color = this.getPersonalizationValue(world, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createWorld(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    const newWorld: World = {
      id: '',
      name: formData['name'],
      description: ''
    };

    this.worldService.createWorld(newWorld);
    this.worldCreationOpen = false;
    this.loadWorlds();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
    ];
  }

  async openNewTabEntity(entityId: string) {
    if (this.panelMode()) {
      const world = this.worlds.find(w => w.id === entityId);
      const icon = this.getPersonalizationValue(world, 'icon') || 'fa-solid fa-earth';
      this.tabManager.openTab('World', entityId, world?.name ?? 'Mundo', icon);
      this.selectedEntityId = entityId;
      return;
    }
    if (this.selectedEntityId === entityId) {
      return;
    }

    this.showEntityEditor = false;
    this.selectedEntityId = '';

    if (!this.worldInfoComponent) {
      const { WorldInfoComponent } = await import('../world-info/world-info.component');
      this.worldInfoComponent = WorldInfoComponent;
    }

    setTimeout(() => {
      this.selectedEntityId = entityId;
      this.showEntityEditor = true;
    }, 0);
  }

  async selectEntity(entityId: string) {
    if (this.panelMode()) {
      const world = this.worlds.find(w => w.id === entityId);
      const icon = this.getPersonalizationValue(world, 'icon') || 'fa-solid fa-earth';
      this.tabManager.substituteCurrentTab('World', entityId, world?.name ?? 'Mundo', icon);
      this.selectedEntityId = entityId;
      return;
    }
    if (this.selectedEntityId === entityId) {
      return;
    }

    this.showEntityEditor = false;
    this.selectedEntityId = '';

    if (!this.worldInfoComponent) {
      const { WorldInfoComponent } = await import('../world-info/world-info.component');
      this.worldInfoComponent = WorldInfoComponent;
    }

    setTimeout(() => {
      this.selectedEntityId = entityId;
      this.showEntityEditor = true;
    }, 0);
  }

  buildCardBgStyle(filePath?: string | null) {
    const url = this.buildImageUrl(filePath);
    return url
      ? {
          'background-image':
            `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${url})`,
          'background-size': 'cover',
          'background-position': 'center',
        }
      : null;
  }

  getWorldCardStyle(world: World) {
    const image = this.getImageByUsageKey(world.Images, 'default');
    const imageStyle = this.buildCardBgStyle(image?.filePath);

    return imageStyle ?? {
      'background-color': this.getPersonalizationValue(world, 'color') || 'var(--color-zinc-800)',
    };
  }

  setWorldAsDefault(world: World) {
    if (this.currentWorldId === world.id) {
      this.worldStateService.clearWorld();
      return;
    }
    this.worldStateService.setWorld(world);
  }

}
