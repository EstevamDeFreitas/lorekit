import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { LocationService } from '../../../services/location.service';
import { WorldService } from '../../../services/world.service';
import { DocumentService } from '../../../services/document.service';
import { World } from '../../../models/world.model';
import { Document } from '../../../models/document.model';
import { Location } from '../../../models/location.model';
import { NgClass } from '@angular/common';
import { WorldStateService } from '../../../services/world-state.service';
import { TreeViewListComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";
import { DocumentEditComponent } from '../document-edit/document-edit.component';
import { FormsModule } from '@angular/forms';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';

@Component({
  selector: 'app-document-list',
  imports: [NgClass, TreeViewListComponent, DocumentEditComponent, FormsModule, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row justify-between items-center mb-4 sticky  z-25 bg-zinc-950 py-2" [ngClass]="{'top-0': isRouteComponent(), 'top-13': !isRouteComponent()}">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Documentos</h2>
        }
        @else {
          <div></div>
        }
      </div>
      <div class="flex flex-row gap-4 items-start">
        <div class="w-80 bg-zinc-900 p-3 rounded-md sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-dark">
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
              [fields]="[{ key: 'name', label: 'Título', value: '' }]"
              (onSave)="createDocument($event)"
              ></app-icon-button>
          </div>
          <app-tree-view-list
            [openInDialog]="false"
            [useCustomCreate]="true"
            (onArrayChange)="getDocuments()"
            (onDocumentSelect)="selectDocument($event.id)"
            (onCreateChild)="createSubDocument($event)"
            [documentArray]="filteredDocuments"
          ></app-tree-view-list>
        </div>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedDocumentId && showDocumentEditor) {
            <div class="rounded-md p-8">
              <app-document-edit [documentIdInput]="selectedDocumentId" [showLateralMenu]="false"></app-document-edit>
            </div>
          }
          @else {
            <div class="h-full rounded-md border border-zinc-800 bg-zinc-900/30 flex items-center justify-center text-zinc-500">
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
  private locationService = inject(LocationService);
  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextClass = getTextClass;
  private worldStateService = inject(WorldStateService);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === DocumentListComponent ||
      this.activatedRoute.component === DocumentListComponent;
  });

  worldId = input<string>();
  availableWorlds : World[] = [];
  availableLocations : Location[] = [];
  documents : Document[] = [];
  filteredDocuments : Document[] = [];
  selectedDocumentId = '';
  showDocumentEditor = true;

  selectedWorld : string = '';

  searchTerm : string = '';

  ngOnInit(): void {
    this.worldStateService.currentWorld$.subscribe(world => {
      this.selectedWorld = world ? world.id : '';
    });
    this.getAvailableWorlds();
    this.getAvailableLocations();
    this.getDocuments();
  }

  getAvailableWorlds() {
    this.availableWorlds = this.worldService.getWorlds();
  }

  getAvailableLocations(){
    this.availableLocations = this.worldId() || this.selectedWorld ? this.locationService.getLocationByWorldId(this.worldId() || this.selectedWorld) : this.locationService.getLocations();
  }

  getDocuments() {
    this.documents = this.documentService.getDocumentsTree(null, null).filter(doc => !doc.ParentDocument).sort((a, b) => a.title.localeCompare(b.title));

    this.onDocumentFilter();
    // if (!this.selectedDocumentId && this.documents.length > 0) {
    //   this.selectedDocumentId = this.documents[0].id;
    //   return;
    // }

    // if (this.selectedDocumentId && !this.hasDocumentInTree(this.documents, this.selectedDocumentId)) {
    //   this.selectedDocumentId = this.documents.length > 0 ? this.documents[0].id : '';
    // }
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

  createDocument(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    let newDoc = new Document('', formData['name'], '');

    newDoc = this.documentService.saveDocument(newDoc, "Document", null);

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


}
