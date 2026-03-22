import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { TextAreaComponent } from "../../../components/text-area/text-area.component";
import { GreatMark } from '../../../models/great-mark.model';
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
            <app-button label="Nova Great Mark" buttonType="secondary" size="sm" (click)="openGreatMarkDialog(getDefaultTailMarkOrder())"></app-button>
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
          <div class="flex flex-col gap-6">
            @for (section of sections; track section.id; let sectionIndex = $index) {
              <div class="relative rounded-2xl border border-zinc-800/80 bg-zinc-950/20 px-3 py-4">
                <div class="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full" [style.background-color]="section.color || 'rgb(63 63 70)'"></div>

                <div class="relative z-10 flex flex-col gap-4">
                  @if (!section.mark) {
                    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div></div>
                      <div class="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          class="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm cursor-pointer hover:border-zinc-400"
                          (click)="openEventDialog(getSectionInsertOrder(sectionIndex, 'start'), buildGeneratedDate(1))">
                          Adicionar evento no início
                        </button>
                        <button
                          type="button"
                          class="text-xs text-zinc-400 hover:text-white cursor-pointer"
                          (click)="openGreatMarkDialog(getBoundaryMarkOrder(sectionIndex))">
                          Criar Great Mark nesta região
                        </button>
                      </div>
                      <div></div>
                    </div>
                  }
                  @else {
                    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div></div>
                      <button
                        type="button"
                        class="rounded-full px-5 py-3 shadow-lg border-2 cursor-pointer min-w-64"
                        [ngStyle]="{
                          'background-color': section.color || '#27272A',
                          'border-color': section.color || '#52525B',
                          'color': getTextColor(section.color)
                        }"
                        (click)="openGreatMarkDialog(section.mark.sortOrder, section.mark.id)">
                        <div class="font-semibold">{{ section.mark.name }}</div>
                        @if (section.mark.concept) {
                          <div class="text-xs opacity-80 mt-1">{{ section.mark.concept }}</div>
                        }
                      </button>
                      <div></div>
                    </div>

                    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div></div>
                      <button
                        type="button"
                        class="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm cursor-pointer hover:border-zinc-400"
                        (click)="openEventDialog(getSectionInsertOrder(sectionIndex, 'start'), getNextGeneratedDateForSection(sectionIndex))">
                        Adicionar evento após esta mark
                      </button>
                      <div></div>
                    </div>
                  }

                  <div
                    cdkDropList
                    [id]="section.dropListId"
                    [cdkDropListData]="section.events"
                    [cdkDropListConnectedTo]="connectedDropLists"
                    class="flex flex-col gap-4"
                    (cdkDropListDropped)="onDrop($event)">
                    @for (event of section.events; track event.id) {
                      @let side = eventSides[event.id] || 'left';
                      <div cdkDrag class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                        @if (side === 'left') {
                          <button
                            type="button"
                            class="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left cursor-pointer hover:border-zinc-600"
                            [style.border-left-width.px]="4"
                            [style.border-left-color]="section.color || '#71717A'"
                            (click)="openEventDialog(event.chronologyOrder, event.date || '', event.id)">
                            <div class="flex items-center justify-between gap-3">
                              <div class="text-xs uppercase tracking-[0.2em] text-zinc-500">{{ event.date || 'Sem data' }}</div>
                              @if (event.ParentEventType) {
                                <span class="text-xs px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700">{{ event.ParentEventType.name }}</span>
                              }
                            </div>
                            <h4 class="mt-2 text-base font-semibold">{{ event.name }}</h4>
                            <p class="mt-2 text-sm text-zinc-400 line-clamp-3">{{ event.concept || event.description || 'Sem resumo definido.' }}</p>
                            <div class="mt-3 flex flex-wrap gap-2">
                              @if (event.ParentLocation) {
                                <span class="text-xs px-2 py-1 rounded-md bg-zinc-950 border border-zinc-700">
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
                            class="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left cursor-pointer hover:border-zinc-600"
                            [style.border-left-width.px]="4"
                            [style.border-left-color]="section.color || '#71717A'"
                            (click)="openEventDialog(event.chronologyOrder, event.date || '', event.id)">
                            <div class="flex items-center justify-between gap-3">
                              <div class="text-xs uppercase tracking-[0.2em] text-zinc-500">{{ event.date || 'Sem data' }}</div>
                              @if (event.ParentEventType) {
                                <span class="text-xs px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700">{{ event.ParentEventType.name }}</span>
                              }
                            </div>
                            <h4 class="mt-2 text-base font-semibold">{{ event.name }}</h4>
                            <p class="mt-2 text-sm text-zinc-400 line-clamp-3">{{ event.concept || event.description || 'Sem resumo definido.' }}</p>
                            <div class="mt-3 flex flex-wrap gap-2">
                              @if (event.ParentLocation) {
                                <span class="text-xs px-2 py-1 rounded-md bg-zinc-950 border border-zinc-700">
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
                          Nenhum evento nesta seção.
                        </div>
                        <div></div>
                      </div>
                    }
                  </div>

                  <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div></div>
                    <div class="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        class="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm cursor-pointer hover:border-zinc-400"
                        (click)="openEventDialog(getSectionInsertOrder(sectionIndex, 'end'), getNextGeneratedDateForSection(sectionIndex))">
                        Adicionar evento ao final desta seção
                      </button>
                      <button
                        type="button"
                        class="text-xs text-zinc-400 hover:text-white cursor-pointer"
                        (click)="openGreatMarkDialog(getBoundaryMarkOrder(sectionIndex))">
                        Inserir Great Mark após esta seção
                      </button>
                    </div>
                    <div></div>
                  </div>
                </div>
              </div>
            }
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
          event.sortOrder >= mark.sortOrder &&
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

    this.persistSectionOrdering();
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
      }
    });
  }

  openEventDialog(defaultSortOrder: number, defaultDate: string, eventId?: string) {
    const dialogRef = this.dialog.open(TimelineEventEditComponent, {
      panelClass: ['screen-dialog', 'overflow-visible'],
      width: '90vw',
      maxWidth: '980px',
      data: {
        id: eventId,
        timelineId: this.timeline.id,
        defaultSortOrder,
        defaultDate,
        worldId: this.timeline.ParentWorld?.id || null,
      },
    });

    dialogRef.closed.subscribe((result: any) => {
      if (result?.saved || result?.deleted) {
        this.loadTimeline();

        if (result?.reorderRequired) {
          this.persistLoadedEventOrdering();
        }
      }
    });
  }

  persistLoadedEventOrdering() {
    this.events = [...this.events].sort((a, b) => a.chronologyOrder - b.chronologyOrder);
    this.buildSections();
    this.persistSectionOrdering();
  }

  persistSectionOrdering() {
    const updates: Array<Pick<TimelineEvent, 'id' | 'sortOrder' | 'chronologyOrder' | 'date'>> = [];
    let generatedIndex = 1;

    for (let sectionIndex = 0; sectionIndex < this.sections.length; sectionIndex++) {
      const section = this.sections[sectionIndex];
      const nextMark = this.sections[sectionIndex + 1]?.mark || null;
      const lowerBound = section.mark?.sortOrder ?? 0;
      const upperBound = nextMark?.sortOrder ?? null;

      if (section.events.length === 0) {
        continue;
      }

      if (upperBound != null) {
        const step = (upperBound - lowerBound) / (section.events.length + 1);

        section.events.forEach((timelineEvent, index) => {
          const order = lowerBound + (step * (index + 1));
          timelineEvent.sortOrder = order;
          timelineEvent.chronologyOrder = order;
          timelineEvent.date = this.buildGeneratedDate(generatedIndex);
          updates.push({
            id: timelineEvent.id,
            sortOrder: order,
            chronologyOrder: order,
            date: timelineEvent.date,
          });
          generatedIndex++;
        });
      } else {
        section.events.forEach((timelineEvent, index) => {
          const order = lowerBound + ((index + 1) * 10);
          timelineEvent.sortOrder = order;
          timelineEvent.chronologyOrder = order;
          timelineEvent.date = this.buildGeneratedDate(generatedIndex);
          updates.push({
            id: timelineEvent.id,
            sortOrder: order,
            chronologyOrder: order,
            date: timelineEvent.date,
          });
          generatedIndex++;
        });
      }
    }

    if (updates.length > 0) {
      this.eventService.saveEventOrdering(updates);
    }

    this.loadTimeline();
  }

  getDefaultTailMarkOrder() {
    const lastMark = [...this.greatMarks].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
    const lastEvent = [...this.events].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
    const lower = Math.max(lastMark?.sortOrder || 0, lastEvent?.sortOrder || 0);
    return lower + 10;
  }

  getBoundaryMarkOrder(sectionIndex: number) {
    const section = this.sections[sectionIndex];
    const nextMark = this.sections[sectionIndex + 1]?.mark || null;
    const lastEvent = section.events.at(-1);
    const lowerBound = lastEvent?.sortOrder ?? section.mark?.sortOrder ?? 0;

    if (!nextMark) {
      return lowerBound + 10;
    }

    return lowerBound + ((nextMark.sortOrder - lowerBound) / 2);
  }

  getSectionInsertOrder(sectionIndex: number, position: 'start' | 'end') {
    const section = this.sections[sectionIndex];
    const nextMark = this.sections[sectionIndex + 1]?.mark || null;
    const lowerBound = section.mark?.sortOrder ?? 0;
    const upperBound = nextMark?.sortOrder ?? null;
    const firstEvent = section.events[0];
    const lastEvent = section.events.at(-1);

    if (position === 'start') {
      if (firstEvent) {
        return lowerBound + ((firstEvent.sortOrder - lowerBound) / 2);
      }

      if (upperBound != null) {
        return lowerBound + ((upperBound - lowerBound) / 2);
      }

      return lowerBound + 10;
    }

    if (lastEvent) {
      if (upperBound != null) {
        return lastEvent.sortOrder + ((upperBound - lastEvent.sortOrder) / 2);
      }

      return lastEvent.sortOrder + 10;
    }

    if (upperBound != null) {
      return lowerBound + ((upperBound - lowerBound) / 2);
    }

    return lowerBound + 10;
  }

  getNextGeneratedDateForSection(sectionIndex: number) {
    const absoluteIndex = this.sections
      .slice(0, sectionIndex + 1)
      .reduce((total, section) => total + section.events.length, 0) + 1;

    return this.buildGeneratedDate(absoluteIndex);
  }

  buildGeneratedDate(index: number) {
    return index.toString().padStart(3, '0');
  }

  getTextColor(color: string | null) {
    return getTextClass(color || undefined) === 'text-zinc-900' ? '#18181B' : '#FFFFFF';
  }
}
