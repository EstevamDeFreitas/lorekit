import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { DocumentService } from '../../../services/document.service';
import { Document } from '../../../models/document.model';
import { EditorComponent } from "../../../components/editor/editor.component";
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from "../../../components/button/button.component";
import { FormOverlayDirective, FormField } from '../../../components/form-overlay/form-overlay.component';
import { NgClass } from '@angular/common';
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";

@Component({
  selector: 'app-document-edit',
  standalone: true,
  imports: [IconButtonComponent, PersonalizationButtonComponent, FormsModule, NgClass, FormOverlayDirective, EditorComponent, ButtonComponent, SafeDeleteButtonComponent],
  template: `
  <div class="flex flex-col" [ngClass]="{'h-screen': !isInDialog(), 'h-[80vh]': isInDialog()}">
    <div class="flex flex-row items-center">
      @if (isRouteComponent()){
        <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" [route]="getReturnUrl()"></app-icon-button>
      }
      <input type="text" (blur)="saveDocument()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="document.title" />
      <div class="flex flex-row gap-2">
        <app-personalization-button [entityId]="documentId()" [entityTable]="'Document'" [size]="'xl'"></app-personalization-button>
        <app-safe-delete-button [entityName]="document.title" [entityId]="document.id" [entityTable]="'Document'" [size]="'xl'"></app-safe-delete-button>
      </div>
      <div class="flex-2"></div>
    </div>
    <div class="flex flex-row gap-4 mt-10 h-full">
      <div class="flex-4 h-[calc(100%-8rem)] overflow-y-auto scrollbar-dark flex flex-col">
        @if (!isLoading) {
          <app-editor [document]="document.content || ''" (saveDocument)="saveDocument($event)" class="w-full"></app-editor>
        }
      </div>
      <div class="flex-1">
        @if (!isLoading) {
          <div class="p-4 rounded-lg bg-zinc-900">
            <div class="flex flex-col gap-4">
              <div class="flex flex-row justify-between items-center">
                <h3 class="text-sm">Documentos</h3>
                <app-button
                  label="Novo"
                  size="xs"
                  icon="fa-plus"
                  buttonType="white"
                  appFormOverlay
                  [title]="'Criar Documento'"
                  [fields]="[{ key: 'name', label: 'Título', value: '' }]"
                  (onSave)="createDocument($event)"
                ></app-button>
              </div>
              <div class="flex flex-col gap-2 max-h-50 overflow-y-scroll scrollbar-dark">
                @for (item of documentArray; track $index) {
                  <button (click)="openDocument(item)" class=" cursor-pointer flex flex-row hover:font-bold items-center gap-2" [ngClass]="'text-' + (getPersonalizationItem(item, 'color') || 'zinc') + '-500'" >
                    <i class="fa-solid" [ngClass]="getPersonalizationItem(item, 'icon') || 'fa-file'"></i>
                    <h2>{{ item.title }}</h2>
                  </button>
                }
                @empty {
                  <p class="text-sm text-zinc-500">Nenhum documento encontrado.</p>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  </div>`,
  styleUrl: './document-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default
})
export class DocumentEditComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });
  private dialog = inject(Dialog);

  private currentRoute = inject(ActivatedRoute);
  private documentService = inject(DocumentService);
  private router = inject(Router);

  returnUrl?: string;
  document:Document = new Document();
  isLoading = true;
  documentArray:Array<Document> = [];

  readonly documentId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.currentRoute.snapshot.paramMap.get('documentId') ?? '';
  });

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === DocumentEditComponent ||
      this.currentRoute.component === DocumentEditComponent;
  });

  isInDialog = computed(() => !!this.dialogref);

  constructor() {
    this.currentRoute.queryParams.subscribe(queryParams => {
      this.returnUrl = queryParams['returnUrl'];
    });

    this.loadDocument();
    this.loadDocuments();

  }

  ngOnInit(): void {

  }

  loadDocuments() {
    this.documentArray = this.documentService.getDocuments("Document", this.documentId());
  }

  loadDocument() {
    this.document = this.documentService.getDocument(this.documentId());
    this.isLoading = false;
  }

  saveDocument(content?: string) {
    if (content) {
      this.document.content = JSON.stringify(content);
    }

    this.documentService.saveDocument(this.document, this.data?.entityTable, this.data?.entityId);
  }

  getReturnUrl(){
    return this.returnUrl ? decodeURIComponent(this.returnUrl) : '/app/document';
  }

  createDocument(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    let newDoc = new Document('', formData['name'], '');

    newDoc = this.documentService.saveDocument(newDoc, 'Document', this.documentId());
    this.documentArray.push(newDoc);
  }

  openDocument(item: Document) {
    this.dialog.open(DocumentEditComponent, {
      data: { id: item.id, entityTable: "Document", entityId: this.documentId() },
      panelClass: 'screen-dialog',
      height: '80vh',
      width: '80vw',
    });
  }

  getPersonalizationItem(item: any, key: string): string | null {
    if (item.Personalization && item.Personalization.contentJson != null && item.Personalization.contentJson != '') {
      return JSON.parse(item.Personalization.contentJson)[key] || null;
    }
    return null;
  }

}
