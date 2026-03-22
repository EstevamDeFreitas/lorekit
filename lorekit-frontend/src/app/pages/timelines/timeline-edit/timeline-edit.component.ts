import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { TextAreaComponent } from "../../../components/text-area/text-area.component";
import { GreatMark } from '../../../models/great-mark.model';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { TimelineEvent } from '../../../models/timeline-event.model';
import { Timeline } from '../../../models/timeline.model';
import { EventService } from '../../../services/event.service';
import { GreatMarkService } from '../../../services/great-mark.service';
import { TimelineService } from '../../../services/timeline.service';
import { GreatMarkEditComponent } from '../great-mark-edit/great-mark-edit.component';
import { TimelineEventEditComponent } from '../timeline-event-edit/timeline-event-edit.component';

type EventSide = 'left' | 'right';

interface TimelineSectionViewModel {
  id: string;
  mark: GreatMark | null;
  events: TimelineEvent[];
  color: string | null;
  dropListId: string;
}

@Component({
  selector: 'app-timeline-edit',
  standalone: true,
  imports: [
    ButtonComponent,
    CdkDrag,
    CdkDropList,
    FormsModule,
    IconButtonComponent,
    NgClass,
    NgStyle,
    PersonalizationButtonComponent,
    SafeDeleteButtonComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="flex flex-col pb-20">
      <div class="sticky top-0 z-50 bg-zinc-950 py-2">
        <div class="flex items-center gap-3">
          @if (isRouteComponent()) {
            <app-icon-button buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/timeline"></app-icon-button>
          }
          <input
            type="text"
            class="flex-1 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-none"
            [(ngModel)]="timeline.name"
            (blur)="saveTimeline()"
          />
          <div class="flex items-center gap-2">
            <app-button label="Novo Grande Marco" buttonType="secondary" size="sm" (click)="openGreatMarkDialog(getDefaultTailMarkOrder())"></app-button>
            <app-personalization-button [entityId]="timeline.id" [entityTable]="'Timeline'" [size]="'xl'" (onClose)="loadTimeline()"></app-personalization-button>
            <app-safe-delete-button [entityName]="timeline.name" [entityId]="timeline.id" [entityTable]="'Timeline'" [size]="'xl'"></app-safe-delete-button>
          </div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 xl:grid-cols-[22rem_1fr] gap-6 items-start">
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sticky top-20 flex flex-col gap-4">
          <div>
            <h3 class="text-sm uppercase tracking-[0.2em] text-zinc-500">Resumo</h3>
            @if (timeline.ParentWorld) {
              <div class="mt-3 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm">
                <i class="fa-solid fa-earth text-zinc-400"></i>
                <span>{{ timeline.ParentWorld.name }}</span>
              </div>
            }
            @else {
              <div class="mt-3 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm">
                <i class="fa-solid fa-globe text-zinc-400"></i>
                <span>Timeline global</span>
              </div>
            }
          </div>

          <app-text-area label="Conceito" [(value)]="timeline.concept" height="h-24"></app-text-area>
          <app-text-area label="Descrição" [(value)]="timeline.description" height="h-40"></app-text-area>

          <div class="flex justify-end">
            <app-button label="Salvar detalhes" buttonType="primary" size="sm" (click)="saveTimeline()"></app-button>
          </div>
        </div>

        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 min-h-[70vh]">
          <div class="relative min-h-[60vh] py-6">
            <div class="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-zinc-800"></div>

            <div class="relative z-10 flex flex-col gap-6">
              <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div></div>
                <button
                  type="button"
                  class="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm cursor-pointer hover:border-zinc-400"
                  (click)="openEventDialog(getInitialInsertOrder())">
                  Adicionar evento no início
                </button>
                <div></div>
              </div>

              @for (section of sections; track section.id; let sectionIndex = $index) {
                @if (section.mark) {
                  <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div></div>
                    <button
                      type="button"
                      class="rounded-2xl px-5 py-4 shadow-lg border cursor-pointer min-w-72 bg-zinc-900/90"
                      [ngStyle]="buildGreatMarkStyle(section.mark)"
                      (click)="openGreatMarkDialog(section.mark.sortOrder, section.mark.id)">
                      <div class="text-xs uppercase tracking-[0.22em] opacity-70 mb-2">Grande Marco</div>
                      <div class="font-semibold text-lg">{{ section.mark.name }}</div>
                      @if (section.mark.concept) {
                        <div class="text-sm opacity-80 mt-2 line-clamp-3">{{ section.mark.concept }}</div>
                      }
                    </button>
                    <div></div>
                  </div>

                  <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div></div>
                    <button
                      type="button"
                      class="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm cursor-pointer hover:border-zinc-400"
                      (click)="openEventDialog(getAfterMarkInsertOrder(sectionIndex))">
                      Adicionar evento após este grande marco
                    </button>
                    <div></div>
                  </div>
                }

                <div
                  cdkDropList
                  [id]="section.dropListId"
                  [cdkDropListData]="section.events"
                  [cdkDropListConnectedTo]="connectedDropLists"
                  class="flex flex-col gap-5"
                  (cdkDropListDropped)="onDrop($event)">
                  @for (event of section.events; track event.id) {
                    @let side = eventSides[event.id] || 'left';
                    <div cdkDrag class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                      @if (side === 'left') {
                        <button
                          type="button"
                          class="group rounded-2xl border border-zinc-800 p-4 text-left cursor-pointer hover:border-zinc-600"
                          [style.border-left-width.px]="4"
                          [style.border-left-color]="section.color || '#71717A'"
                          [ngStyle]="buildEventCardStyle(event)"
                          [class.text-white]="hasBackgroundImage(event)"
                          [ngClass]="!hasBackgroundImage(event) ? getTextClass(getPersonalizationValue(event, 'color') || undefined) : ''"
                          (click)="openEventDialog(event.chronologyOrder, event.id)">
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-xs uppercase tracking-[0.2em] opacity-70">{{ event.date || 'Sem data' }}</div>
                            @if (event.ParentEventType) {
                              <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white">{{ event.ParentEventType.name }}</span>
                            }
                          </div>
                          <h4 class="mt-2 text-base font-semibold">{{ event.name }}</h4>
                          <p class="mt-2 text-sm opacity-85 line-clamp-3">{{ event.concept || event.description || 'Sem resumo definido.' }}</p>
                          <div class="mt-3 flex flex-wrap gap-2">
                            @if (event.ParentLocation) {
                              <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white">
                                <i class="fa-solid fa-location-dot me-1"></i>{{ event.ParentLocation.name }}
                              </span>
                            }
                          </div>
                        </button>
                      }
                      @else {
                        <div></div>
                      }

                      <div class="flex flex-col items-center gap-2">
                        <div class="w-5 h-5 rounded-full border-4 border-zinc-950 shadow-lg" [style.background-color]="section.color || '#71717A'"></div>
                        <i class="fa-solid fa-grip-lines text-xs text-zinc-500"></i>
                      </div>

                      @if (side === 'right') {
                        <button
                          type="button"
                          class="group rounded-2xl border border-zinc-800 p-4 text-left cursor-pointer hover:border-zinc-600"
                          [style.border-left-width.px]="4"
                          [style.border-left-color]="section.color || '#71717A'"
                          [ngStyle]="buildEventCardStyle(event)"
                          [class.text-white]="hasBackgroundImage(event)"
                          [ngClass]="!hasBackgroundImage(event) ? getTextClass(getPersonalizationValue(event, 'color') || undefined) : ''"
                          (click)="openEventDialog(event.chronologyOrder, event.id)">
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-xs uppercase tracking-[0.2em] opacity-70">{{ event.date || 'Sem data' }}</div>
                            @if (event.ParentEventType) {
                              <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white">{{ event.ParentEventType.name }}</span>
                            }
                          </div>
                          <h4 class="mt-2 text-base font-semibold">{{ event.name }}</h4>
                          <p class="mt-2 text-sm opacity-85 line-clamp-3">{{ event.concept || event.description || 'Sem resumo definido.' }}</p>
                          <div class="mt-3 flex flex-wrap gap-2">
                            @if (event.ParentLocation) {
                              <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white">
                                <i class="fa-solid fa-location-dot me-1"></i>{{ event.ParentLocation.name }}
                              </span>
                            }
                          </div>
                        </button>
                      }
                      @else {
                        <div></div>
                      }
                    </div>
                  }

                  @if (section.events.length === 0) {
                    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div></div>
                      <div class="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-500">
                        Nenhum evento nesta parte da timeline.
                      </div>
                      <div></div>
                    </div>
                  }
                </div>

                <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div></div>
                  <button
                    type="button"
                    class="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm cursor-pointer hover:border-zinc-400"
                    (click)="openEventDialog(getBetweenSectionsInsertOrder(sectionIndex))">
                    {{ getBetweenSectionsLabel(sectionIndex) }}
                  </button>
                  <div></div>
                </div>

                <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div></div>
                  <button
                    type="button"
                    class="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    (click)="openGreatMarkDialog(getBoundaryMarkOrder(sectionIndex))">
                    Inserir grande marco aqui
                  </button>
                  <div></div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './timeline-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineEditComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly timelineService = inject(TimelineService);
  private readonly greatMarkService = inject(GreatMarkService);
  private readonly eventService = inject(EventService);

  private readonly MARK_SPACING = 100000;
  private readonly EVENT_SPACING = 100;

  dialogRef = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  timeline = new Timeline();
  greatMarks: GreatMark[] = [];
  events: TimelineEvent[] = [];
  sections: TimelineSectionViewModel[] = [{
    id: 'section-initial',
    mark: null,
    events: [],
    color: null,
    dropListId: 'timeline-section-initial',
  }];
  connectedDropLists: string[] = ['timeline-section-initial'];
  eventSides: Record<string, EventSide> = {};
  public readonly getPersonalizationValue = getPersonalizationValue;
  public readonly getTextClass = getTextClass;

  readonly timelineId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('timelineId') ?? '';
  });

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === TimelineEditComponent ||
      this.activatedRoute.component === TimelineEditComponent;
  });

  constructor() {
    this.loadTimeline();
  }

  loadTimeline() {
    const id = this.timelineId();
    if (!id) {
      return;
    }

    this.timeline = this.timelineService.getTimelineById(id);
    this.greatMarks = this.greatMarkService.getGreatMarksByTimelineId(id).sort((a, b) => a.sortOrder - b.sortOrder);
    this.events = this.eventService.getEventsByTimelineId(id).sort((a, b) => a.sortOrder - b.sortOrder);
    this.buildSections();
  }

  saveTimeline() {
    if (!this.timeline.id || !this.timeline.name.trim()) {
      return;
    }

    this.timelineService.saveTimeline(this.timeline, this.timeline.ParentWorld?.id || null);
  }

  buildSections() {
    const marks = [...this.greatMarks].sort((a, b) => a.sortOrder - b.sortOrder);
    const sortedEvents = [...this.events].sort((a, b) => a.sortOrder - b.sortOrder);

    const initialSection: TimelineSectionViewModel = {
      id: 'section-initial',
      mark: null,
      events: [],
      color: null,
      dropListId: 'timeline-section-initial',
    };

    const builtSections: TimelineSectionViewModel[] = [initialSection];

    for (const [markIndex, mark] of marks.entries()) {
      const nextMark = marks[markIndex + 1];
      builtSections.push({
        id: `section-${mark.id}`,
        mark,
        events: sortedEvents.filter(event =>
          event.sortOrder > mark.sortOrder &&
          (!nextMark || event.sortOrder < nextMark.sortOrder)
        ),
        color: getPersonalizationValue(mark, 'color'),
        dropListId: `timeline-section-${mark.id}`,
      });
    }

    const firstMark = marks[0];
    initialSection.events = firstMark
      ? sortedEvents.filter(event => event.sortOrder < firstMark.sortOrder)
      : sortedEvents;

    this.sections = builtSections;
    this.connectedDropLists = builtSections.map(section => section.dropListId);
    this.assignEventSides();
  }

  assignEventSides() {
    const sides: Record<string, EventSide> = {};
    let absoluteIndex = 0;

    for (const section of this.sections) {
      for (const event of section.events) {
        sides[event.id] = absoluteIndex % 2 === 0 ? 'left' : 'right';
        absoluteIndex++;
      }
    }

    this.eventSides = sides;
  }

  onDrop(event: CdkDragDrop<TimelineEvent[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }

    this.normalizeTimelineOrdering();
  }

  openGreatMarkDialog(defaultSortOrder: number, markId?: string) {
    const dialogRef = this.dialog.open(GreatMarkEditComponent, {
      panelClass: 'screen-dialog',
      data: {
        id: markId,
        timelineId: this.timeline.id,
        defaultSortOrder,
      },
    });

    dialogRef.closed.subscribe((result: any) => {
      if (result?.saved || result?.deleted) {
        this.loadTimeline();
        this.normalizeTimelineOrdering();
      }
    });
  }

  openEventDialog(defaultSortOrder: number, eventId?: string) {
    const dialogRef = this.dialog.open(TimelineEventEditComponent, {
      panelClass: ['screen-dialog', 'overflow-visible'],
      width: '90vw',
      maxWidth: '980px',
      data: {
        id: eventId,
        timelineId: this.timeline.id,
        defaultSortOrder,
        worldId: this.timeline.ParentWorld?.id || null,
      },
    });

    dialogRef.closed.subscribe((result: any) => {
      if (result?.saved || result?.deleted) {
        this.loadTimeline();

        if (result?.reorderRequired || result?.deleted) {
          this.persistLoadedEventOrdering();
        }
      }
    });
  }

  persistLoadedEventOrdering() {
    this.events = [...this.events].sort((a, b) => a.chronologyOrder - b.chronologyOrder);
    this.buildSections();
    this.normalizeTimelineOrdering();
  }

  normalizeTimelineOrdering() {
    const markUpdates: Array<Pick<GreatMark, 'id' | 'sortOrder'>> = [];
    const eventUpdates: Array<Pick<TimelineEvent, 'id' | 'sortOrder' | 'chronologyOrder'>> = [];

    this.sections[0]?.events.forEach((timelineEvent, index) => {
      const order = (index + 1) * this.EVENT_SPACING;
      timelineEvent.sortOrder = order;
      timelineEvent.chronologyOrder = order;
      eventUpdates.push({
        id: timelineEvent.id,
        sortOrder: order,
        chronologyOrder: order,
      });
    });

    for (let sectionIndex = 1; sectionIndex < this.sections.length; sectionIndex++) {
      const section = this.sections[sectionIndex];
      const markOrder = sectionIndex * this.MARK_SPACING;

      if (section.mark) {
        section.mark.sortOrder = markOrder;
        markUpdates.push({
          id: section.mark.id,
          sortOrder: markOrder,
        });
      }

      section.events.forEach((timelineEvent, eventIndex) => {
        const order = markOrder + ((eventIndex + 1) * this.EVENT_SPACING);
        timelineEvent.sortOrder = order;
        timelineEvent.chronologyOrder = order;
        eventUpdates.push({
          id: timelineEvent.id,
          sortOrder: order,
          chronologyOrder: order,
        });
      });
    }

    if (markUpdates.length > 0) {
      this.greatMarkService.saveGreatMarkOrdering(markUpdates);
    }

    if (eventUpdates.length > 0) {
      this.eventService.saveEventOrdering(eventUpdates);
    }

    this.loadTimeline();
  }

  getInitialInsertOrder() {
    const firstEvent = this.sections[0]?.events[0];
    return firstEvent ? Math.max(1, firstEvent.sortOrder - 1) : this.EVENT_SPACING;
  }

  getAfterMarkInsertOrder(sectionIndex: number) {
    const mark = this.sections[sectionIndex]?.mark;
    return mark ? mark.sortOrder + 1 : this.getInitialInsertOrder();
  }

  getBetweenSectionsInsertOrder(sectionIndex: number) {
    const section = this.sections[sectionIndex];
    const nextSection = this.sections[sectionIndex + 1];
    const lastEvent = section?.events.at(-1);
    const anchor = lastEvent?.sortOrder ?? section?.mark?.sortOrder ?? 0;

    if (nextSection?.mark) {
      return Math.max(anchor + 1, nextSection.mark.sortOrder - 1);
    }

    return anchor + this.EVENT_SPACING;
  }

  getBetweenSectionsLabel(sectionIndex: number) {
    return this.sections[sectionIndex + 1]?.mark ? 'Adicionar evento entre seções' : 'Adicionar evento no final da timeline';
  }

  getDefaultTailMarkOrder() {
    const lastMark = [...this.greatMarks].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
    const lastEvent = [...this.events].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
    const lower = Math.max(lastMark?.sortOrder || 0, lastEvent?.sortOrder || 0);
    return lower + this.MARK_SPACING;
  }

  getBoundaryMarkOrder(sectionIndex: number) {
    const nextSection = this.sections[sectionIndex + 1];
    if (nextSection?.mark) {
      return nextSection.mark.sortOrder - 1;
    }

    const section = this.sections[sectionIndex];
    const anchor = section?.events.at(-1)?.sortOrder ?? section?.mark?.sortOrder ?? 0;
    return anchor + this.MARK_SPACING;
  }

  buildGreatMarkStyle(mark: GreatMark) {
    const color = getPersonalizationValue(mark, 'color') || '#3F3F46';
    const image = getImageByUsageKey(mark.Images, 'default');

    if (image?.filePath) {
      return {
        'background-image': `linear-gradient(to bottom, rgba(24,24,27,0.35), rgba(24,24,27,0.88)), url(${buildImageUrl(image.filePath)})`,
        'background-size': 'cover',
        'background-position': 'center',
        'border-color': color,
        'color': '#FFFFFF',
      };
    }

    return {
      'background-image': `linear-gradient(to bottom, ${this.hexToRgba(color, 0.18)}, rgba(24,24,27,0.94))`,
      'background-color': '#18181B',
      'border-color': color,
      'color': this.getTextColorValue(color),
    };
  }

  buildEventCardStyle(event: TimelineEvent) {
    const image = getImageByUsageKey(event.Images, 'default');
    const color = getPersonalizationValue(event, 'color') || '#27272A';

    if (image?.filePath) {
      return {
        'background-image': `linear-gradient(rgba(0,0,0,0.58), rgba(0,0,0,0.7)), url(${buildImageUrl(image.filePath)})`,
        'background-size': 'cover',
        'background-position': 'center',
      };
    }

    return {
      'background-color': color,
    };
  }

  hasBackgroundImage(event: TimelineEvent) {
    return !!getImageByUsageKey(event.Images, 'default');
  }

  getTextColorValue(color: string | null) {
    return getTextClass(color || undefined) === 'text-zinc-900' ? '#18181B' : '#FFFFFF';
  }

  private hexToRgba(hexColor: string, alpha: number) {
    let value = hexColor.trim();
    if (!value.startsWith('#')) {
      value = `#${value}`;
    }

    if (/^#([0-9a-fA-F]{3})$/.test(value)) {
      value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }

    if (!/^#([0-9a-fA-F]{6})$/.test(value)) {
      return `rgba(63, 63, 70, ${alpha})`;
    }

    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
