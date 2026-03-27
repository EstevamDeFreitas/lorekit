import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from "../../../components/button/button.component";
import { TreeViewListComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { InputComponent } from "../../../components/input/input.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { TextAreaComponent } from "../../../components/text-area/text-area.component";
import { Document } from '../../../models/document.model';
import { GreatMark } from '../../../models/great-mark.model';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { TimelineEvent } from '../../../models/timeline-event.model';
import { Timeline } from '../../../models/timeline.model';
import { DocumentService } from '../../../services/document.service';
import { EventService } from '../../../services/event.service';
import { GreatMarkService } from '../../../services/great-mark.service';
import { TimelineService } from '../../../services/timeline.service';
import { GreatMarkEditComponent } from '../great-mark-edit/great-mark-edit.component';
import { TimelineEventEditComponent } from '../timeline-event-edit/timeline-event-edit.component';

type EventSide = 'left' | 'right';

interface TimelineSectionViewModel {
  id: string;
  kind: 'initial' | 'marked' | 'free' | 'trailing';
  mark: GreatMark | null;
  events: TimelineEvent[];
  color: string | null;
  dropListId: string;
}

interface TimelineEventDocumentsDialogData {
  eventId: string;
  eventName: string;
}

@Component({
  selector: 'app-timeline-event-documents-dialog',
  standalone: true,
  imports: [ButtonComponent, FormsModule, IconButtonComponent, InputComponent, TreeViewListComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">Documentos do Evento</h2>
          <p class="text-sm text-zinc-400">Gerencie os documentos relacionados a {{ data.eventName }}.</p>
        </div>
        <app-icon-button icon="fa-solid fa-xmark" buttonType="secondary" size="lg" (click)="dialogRef.close({ updated: changed })"></app-icon-button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div class="relative">
          <label class="block text-xs font-medium">Relacionar documento existente</label>
          <input
            type="text"
            [(ngModel)]="documentSearchTerm"
            (ngModelChange)="onDocumentSearchChange($event)"
            placeholder="Pesquisar documentos..."
            class="mt-1 w-full rounded-lg px-3 py-2 bg-zinc-925 border border-zinc-800 text-sm focus:outline-none focus:border-zinc-100 placeholder:text-white/20"
          />

          @if (filteredDocuments.length > 0) {
            <div class="absolute z-20 top-full mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg max-h-56 overflow-y-auto scrollbar-dark">
              @for (document of filteredDocuments; track document.id) {
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900 cursor-pointer"
                  (click)="selectDocument(document)">
                  <div class="font-medium">{{ document.title }}</div>
                </button>
              }
            </div>
          }
        </div>
        <app-button label="Relacionar" buttonType="secondary" size="sm" (click)="attachSelectedDocument()"></app-button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <app-input label="Novo documento" [(value)]="newDocumentTitle"></app-input>
        <app-button label="Criar novo documento" buttonType="primary" size="sm" (click)="createRootDocument()"></app-button>
      </div>

      <div class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 min-h-40 max-h-[60vh] overflow-y-auto scrollbar-dark">
        <app-tree-view-list
          [entityTable]="'Event'"
          [entityId]="data.eventId"
          [documentArray]="documents"
          [allowCreate]="true"
          [useCustomCreate]="true"
          [createTitle]="'Criar Documento'"
          [createFieldLabel]="'Título'"
          (onCreateChild)="createChildDocument($event)">
        </app-tree-view-list>
      </div>

      <div class="flex justify-end">
        <app-button label="Fechar" buttonType="secondary" size="sm" (click)="dialogRef.close({ updated: changed })"></app-button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineEventDocumentsDialogComponent {
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<TimelineEventDocumentsDialogData>(DIALOG_DATA);
  private readonly documentService = inject(DocumentService);

  documents: Document[] = [];
  availableDocuments: Document[] = [];
  filteredDocuments: Document[] = [];
  selectedDocumentId: string | null = null;
  documentSearchTerm = '';
  newDocumentTitle = '';
  changed = false;

  constructor() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.documents = this.documentService.getDocumentsTree('Event', this.data.eventId);
    const relatedDocumentIds = this.collectDocumentIds(this.documents);
    this.availableDocuments = this.documentService.getAllDocuments()
      .filter(document => !relatedDocumentIds.has(document.id))
      .sort((a, b) => a.title.localeCompare(b.title));
    this.onDocumentSearchChange(this.documentSearchTerm);
  }

  attachSelectedDocument() {
    if (!this.selectedDocumentId) {
      return;
    }

    this.documentService.attachExistingDocument('Event', this.data.eventId, this.selectedDocumentId);
    this.selectedDocumentId = null;
    this.documentSearchTerm = '';
    this.changed = true;
    this.loadDocuments();
  }

  createRootDocument() {
    const title = this.newDocumentTitle.trim();
    if (!title) {
      return;
    }

    this.documentService.saveDocument(new Document('', title, ''), 'Event', this.data.eventId);
    this.newDocumentTitle = '';
    this.changed = true;
    this.loadDocuments();
  }

  createChildDocument(event: { parentId: string, formData: Record<string, string> }) {
    const title = event.formData['name']?.trim();
    if (!title) {
      return;
    }

    this.documentService.saveDocument(new Document('', title, ''), 'Document', event.parentId);
    this.changed = true;
    this.loadDocuments();
  }

  onDocumentSearchChange(term: string) {
    this.documentSearchTerm = term;
    const normalizedTerm = term.trim().toLocaleLowerCase();

    if (!normalizedTerm) {
      this.filteredDocuments = [];
      return;
    }

    this.filteredDocuments = this.availableDocuments
      .filter(document => document.title.toLocaleLowerCase().includes(normalizedTerm))
      .slice(0, 8);
  }

  selectDocument(document: Document) {
    this.selectedDocumentId = document.id;
    this.documentSearchTerm = document.title;
    this.filteredDocuments = [];
  }

  private collectDocumentIds(documents: Document[]) {
    const ids = new Set<string>();

    const visit = (items: Document[]) => {
      for (const item of items) {
        ids.add(item.id);
        if (item.SubDocuments?.length) {
          visit(item.SubDocuments);
        }
      }
    };

    visit(documents);
    return ids;
  }
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
        <div class="rounded-md border border-zinc-800 bg-zinc-900 p-4 sticky top-10 flex flex-col gap-4">
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

        <div class="rounded-md border border-zinc-800 bg-zinc-900/40 p-4 min-h-[70vh]">
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
                        <div
                          role="button"
                          tabindex="0"
                          class="group rounded-2xl border border-zinc-800 p-4 text-left cursor-pointer hover:border-zinc-600"
                          [style.border-left-width.px]="4"
                          [style.border-left-color]="section.color || '#71717A'"
                          [ngStyle]="buildEventCardStyle(event)"
                          [class.text-white]="hasBackgroundImage(event)"
                          [ngClass]="!hasBackgroundImage(event) ? getTextClass(getPersonalizationValue(event, 'color') || undefined) : ''"
                          (click)="openEventDialog(event.chronologyOrder, event.id)">
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-xs uppercase tracking-[0.2em] opacity-70">{{ event.date || 'Sem data' }}</div>
                            <div class="flex items-center gap-2">
                              @if (event.ParentEventType) {
                                <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white">{{ event.ParentEventType.name }}</span>
                              }
                              <button
                                type="button"
                                class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white cursor-pointer hover:border-zinc-500"
                                (click)="openEventDocuments(event, $event)">
                                {{ getEventDocumentsLabel(event) }}
                              </button>
                            </div>
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
                        </div>
                      }
                      @else {
                        <div></div>
                      }

                      <div class="flex flex-col items-center gap-2">
                        <div class="w-5 h-5 rounded-full border-4 border-zinc-950 shadow-lg" [style.background-color]="section.color || '#71717A'"></div>
                        <i class="fa-solid fa-grip-lines text-xs text-zinc-500"></i>
                      </div>

                      @if (side === 'right') {
                        <div
                          role="button"
                          tabindex="0"
                          class="group rounded-2xl border border-zinc-800 p-4 text-left cursor-pointer hover:border-zinc-600"
                          [style.border-left-width.px]="4"
                          [style.border-left-color]="section.color || '#71717A'"
                          [ngStyle]="buildEventCardStyle(event)"
                          [class.text-white]="hasBackgroundImage(event)"
                          [ngClass]="!hasBackgroundImage(event) ? getTextClass(getPersonalizationValue(event, 'color') || undefined) : ''"
                          (click)="openEventDialog(event.chronologyOrder, event.id)">
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-xs uppercase tracking-[0.2em] opacity-70">{{ event.date || 'Sem data' }}</div>
                            <div class="flex items-center gap-2">
                              @if (event.ParentEventType) {
                                <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white">{{ event.ParentEventType.name }}</span>
                              }
                              <button
                                type="button"
                                class="text-xs px-2 py-1 rounded-md bg-zinc-950/75 border border-zinc-700 text-white cursor-pointer hover:border-zinc-500"
                                (click)="openEventDocuments(event, $event)">
                                {{ getEventDocumentsLabel(event) }}
                              </button>
                            </div>
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
                        </div>
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
    kind: 'initial',
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
      kind: 'initial',
      mark: null,
      events: [],
      color: null,
      dropListId: 'timeline-section-initial',
    };

    const builtSections: TimelineSectionViewModel[] = [initialSection];
    const trailingBaseOrder = (marks.length + 1) * this.MARK_SPACING;

    for (const [markIndex, mark] of marks.entries()) {
      const nextMark = marks[markIndex + 1];
      const upperBound = nextMark?.sortOrder ?? trailingBaseOrder;
      const freeSectionBase = nextMark ? this.getFreeSectionBaseOrder(mark.sortOrder, nextMark.sortOrder) : upperBound;
      const markedEvents = sortedEvents.filter(event =>
        event.sortOrder > mark.sortOrder &&
        event.sortOrder < freeSectionBase
      );
      const freeEvents = nextMark
        ? sortedEvents.filter(event =>
            event.sortOrder >= freeSectionBase &&
            event.sortOrder < upperBound
          )
        : [];

      builtSections.push({
        id: `section-${mark.id}`,
        kind: 'marked',
        mark,
        events: markedEvents,
        color: getPersonalizationValue(mark, 'color'),
        dropListId: `timeline-section-${mark.id}`,
      });

      if (freeEvents.length > 0) {
        builtSections.push({
          id: `section-free-${mark.id}-${nextMark.id}`,
          kind: 'free',
          mark: null,
          events: freeEvents,
          color: null,
          dropListId: `timeline-section-free-${mark.id}-${nextMark.id}`,
        });
      }
    }

    const firstMark = marks[0];
    initialSection.events = firstMark
      ? sortedEvents.filter(event => event.sortOrder < firstMark.sortOrder)
      : sortedEvents;

    if (marks.length > 0) {
      builtSections.push({
        id: 'section-trailing',
        kind: 'trailing',
        mark: null,
        events: sortedEvents.filter(event => event.sortOrder >= trailingBaseOrder),
        color: null,
        dropListId: 'timeline-section-trailing',
      });
    }

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

  openEventDocuments(event: TimelineEvent, domEvent: Event) {
    domEvent.stopPropagation();

    const dialogRef = this.dialog.open(TimelineEventDocumentsDialogComponent, {
      panelClass: ['screen-dialog', 'overflow-visible'],
      width: '90vw',
      maxWidth: '960px',
      data: {
        eventId: event.id,
        eventName: event.name,
      },
    });

    dialogRef.closed.subscribe((result: any) => {
      if (result?.updated) {
        this.loadTimeline();
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
    let normalizedMarkIndex = 0;

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

      if (section.mark) {
        normalizedMarkIndex++;
        const markOrder = normalizedMarkIndex * this.MARK_SPACING;
        section.mark.sortOrder = markOrder;
        markUpdates.push({
          id: section.mark.id,
          sortOrder: markOrder,
        });
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
        continue;
      }

      if (section.kind === 'free') {
        const previousMarkedSection = this.findPreviousMarkedSection(sectionIndex);
        const nextMarkedSection = this.findNextMarkedSection(sectionIndex);

        if (!previousMarkedSection?.mark || !nextMarkedSection?.mark) {
          continue;
        }

        const previousMarkOrder = previousMarkedSection.mark.sortOrder;
        const nextMarkOrder = (normalizedMarkIndex + 1) * this.MARK_SPACING;
        const freeSectionBase = this.getFreeSectionBaseOrder(previousMarkOrder, nextMarkOrder);

        section.events.forEach((timelineEvent, eventIndex) => {
          const order = freeSectionBase + ((eventIndex + 1) * this.EVENT_SPACING);
          timelineEvent.sortOrder = order;
          timelineEvent.chronologyOrder = order;
          eventUpdates.push({
            id: timelineEvent.id,
            sortOrder: order,
            chronologyOrder: order,
          });
        });
        continue;
      }

      if (section.kind === 'trailing') {
        const trailingBase = (this.greatMarks.length + 1) * this.MARK_SPACING;
        section.events.forEach((timelineEvent, eventIndex) => {
          const order = trailingBase + ((eventIndex + 1) * this.EVENT_SPACING);
          timelineEvent.sortOrder = order;
          timelineEvent.chronologyOrder = order;
          eventUpdates.push({
            id: timelineEvent.id,
            sortOrder: order,
            chronologyOrder: order,
          });
        });
      }
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
    const section = this.sections[sectionIndex];
    const mark = section?.mark;
    if (!mark) {
      return this.getInitialInsertOrder();
    }

    const lastMarkedEvent = section.events.at(-1);
    if (lastMarkedEvent) {
      return lastMarkedEvent.sortOrder + 1;
    }

    const nextSection = this.sections[sectionIndex + 1];
    if (nextSection?.kind === 'free') {
      const nextMarkedSection = this.findNextMarkedSection(sectionIndex + 1);
      const nextMarkOrder = nextMarkedSection?.mark?.sortOrder;

      if (nextMarkOrder) {
        return Math.max(mark.sortOrder + 1, this.getFreeSectionBaseOrder(mark.sortOrder, nextMarkOrder) - 1);
      }
    }

    if (nextSection?.mark) {
      return Math.max(mark.sortOrder + 1, this.getFreeSectionBaseOrder(mark.sortOrder, nextSection.mark.sortOrder) - 1);
    }

    return mark.sortOrder + 1;
  }

  getBetweenSectionsInsertOrder(sectionIndex: number) {
    const section = this.sections[sectionIndex];
    const nextSection = this.sections[sectionIndex + 1];
    const lastEvent = section?.events.at(-1);
    const anchor = lastEvent?.sortOrder ?? section?.mark?.sortOrder ?? 0;

    if (section?.kind === 'trailing') {
      return this.getTrailingSectionInsertOrder();
    }

    if (nextSection?.kind === 'trailing') {
      return this.getTrailingSectionInsertOrder();
    }

    if (section?.mark && nextSection?.kind === 'free') {
      const nextMarkedSection = this.findNextMarkedSection(sectionIndex + 1);
      const nextMarkOrder = nextMarkedSection?.mark?.sortOrder;

      if (!nextMarkOrder) {
        return this.getTrailingSectionInsertOrder();
      }

      const freeSectionBase = this.getFreeSectionBaseOrder(section.mark.sortOrder, nextMarkOrder) + this.EVENT_SPACING;
      const firstFreeEvent = nextSection.events[0];
      return firstFreeEvent ? Math.max(freeSectionBase, firstFreeEvent.sortOrder - 1) : freeSectionBase;
    }

    if (section?.kind === 'free') {
      return lastEvent ? lastEvent.sortOrder + 1 : anchor + this.EVENT_SPACING;
    }

    if (section?.mark && nextSection?.mark) {
      return this.getFreeSectionBaseOrder(section.mark.sortOrder, nextSection.mark.sortOrder) + this.EVENT_SPACING;
    }

    if (nextSection?.mark) {
      return Math.max(anchor + 1, nextSection.mark.sortOrder - 1);
    }

    return anchor + this.EVENT_SPACING;
  }

  getBetweenSectionsLabel(sectionIndex: number) {
    if (this.sections[sectionIndex]?.kind === 'trailing') {
      return 'Adicionar evento ao final desta seção';
    }

    if (this.sections[sectionIndex]?.kind === 'free' && this.sections[sectionIndex + 1]?.mark) {
      return 'Adicionar evento entre seções';
    }

    if (this.sections[sectionIndex]?.mark && this.sections[sectionIndex + 1]?.kind === 'free') {
      return 'Adicionar evento entre seções';
    }

    if (this.sections[sectionIndex + 1]?.kind === 'trailing') {
      return 'Adicionar evento após o último grande marco';
    }

    return this.sections[sectionIndex + 1]?.mark ? 'Adicionar evento entre seções' : 'Adicionar evento no final da timeline';
  }

  getTrailingSectionInsertOrder() {
    const trailingSection = this.sections.find(section => section.kind === 'trailing');
    const lastTrailingEvent = trailingSection?.events.at(-1);
    const trailingBase = (this.greatMarks.length + 1) * this.MARK_SPACING;
    return lastTrailingEvent ? lastTrailingEvent.sortOrder + this.EVENT_SPACING : trailingBase + this.EVENT_SPACING;
  }

  getDefaultTailMarkOrder() {
    const lastMark = [...this.greatMarks].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
    const lastEvent = [...this.events].sort((a, b) => a.sortOrder - b.sortOrder).at(-1);
    const lower = Math.max(lastMark?.sortOrder || 0, lastEvent?.sortOrder || 0);
    return lower + this.MARK_SPACING;
  }

  getBoundaryMarkOrder(sectionIndex: number) {
    const section = this.sections[sectionIndex];
    const nextSection = this.sections[sectionIndex + 1];

    if (section?.kind === 'free') {
      const lastFreeEvent = section.events.at(-1);
      if (nextSection?.mark) {
        return lastFreeEvent ? Math.min(lastFreeEvent.sortOrder + 1, nextSection.mark.sortOrder - 1) : nextSection.mark.sortOrder - 1;
      }

      return lastFreeEvent ? lastFreeEvent.sortOrder + 1 : this.getDefaultTailMarkOrder();
    }

    if (nextSection?.kind === 'free') {
      const firstFreeEvent = nextSection.events[0];
      if (firstFreeEvent) {
        return Math.max((section?.mark?.sortOrder ?? 0) + 1, firstFreeEvent.sortOrder - 1);
      }
    }

    if (nextSection?.mark) {
      return nextSection.mark.sortOrder - 1;
    }

    if (nextSection?.kind === 'trailing') {
      return (this.greatMarks.length + 2) * this.MARK_SPACING;
    }

    const anchor = section?.events.at(-1)?.sortOrder ?? section?.mark?.sortOrder ?? 0;
    return anchor + this.MARK_SPACING;
  }

  private getFreeSectionBaseOrder(previousMarkOrder: number, nextMarkOrder: number) {
    return previousMarkOrder + Math.floor((nextMarkOrder - previousMarkOrder) / 2);
  }

  private findPreviousMarkedSection(sectionIndex: number) {
    for (let index = sectionIndex - 1; index >= 0; index--) {
      if (this.sections[index]?.mark) {
        return this.sections[index];
      }
    }

    return null;
  }

  private findNextMarkedSection(sectionIndex: number) {
    for (let index = sectionIndex + 1; index < this.sections.length; index++) {
      if (this.sections[index]?.mark) {
        return this.sections[index];
      }
    }

    return null;
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

  getEventDocumentsLabel(event: TimelineEvent) {
    const count = event.Documents?.length || 0;
    return count > 0 ? `Documentos (${count})` : 'Documentos';
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
