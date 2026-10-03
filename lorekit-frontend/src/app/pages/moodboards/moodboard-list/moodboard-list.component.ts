import { Dialog } from '@angular/cdk/dialog';
import { inject, DestroyRef, ChangeDetectionStrategy, Component, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  imports: [FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  templateUrl: './moodboard-list.component.html',
  styleUrl: './moodboard-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoodboardListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
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
  selectedMoodboardId = '';
  searchTerm = '';
  showsidebar = true;

  ngOnInit(): void {
    this.availableWorlds = this.worldService.getWorlds();

    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      this.selectedWorldId = world?.id || '';
      this.loadMoodboards();
    });

    this.loadMoodboards();
  }

  loadMoodboards(): void {
    this.moodboards = this.moodboardService.getMoodboards(this.selectedWorldId || null);
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
    this.filteredMoodboards = this.moodboards.filter(moodboard =>
      !term || (moodboard.name || '').toLocaleLowerCase().includes(term)
    );
  }

  clearMoodboardFilters(): void {
    this.searchTerm = '';
    this.selectedWorldId = '';
    this.onWorldSelect();
  }
  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      {
        key: 'world',
        label: 'Mundo',
        value: this.selectedWorldId || '',
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

    const worldId = this.selectedWorldId || formData['world'] || null;
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

  deleteMoodboard(moodboardId: string): void {
    const moodboard = this.moodboards.find(item => item.id === moodboardId);
    if (!moodboard) {
      return;
    }

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
