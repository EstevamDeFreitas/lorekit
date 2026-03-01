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

@Component({
  selector: 'app-document-list',
  imports: [NgClass, TreeViewListComponent, DocumentEditComponent],
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
        <div class="w-80 bg-zinc-900 p-2 rounded-md sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-dark">
          <app-tree-view-list
            [openInDialog]="false"
            (onArrayChange)="getDocuments()"
            (onDocumentSelect)="selectDocument($event.id)"
            [documentArray]="documents"
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
  selectedDocumentId = '';
  showDocumentEditor = true;

  selectedWorld : string = '';

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
    this.documents = this.documentService.getDocumentsTree(null, null).filter(doc => !doc.ParentDocument);

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


}
