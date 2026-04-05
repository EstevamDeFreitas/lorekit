import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { WorldService } from '../../../services/world.service';
import { DocumentService } from '../../../services/document.service';
import { World } from '../../../models/world.model';
import { Document } from '../../../models/document.model';
import { WorldStateService } from '../../../services/world-state.service';
import { TreeViewListComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";
import { TreeViewReparentRequest } from '../../../components/entity-lateral-menu/tree-view.models';
import { DocumentEditComponent } from '../document-edit/document-edit.component';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { EntityChangeService } from '../../../services/entity-change.service';

@Component({
  selector: 'app-document-list',
  imports: [TreeViewListComponent, DocumentEditComponent, FormsModule, NgClass, IconButtonComponent, FormOverlayDirective, ComboBoxComponent],
  template: `
    <div class="flex flex-col relative">

      <div class="flex flex-row gap-4">
        <div class="transition-all duration-300 overflow-clip shrink-0" [ngClass]="showsidebar ? 'w-80' : 'w-0'">
          <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
            <div>
                <h2 class="text-base mb-4">Documentos</h2>
              </div>

            @if (!worldId()) {
              <div class="mb-4">
                <app-combo-box
                  class="w-full"
                  label="Filtro de mundo"
                  [items]="availableWorlds"
                  compareProp="id"
                  displayProp="name"
                  [(comboValue)]="selectedWorld"
                  (comboValueChange)="onWorldSelect()">
                </app-combo-box>
              </div>
            }

            <div class="flex flex-row items-center gap-1 mb-4">
              <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus:outline-none focus-within:border-white">
                <div class="w-8 h-5 flex flex-row justify-center items-center">
                    <i class="fa fa-search "></i>
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="searchTerm"
                    (ngModelChange)="onDocumentFilter()"
                    placeholder="Pesquisar..."
                    class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10"
                  />
              </div>
              <app-icon-button
                size="sm"
                buttonType="secondary"
                icon="fa-solid fa-plus"
                appFormOverlay
                [title]="'Criar Documento'"
                [fields]="getFormFields()"
                (onSave)="createDocument($event)"
                ></app-icon-button>
            </div>
            <app-tree-view-list
              [openInDialog]="false"
              [useCustomCreate]="true"
              [dragEnabled]="!searchTerm.trim()"
              [dragContextId]="'document-list:' + (worldId() || selectedWorld || 'all')"
              [canReparent]="canReparentDocument"
              (onArrayChange)="getDocuments()"
              (onDocumentSelect)="selectDocument($event.id)"
              (onCreateChild)="createSubDocument($event)"
              (onReparentRequested)="reparentDocument($event)"
              [documentArray]="filteredDocuments"
            ></app-tree-view-list>
          </div>
        </div>
        <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[showsidebar ? 'start-92' : 'start-12']" (click)="showsidebar = !showsidebar">
          <i class="fa-solid text-zinc-400" [ngClass]="[showsidebar ? 'fa-angles-left' : 'fa-angles-right']"></i>
        </small>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedDocumentId && showDocumentEditor) {
            <div class="rounded-md p-8">
              <app-document-edit [documentIdInput]="selectedDocumentId" [showLateralMenu]="false"></app-document-edit>
            </div>
          }
          @else {
            <div class="h-full  flex items-center justify-center text-zinc-500">
              Selecione um documento na árvore para editar
            </div>
          }
        </div>
      </div>
    </div>`,
  styleUrl: './document-list.component.css',
})
export class DocumentListComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private documentService = inject(DocumentService);
  private worldService = inject(WorldService);
  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextClass = getTextClass;
  private worldStateService = inject(WorldStateService);
  private entityChangeService = inject(EntityChangeService);

  showsidebar = true;

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === DocumentListComponent ||
      this.activatedRoute.component === DocumentListComponent;
  });

  worldId = input<string>();
  availableWorlds : World[] = [];
  documents : Document[] = [];
  filteredDocuments : Document[] = [];
  selectedDocumentId = '';
  showDocumentEditor = true;

  selectedWorld : string = '';

  searchTerm : string = '';

  readonly canReparentDocument = (draggedId: string, newParentId: string | null) =>
    this.documentService.canReparentDocument(draggedId, newParentId);

  ngOnInit(): void {
    this.worldStateService.currentWorld$.subscribe(world => {
      const nextWorldId = world ? world.id : '';

      if (this.selectedWorld === nextWorldId) {
        return;
      }

      this.selectedWorld = nextWorldId;
      this.getDocuments();
    });

    this.entityChangeService.changes$.subscribe(event => {
      if (event.table === 'Document') {
        this.getDocuments();
      }
    });

    this.getAvailableWorlds();
    this.getDocuments();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getDocuments() {
    const activeWorldId = this.worldId() || this.selectedWorld || null;
    const rootDocuments = this.documentService
      .getDocumentsTree(null, null)
      .filter(doc => !doc.ParentDocument)
      .sort((a, b) => a.title.localeCompare(b.title));

    this.documents = activeWorldId
      ? this.filterDocumentsTreeByWorld(rootDocuments, activeWorldId)
      : rootDocuments;

    this.onDocumentFilter();

    if (this.selectedDocumentId && !this.hasDocumentInTree(this.documents, this.selectedDocumentId)) {
      this.selectedDocumentId = '';
      this.showDocumentEditor = false;
    }
  }

  private hasDocumentInTree(docs: Document[], id: string): boolean {
    for (const doc of docs) {
      if (doc.id === id) {
        return true;
      }

      if (doc.SubDocuments && this.hasDocumentInTree(doc.SubDocuments, id)) {
        return true;
      }
    }

    return false;
  }

  onWorldSelect(){
    this.getDocuments();
  }

  selectDocument(documentId: string) {
    if (this.selectedDocumentId === documentId) {
      return;
    }

    this.showDocumentEditor = false;

    setTimeout(() => {
      this.selectedDocumentId = documentId;
      this.showDocumentEditor = true;
    });
  }

  getColor(document: Document): string {
    const color = this.getPersonalizationValue(document, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
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

  onDocumentFilter (){
    const search = this.searchTerm.trim().toLowerCase();

    if (!search) {
      this.filteredDocuments = this.documents;
      return;
    }

    this.filteredDocuments = this.filterDocumentsTree(this.documents, search);
  }

  private filterDocumentsTree(docs: Document[], search: string): Document[] {
    const filtered: Document[] = [];

    for (const doc of docs) {
      const titleMatches = doc.title.toLowerCase().includes(search);
      const filteredChildren = doc.SubDocuments?.length
        ? this.filterDocumentsTree(doc.SubDocuments, search)
        : [];

      if (titleMatches || filteredChildren.length > 0) {
        filtered.push({
          ...doc,
          SubDocuments: filteredChildren,
        });
      }
    }

    return filtered;
  }

  private filterDocumentsTreeByWorld(docs: Document[], worldId: string): Document[] {
    const filtered: Document[] = [];

    for (const doc of docs) {
      const filteredChildren = doc.SubDocuments?.length
        ? this.filterDocumentsTreeByWorld(doc.SubDocuments, worldId)
        : [];
      const documentWorldId = this.getDocumentWorldId(doc);

      if (documentWorldId === worldId || filteredChildren.length > 0) {
        filtered.push({
          ...doc,
          SubDocuments: filteredChildren,
        });
      }
    }

    return filtered;
  }

  private getDocumentWorldId(document: Document): string | null {
    return document.ParentWorld?.id || this.documentService.getDocumentWorldId(document.id);
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Título', value: '' },
      { key: 'world', label: 'Mundo', value: this.worldId() || this.selectedWorld || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];
  }

  createDocument(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    const newDoc = new Document('', formData['name'], '');
    const selectedWorldId = formData['world'] || this.worldId() || this.selectedWorld || null;

    this.documentService.saveDocument(newDoc, null, null, selectedWorldId);

    this.getDocuments();
  }

  createSubDocument(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    if (!name) {
      return;
    }

    const newDoc = new Document('', name, '');
    this.documentService.saveDocument(newDoc, 'Document', event.parentId);
    this.getDocuments();
  }

  reparentDocument(event: TreeViewReparentRequest) {
    try {
      this.documentService.reparentDocument(event.draggedId, event.newParentId);
      this.getDocuments();
    } catch (error: any) {
      alert(error?.message || 'Falha ao reorganizar o documento.');
    }
  }
}
