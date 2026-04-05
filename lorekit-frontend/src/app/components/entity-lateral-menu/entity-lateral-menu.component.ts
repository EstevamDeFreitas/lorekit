import { AfterViewInit, ChangeDetectionStrategy, Component, inject, input, OnChanges, OnInit, output, SimpleChanges } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { Dialog } from '@angular/cdk/dialog';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { ButtonComponent } from '../button/button.component';
import { ComboBoxComponent } from '../combo-box/combo-box.component';
import { FormOverlayDirective, FormField } from '../form-overlay/form-overlay.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { InputComponent } from '../input/input.component';
import { NavButtonComponent } from '../nav-button/nav-button.component';
import { TextAreaComponent } from '../text-area/text-area.component';
import { DocumentEditComponent } from '../../pages/documents/document-edit/document-edit.component';
import { Document } from '../../models/document.model';
import { getImageByUsageKey } from '../../models/image.model';
import { getPersonalizationValue, getTextColorStyle } from '../../models/personalization.model';
import { DocumentService } from '../../services/document.service';
import { TreeViewDragDropService } from './tree-view-drag-drop.service';
import { TreeViewNode, TreeViewReparentRequest } from './tree-view.models';

@Component({
  selector: 'app-tree-view-list',
  standalone: true,
  imports: [OverlayModule, RouterModule, FormOverlayDirective, NgClass, NgStyle, IconButtonComponent],
  template: `
    <div
      class="flex flex-col gap-2 rounded-lg border border-transparent p-1 transition-colors"
      [attr.data-tree-root-context]="isRecursive() ? null : dragContextId()"
      [ngClass]="{
        'border-emerald-500 bg-emerald-950/40': isRootDropActive(),
        'border-red-500 bg-red-950/30': isRootDropInvalid()
      }">
      @for (item of documentArray(); track item.id) {
        <div class="flex flex-col gap-1">
          <div
            class="grid items-center gap-1 rounded-md border px-1 py-1 transition-colors"
            [style.grid-template-columns]="allowDetach() && !isRecursive() ? '1.5rem 1.25rem 1fr 1.5rem 1.5rem' : '1.5rem 1.25rem 1fr 1.5rem'"
            data-tree-node-row
            [attr.data-tree-context]="dragContextId()"
            [attr.data-tree-node-id]="item.id"
            [ngClass]="{
              'border-zinc-800': !isDraggedItem(item) && !isNodeDropActive(item) && !isNodeDropInvalid(item),
              'border-emerald-500 bg-emerald-950/40': isNodeDropActive(item),
              'border-red-500 bg-red-950/30': isNodeDropInvalid(item),
              'opacity-50': isDraggedItem(item)
            }">
            <span class="w-6 flex flex-row items-center">
              @if (hasChildren(item)) {
                @if (!isOpen(item.id)) {
                  <app-icon-button (click)="showSubDocuments(item.id)" size="xs" buttonType="secondaryActive" icon="fa-solid fa-angle-right"></app-icon-button>
                }
                @else {
                  <app-icon-button (click)="hideSubDocuments(item.id)" size="xs" buttonType="secondaryActive" icon="fa-solid fa-angle-down"></app-icon-button>
                }
              }
              @else {
                <span class="block h-5 w-5"></span>
              }
            </span>

            <button
              type="button"
              class="flex h-6 w-5 items-center justify-center rounded text-zinc-500 transition-colors hover:text-white"
              [class.cursor-grab]="dragEnabled()"
              [class.cursor-not-allowed]="!dragEnabled()"
              [disabled]="!dragEnabled()"
              title="Arrastar para reorganizar"
              (pointerdown)="startDrag($event, item)">
              <i class="fa-solid fa-grip-lines text-xs"></i>
            </button>

            <button
              (click)="openDocument(item)"
              class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2"
              [ngStyle]="{'color': getTextColorStyle(getPersonalizationValue(item, 'color'))}">
              <div class="flex flex-row items-center">
                <i class="fa-solid" [ngClass]="getPersonalizationItem(item, 'icon') || fallbackIcon()"></i>
              </div>
              <h2 [title]="item.title" class="text-xs">{{ item.title }}</h2>
            </button>

            @if (allowCreate()) {
              <app-icon-button
                size="xss"
                buttonType="secondary"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="createTitle()"
                [fields]="[{ key: 'name', label: createFieldLabel(), value: '' }]"
                (onSave)="createChild(item.id, $event)">
              </app-icon-button>
            }
            @else {
              <span></span>
            }

            @if (allowDetach() && !isRecursive()) {
              <app-icon-button
                size="xss"
                buttonType="secondary"
                icon="fa-solid fa-link-slash"
                title="Desvincular"
                (click)="onDetach.emit(item.id)">
              </app-icon-button>
            }
          </div>

          @if (isOpen(item.id)) {
            <span class="pl-4">
              @if (hasChildren(item)) {
                <app-tree-view-list
                  [entityId]="entityId()"
                  [entityTable]="entityTable()"
                  [openInDialog]="openInDialog()"
                  [allowCreate]="allowCreate()"
                  [fallbackIcon]="fallbackIcon()"
                  [emptyChildrenLabel]="emptyChildrenLabel()"
                  [createTitle]="createTitle()"
                  [createFieldLabel]="createFieldLabel()"
                  [useCustomCreate]="useCustomCreate()"
                  [dragEnabled]="dragEnabled()"
                  [dragContextId]="dragContextId()"
                  [canReparent]="canReparent()"
                  [allowDetach]="allowDetach()"
                  [isRecursive]="true"
                  (onArrayChange)="emitChange()"
                  (onDocumentSelect)="emitDocumentSelection($event)"
                  (onCreateChild)="emitCreateChild($event)"
                  (onReparentRequested)="emitReparentRequested($event)"
                  (onDetach)="onDetach.emit($event)"
                  [documentArray]="item.SubDocuments || []">
                </app-tree-view-list>
              }
              @else {
                <p class="text-xs text-zinc-600">{{ emptyChildrenLabel() }}</p>
              }
            </span>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeViewListComponent {
  documentArray = input.required<Array<TreeViewNode>>();

  onArrayChange = output<void>();
  onDocumentSelect = output<TreeViewNode>();
  onCreateChild = output<{ parentId: string, formData: Record<string, string> }>();
  onReparentRequested = output<TreeViewReparentRequest>();
  onDetach = output<string>();

  openDocuments = new Set<string>();

  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextColorStyle = getTextColorStyle;

  entityTable = input<string>();
  entityId = input<string>();
  openInDialog = input<boolean>(true);
  allowCreate = input<boolean>(true);
  fallbackIcon = input<string>('fa-file');
  emptyChildrenLabel = input<string>('NÃ£o hÃ¡ Documentos Relacionados');
  createTitle = input<string>('Criar Documento');
  createFieldLabel = input<string>('TÃ­tulo');
  useCustomCreate = input<boolean>(false);
  dragEnabled = input<boolean>(true);
  dragContextId = input<string>('tree-view');
  canReparent = input<(draggedId: string, newParentId: string | null) => boolean>(() => true);
  isRecursive = input<boolean>(false);
  allowDetach = input<boolean>(false);

  private readonly dialog = inject(Dialog);
  private readonly treeDragDropService = inject(TreeViewDragDropService);

  getPersonalizationItem(item: TreeViewNode, key: string): string | null {
    if (item['Personalization'] && (item['Personalization'] as any).contentJson != null && (item['Personalization'] as any).contentJson !== '') {
      return JSON.parse((item['Personalization'] as any).contentJson)[key] || null;
    }

    return null;
  }

  hasChildren(item: TreeViewNode): boolean {
    return (item.SubDocuments?.length || 0) > 0;
  }

  isOpen(documentId: string): boolean {
    return this.openDocuments.has(documentId);
  }

  showSubDocuments(documentId: string) {
    this.openDocuments.add(documentId);
  }

  hideSubDocuments(documentId: string) {
    this.openDocuments.delete(documentId);
  }

  startDrag(event: PointerEvent, item: TreeViewNode) {
    if (!this.dragEnabled()) {
      return;
    }

    this.treeDragDropService.startDrag(event, {
      contextId: this.dragContextId(),
      draggedId: item.id,
      title: item.title,
    }, result => {
      if (!this.canDropTo(result.draggedId, result.newParentId)) {
        return;
      }

      this.onReparentRequested.emit(result);
    });
  }

  isDraggedItem(item: TreeViewNode): boolean {
    const activeDrag = this.treeDragDropService.activeDrag();
    return !!activeDrag && activeDrag.contextId === this.dragContextId() && activeDrag.draggedId === item.id;
  }

  isNodeDropActive(item: TreeViewNode): boolean {
    const dropTarget = this.treeDragDropService.dropTarget();
    return !!dropTarget
      && dropTarget.contextId === this.dragContextId()
      && dropTarget.type === 'node'
      && dropTarget.nodeId === item.id
      && this.canDropTo(this.getDraggedId(), item.id);
  }

  isNodeDropInvalid(item: TreeViewNode): boolean {
    const dropTarget = this.treeDragDropService.dropTarget();
    return !!dropTarget
      && dropTarget.contextId === this.dragContextId()
      && dropTarget.type === 'node'
      && dropTarget.nodeId === item.id
      && !this.canDropTo(this.getDraggedId(), item.id);
  }

  isRootDropActive(): boolean {
    const dropTarget = this.treeDragDropService.dropTarget();
    return !this.isRecursive()
      && !!dropTarget
      && dropTarget.contextId === this.dragContextId()
      && dropTarget.type === 'root'
      && this.canDropTo(this.getDraggedId(), null);
  }

  isRootDropInvalid(): boolean {
    const dropTarget = this.treeDragDropService.dropTarget();
    return !this.isRecursive()
      && !!dropTarget
      && dropTarget.contextId === this.dragContextId()
      && dropTarget.type === 'root'
      && !this.canDropTo(this.getDraggedId(), null);
  }

  openDocument(item: TreeViewNode) {
    if (!this.openInDialog()) {
      this.onDocumentSelect.emit(item);
      return;
    }

    this.dialog.open(DocumentEditComponent, {
      data: {
        id: item.id,
        entityTable: this.entityTable(),
        entityId: this.entityId()
      },
      panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'],
      height: '80vh',
      width: '80vw',
    });
  }

  emitChange() {
    this.onArrayChange.emit();
  }

  emitDocumentSelection(item: TreeViewNode) {
    this.onDocumentSelect.emit(item);
  }

  emitCreateChild(event: { parentId: string, formData: Record<string, string> }) {
    this.onCreateChild.emit(event);
  }

  emitReparentRequested(event: TreeViewReparentRequest) {
    this.onReparentRequested.emit(event);
  }

  createChild(parentId: string, formData: Record<string, string>) {
    this.onCreateChild.emit({ parentId, formData });
  }

  private canDropTo(draggedId: string | null, newParentId: string | null): boolean {
    if (!draggedId) {
      return false;
    }

    if (draggedId === newParentId) {
      return false;
    }

    if (newParentId) {
      const candidateParent = this.findNodeById(this.documentArray(), newParentId);
      if (candidateParent && this.nodeContainsId(candidateParent, draggedId)) {
        return false;
      }
    }

    return this.canReparent()(draggedId, newParentId);
  }

  private getDraggedId(): string | null {
    const activeDrag = this.treeDragDropService.activeDrag();
    if (!activeDrag || activeDrag.contextId !== this.dragContextId()) {
      return null;
    }

    return activeDrag.draggedId;
  }

  private findNodeById(nodes: TreeViewNode[], nodeId: string): TreeViewNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }

      const nestedMatch = this.findNodeById(node.SubDocuments || [], nodeId);
      if (nestedMatch) {
        return nestedMatch;
      }
    }

    return null;
  }

  private nodeContainsId(node: TreeViewNode, nodeId: string): boolean {
    if (node.id === nodeId) {
      return true;
    }

    for (const child of node.SubDocuments || []) {
      if (this.nodeContainsId(child, nodeId)) {
        return true;
      }
    }

    return false;
  }
}

@Component({
  selector: 'app-entity-lateral-menu',
  imports: [ButtonComponent, FormsModule, OverlayModule, InputComponent, RouterModule, FormOverlayDirective, ComboBoxComponent, TextAreaComponent, TreeViewListComponent, NavButtonComponent],
  template: `
  <div class="flex flex-col gap-4 w-full h-full">
    <div class="flex flex-row justify-around items-center">
      <app-nav-button [label]="'Propriedades'" size="sm" [active]="currentTab === 'properties'" (click)="currentTab = 'properties'"></app-nav-button>
      <app-nav-button [label]="'Documentos'" size="sm" [active]="currentTab === 'documents'" (click)="currentTab = 'documents'"></app-nav-button>
    </div>
    @switch (currentTab) {
      @case ('properties') {
        <div class="flex flex-col gap-2 h-[calc(100%-8rem)] overflow-y-scroll scrollbar-dark">
          @for (field of fieldValues; track field.key) {
            @if (field.options && field.options.length > 0) {
              <app-combo-box
                [label]="field.label"
                [items]="field.options"
                [(comboValue)]="field.value"
                (comboValueChange)="onFieldValueChange(field)"
                [compareProp]="field.optionCompareProp || ''"
                [displayProp]="field.optionDisplayProp || ''">
              </app-combo-box>
            }
            @else if (field.type === 'text-area') {
              <app-text-area
                [label]="field.label"
                [(value)]="field.value"
                (valueChange)="onFieldValueChange(field)"
                height="h-24">
              </app-text-area>
            }
            @else {
              <app-input
                [label]="field.label"
                [type]="field.type || 'text'"
                [(value)]="field.value"
                (valueChange)="onFieldValueChange(field)">
              </app-input>
            }
          }
        </div>
      }
      @case ('documents') {
        <div class="flex flex-row justify-between items-center">
          <span></span>
          <app-button
            label="Novo"
            size="xs"
            icon="fa-plus"
            buttonType="white"
            appFormOverlay
            [title]="'Criar Documento'"
            [fields]="[{ key: 'name', label: 'TÃ­tulo', value: '' }]"
            (onSave)="createDocument($event)">
          </app-button>
        </div>
        <div class="relative flex flex-col gap-1">
          <input
            type="text"
            [(ngModel)]="documentSearchTerm"
            (ngModelChange)="onDocumentSearchChange($event)"
            placeholder="Relacionar documento existente..."
            class="w-full rounded-lg px-3 py-2 bg-zinc-925 border border-zinc-800 text-xs focus:outline-none focus:border-zinc-100 placeholder:text-white/20"
          />
          @if (filteredDocuments.length > 0) {
            <div class="absolute z-20 top-full mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg max-h-48 overflow-y-auto scrollbar-dark">
              @for (doc of filteredDocuments; track doc.id) {
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 text-xs border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900 cursor-pointer"
                  (click)="selectDocument(doc)">
                  {{ doc.title }}
                </button>
              }
            </div>
          }
          @if (selectedDocumentId) {
            <app-button label="Relacionar" buttonType="secondary" size="xs" (click)="attachSelectedDocument()"></app-button>
          }
        </div>
        <div class="flex flex-col gap-2 h-[calc(100%-8rem)] overflow-y-scroll scrollbar-dark">
          <app-tree-view-list
            [entityId]="entityId()"
            [entityTable]="entityTable()"
            [useCustomCreate]="true"
            [dragContextId]="'entity-documents:' + entityTable() + ':' + entityId()"
            [canReparent]="canReparentDocument"
            [allowDetach]="true"
            (onArrayChange)="loadDocuments()"
            (onCreateChild)="createChildDocument($event)"
            (onReparentRequested)="reparentDocument($event)"
            (onDetach)="detachDocument($event)"
            [documentArray]="documentArray">
          </app-tree-view-list>
        </div>
      }
    }
  </div>`,
  styleUrl: './entity-lateral-menu.component.css',
})
export class EntityLateralMenuComponent implements OnInit, OnChanges, AfterViewInit {
  documentArray: Document[] = [];
  availableDocuments: Document[] = [];
  filteredDocuments: Document[] = [];
  selectedDocumentId: string | null = null;
  documentSearchTerm = '';

  entityTable = input.required<string>();
  entityId = input.required<string>();

  fields = input<FormField[]>([]);
  onSave = output<Record<string, any>>();

  fieldValues: FormField[] = [];

  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextColorStyle = getTextColorStyle;

  private readonly fieldValueChanges = new Subject<FormField>();
  private initialized = false;

  currentTab = 'properties';

  returnUrl?: string;

  private readonly documentService = inject(DocumentService);
  private readonly currentRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canReparentDocument = (draggedId: string, newParentId: string | null) =>
    this.documentService.canReparentDocument(draggedId, newParentId);

  ngOnInit() {
    this.loadDocuments();

    this.syncFieldsFromInput();
    this.fieldValueChanges.pipe(
      debounceTime(500)
    ).subscribe(() => {
      this.onFieldChange();
    });
  }

  loadDocuments() {
    this.documentArray = this.documentService.getDocumentsTree(this.entityTable(), this.entityId());
    this.loadAvailableDocuments();
  }

  private loadAvailableDocuments() {
    const relatedIds = this.collectDocumentIds(this.documentArray);
    this.availableDocuments = this.documentService.getAllDocuments()
      .filter(doc => !relatedIds.has(doc.id))
      .sort((a, b) => a.title.localeCompare(b.title));
    this.onDocumentSearchChange(this.documentSearchTerm);
  }

  private collectDocumentIds(docs: Document[]): Set<string> {
    const ids = new Set<string>();
    const visit = (items: Document[]) => {
      for (const item of items) {
        ids.add(item.id);
        if (item.SubDocuments) {
          visit(item.SubDocuments);
        }
      }
    };
    visit(docs);
    return ids;
  }

  onDocumentSearchChange(term: string) {
    this.documentSearchTerm = term;
    const normalized = term.trim().toLocaleLowerCase();
    if (!normalized) {
      this.filteredDocuments = [];
      return;
    }
    this.filteredDocuments = this.availableDocuments
      .filter(doc => doc.title.toLocaleLowerCase().includes(normalized))
      .slice(0, 8);
  }

  selectDocument(doc: Document) {
    this.selectedDocumentId = doc.id;
    this.documentSearchTerm = doc.title;
    this.filteredDocuments = [];
  }

  attachSelectedDocument() {
    if (!this.selectedDocumentId) {
      return;
    }
    this.documentService.attachExistingDocument(this.entityTable(), this.entityId(), this.selectedDocumentId);
    this.selectedDocumentId = null;
    this.documentSearchTerm = '';
    this.filteredDocuments = [];
    this.loadDocuments();
  }

  detachDocument(documentId: string) {
    this.documentService.detachDocument(this.entityTable(), this.entityId(), documentId);
    this.loadDocuments();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.syncFieldsFromInput();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initialized = true);
  }

  createDocument(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    let newDoc = new Document('', formData['name'], '');

    newDoc = this.documentService.saveDocument(newDoc, this.entityTable(), this.entityId());
    this.documentArray.push(newDoc);
  }

  createChildDocument(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    if (!name) {
      return;
    }

    const newDoc = new Document('', name, '');
    this.documentService.saveDocument(newDoc, 'Document', event.parentId);
    this.loadDocuments();
  }

  reparentDocument(event: TreeViewReparentRequest) {
    try {
      this.documentService.reparentDocument(event.draggedId, event.newParentId);
      this.loadDocuments();
    } catch (error: any) {
      alert(error?.message || 'Falha ao reorganizar o documento.');
    }
  }

  getReturnUrlQuery() {
    const tree = this.router.createUrlTree([], { relativeTo: this.currentRoute, queryParams: { returnUrl: this.returnUrl } });
    const baseUrl = this.router.serializeUrl(tree);
    return encodeURIComponent(baseUrl || this.router.url);
  }

  onFieldValueChange(field: FormField) {
    const index = this.fieldValues.findIndex(existingField => existingField.key === field.key);

    if (index >= 0) {
      this.fieldValues[index].value = field.value;
    }

    if (!this.initialized) {
      return;
    }

    this.fieldValueChanges.next(field);
  }

  onFieldChange() {
    const formData: Record<string, any> = {};
    this.fieldValues.forEach(field => {
      formData[field.key] = field.value;
    });

    this.onSave.emit(formData);
  }

  private syncFieldsFromInput() {
    const sourceFields = this.fields() || [];

    if (!this.fieldValues || this.fieldValues.length === 0) {
      this.fieldValues = sourceFields.map(field => ({ ...field, value: field.value ?? '' }));
      return;
    }

    const currentValuesByKey = new Map(this.fieldValues.map(field => [field.key, field.value]));
    this.fieldValues = sourceFields.map(field => {
      const existingValue = currentValuesByKey.get(field.key);
      return { ...field, value: existingValue !== undefined ? existingValue : (field.value ?? '') };
    });
  }
}
