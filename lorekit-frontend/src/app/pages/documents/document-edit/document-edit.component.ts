import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { DocumentService } from '../../../services/document.service';
import { Document } from '../../../models/document.model';
import { EditorComponent } from "../../../components/editor/editor.component";
import { EntityLateralMenuComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";

@Component({
  selector: 'app-document-edit',
  imports: [IconButtonComponent, PersonalizationButtonComponent, FormsModule, EditorComponent, EntityLateralMenuComponent],
  template: `
  <div class="flex flex-col">
    <div class="flex flex-row items-center">
      <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" [route]="getReturnUrl()"></app-icon-button>
      <input type="text" (blur)="saveDocument()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="document.title" />
      <app-personalization-button [entityId]="documentId" [entityTable]="'document'" [size]="'xl'"></app-personalization-button>
      <div class="flex-2"></div>
    </div>
    <div class="flex flex-row gap-4 mt-10">
      <div class="flex-4 h-auto  flex flex-col">
        @if (!isLoading) {
          <app-editor [document]="document.content || ''" (saveDocument)="saveDocument($event)" class="w-full"></app-editor>
        }
      </div>
      <div class="flex-1">
        @if (!isLoading) {
          <div class="p-4 rounded-lg bg-zinc-900">
            <app-entity-lateral-menu entityTable="document" [entityId]="documentId"></app-entity-lateral-menu>
          </div>
        }
      </div>
    </div>
  </div>`,
  styleUrl: './document-edit.component.css',
})
export class DocumentEditComponent implements OnInit {
  documentId: string = '';

  document:Document = new Document();

  returnUrl?: string;

  isLoading = true;

  constructor(private router:Router, private currentRoute : ActivatedRoute, private documentService: DocumentService) {
    this.currentRoute.params.subscribe(params => {
      this.documentId = params['documentId'];
    });

    this.currentRoute.queryParams.subscribe(queryParams => {
      this.returnUrl = queryParams['returnUrl'];
    });
  }

  ngOnInit(): void {
    this.currentRoute.params.subscribe(params => {
      this.documentId = params['documentId'];
      this.isLoading = true;
      this.loadDocument();
    });
  }

  loadDocument() {
    this.documentService.getDocument(this.documentId).subscribe(doc => {
      this.document = doc;
      this.isLoading = false;
    });
  }

  saveDocument(content?: string) {
    if (content) {
      this.document.content = JSON.stringify(content);
    }

    this.documentService.saveDocument(this.document).subscribe(() => {
      if (this.returnUrl) {
        this.router.navigateByUrl(this.returnUrl);
      }
    });
  }

  getReturnUrl(){
    return this.returnUrl ? decodeURIComponent(this.returnUrl) : '/app/document';
  }

}
