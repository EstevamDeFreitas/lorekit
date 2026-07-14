import { Dialog } from '@angular/cdk/dialog';
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';
import { Moodboard } from '../../../models/moodboard.model';
import { World } from '../../../models/world.model';
import { MoodboardService } from '../../../services/moodboard.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-moodboard-list',
  imports: [NgClass, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  templateUrl: './moodboard-list.component.html',
  styleUrl: './moodboard-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoodboardListComponent implements OnInit {
  private readonly moodboardService = inject(MoodboardService);
  private readonly worldService = inject(WorldService);
  private readonly worldStateService = inject(WorldStateService);
  private readonly tabManager = inject(TabManagerService);
  private readonly safeDeleteDialog = inject(Dialog);

  panelMode = input<boolean>(false);

  moodboards: Moodboard[] = [];
  filteredMoodboards: Moodboard[] = [];
  availableWorlds: World[] = [];
  selectedWorldId = '';
  manualWorldFilter = '';
  selectedMoodboardId = '';
  searchTerm = '';
  showsidebar = true;

  ngOnInit(): void {
    this.availableWorlds = this.worldService.getWorlds();

    this.worldStateService.currentWorld$.subscribe(world => {
      this.selectedWorldId = world?.id || '';
      if (this.selectedWorldId) {
        this.manualWorldFilter = '';
      }
      this.loadMoodboards();
    });

    this.loadMoodboards();
  }

  loadMoodboards(): void {
    const activeWorldId = this.selectedWorldId || this.manualWorldFilter || null;
    this.moodboards = this.moodboardService.getMoodboards(activeWorldId);
    this.filterMoodboards();

    if (this.selectedMoodboardId && !this.moodboards.some(moodboard => moodboard.id === this.selectedMoodboardId)) {
      this.selectedMoodboardId = '';
    }
  }

  onWorldSelect(): void {
    this.loadMoodboards();
  }

  filterMoodboards(): void {
    const term = this.searchTerm.trim().toLocaleLowerCase();
    this.filteredMoodboards = term
      ? this.moodboards.filter(moodboard => (moodboard.name || '').toLocaleLowerCase().includes(term))
      : this.moodboards;
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      {
        key: 'world',
        label: 'Mundo',
        value: this.selectedWorldId || this.manualWorldFilter || '',
        options: this.availableWorlds,
        optionCompareProp: 'id',
        optionDisplayProp: 'name',
        clearable: true,
      },
    ];
  }

  createMoodboard(formData: Record<string, string>): void {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const worldId = this.selectedWorldId || this.manualWorldFilter || formData['world'] || null;
    const moodboard = this.moodboardService.saveMoodboard(new Moodboard('', name), worldId);
    this.loadMoodboards();
    this.openMoodboard(moodboard.id);
  }

  selectMoodboard(moodboardId: string): void {
    const moodboard = this.moodboards.find(item => item.id === moodboardId);
    this.selectedMoodboardId = moodboardId;
    this.tabManager.substituteCurrentTab('Moodboard', moodboardId, moodboard?.name || 'Moodboard', 'fa-solid fa-table-cells-large');
  }

  openMoodboard(moodboardId: string): void {
    const moodboard = this.moodboards.find(item => item.id === moodboardId);
    this.selectedMoodboardId = moodboardId;
    this.tabManager.openTab('Moodboard', moodboardId, moodboard?.name || 'Moodboard', 'fa-solid fa-table-cells-large');
  }

  deleteMoodboard(moodboard: Moodboard): void {
    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: moodboard.name || 'Moodboard',
        entityTable: 'Moodboard',
        entityId: moodboard.id,
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }
}
