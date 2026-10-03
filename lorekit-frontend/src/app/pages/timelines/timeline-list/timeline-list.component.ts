import { Dialog } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';
import { Timeline } from '../../../models/timeline.model';
import { World } from '../../../models/world.model';
import { TabManagerService } from '../../../services/tab-manager.service';
import { TimelineService } from '../../../services/timeline.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-timeline-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  templateUrl: './timeline-list.component.html',
  styleUrl: './timeline-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly timelineService = inject(TimelineService);
  private readonly worldService = inject(WorldService);
  private readonly worldStateService = inject(WorldStateService);
  private readonly safeDeleteDialog = inject(Dialog);

  timelines: Timeline[] = [];
  filteredTimelines: Timeline[] = [];
  searchTerm = '';
  availableWorlds: World[] = [];
  selectedWorldId = '';
  panelMode = input<boolean>(false);
  tabManager = inject(TabManagerService);
  showsidebar = true;
  selectedTimelineId = '';
  showTimelineEditor = false;
  timelineEditComponent: any = null;

  ngOnInit() {
    this.availableWorlds = this.worldService.getWorlds();

    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      this.selectedWorldId = world?.id || '';
      this.loadTimelines();
    });

    this.loadTimelines();
  }

  loadTimelines() {
    this.timelines = this.timelineService.getTimelines(this.selectedWorldId || undefined).sort((a, b) => a.name.localeCompare(b.name));
    this.filterTimelines();

    if (this.selectedTimelineId && !this.timelines.some(timeline => timeline.id === this.selectedTimelineId)) {
      this.selectedTimelineId = '';
      this.showTimelineEditor = false;
    }
  }

  filterTimelines() {
    const term = this.searchTerm.trim().toLocaleLowerCase();
    this.filteredTimelines = this.timelines.filter(timeline =>
      !term || timeline.name.toLocaleLowerCase().includes(term)
    );
  }

  clearTimelineFilters() {
    this.searchTerm = '';
    this.selectedWorldId = '';
    this.onWorldSelect();
  }

  onWorldSelect() {
    this.loadTimelines();
  }

  deleteTimeline(timelineId: string) {
    const timeline = this.timelineService.getTimelineById(timelineId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: timeline.name,
        entityTable: 'Timeline',
        entityId: timelineId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.selectedWorldId || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
    ];
  }

  createTimeline(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    this.timelineService.saveTimeline(new Timeline('', name, ''), this.selectedWorldId || formData['world'] || null);
    this.loadTimelines();
  }

  async newTabTimeline(timelineId: string) {
    if (this.panelMode()) {
      const timeline = this.timelines.find(item => item.id === timelineId);
      this.tabManager.openTab('Timeline', timelineId, timeline?.name ?? 'Linha do Tempo', 'fa-solid fa-timeline');
      this.selectedTimelineId = timelineId;
      return;
    }
    if (this.selectedTimelineId === timelineId) {
      return;
    }

    this.showTimelineEditor = false;
    this.selectedTimelineId = '';

    if (!this.timelineEditComponent) {
      const { TimelineEditComponent } = await import('../timeline-edit/timeline-edit.component');
      this.timelineEditComponent = TimelineEditComponent;
    }

    setTimeout(() => {
      this.selectedTimelineId = timelineId;
      this.showTimelineEditor = true;
    }, 0);
  }

  async selectTimeline(timelineId: string) {
    if (this.panelMode()) {
      const timeline = this.timelines.find(item => item.id === timelineId);
      this.tabManager.substituteCurrentTab('Timeline', timelineId, timeline?.name ?? 'Linha do Tempo', 'fa-solid fa-timeline');
      this.selectedTimelineId = timelineId;
      return;
    }
    if (this.selectedTimelineId === timelineId) {
      return;
    }

    this.showTimelineEditor = false;
    this.selectedTimelineId = '';

    if (!this.timelineEditComponent) {
      const { TimelineEditComponent } = await import('../timeline-edit/timeline-edit.component');
      this.timelineEditComponent = TimelineEditComponent;
    }

    setTimeout(() => {
      this.selectedTimelineId = timelineId;
      this.showTimelineEditor = true;
    }, 0);
  }
}
