import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { ButtonComponent } from "../button/button.component";
import { DocumentService } from '../../services/document.service';
import { Document } from '../../models/document.model';
import {OverlayModule} from '@angular/cdk/overlay';
import { InputComponent } from "../input/input.component";
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormOverlayDirective, FormField } from '../form-overlay/form-overlay.component';
import { NgClass } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { DocumentEditComponent } from '../../pages/documents/document-edit/document-edit.component';

@Component({
  selector: 'app-entity-lateral-menu',
  imports: [ButtonComponent, OverlayModule, InputComponent, RouterModule, FormOverlayDirective, NgClass],
  template: `
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
  </div>`,
  styleUrl: './entity-lateral-menu.component.css',
})
export class EntityLateralMenuComponent implements OnInit {
  documentArray:Array<Document> = [];

  entityTable = input.required<string>();
  entityId = input.required<string>();

  returnUrl?: string;

  private dialog = inject(Dialog);
  private documentService = inject(DocumentService);
  private currentRoute = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.documentService.getDocuments(this.entityTable(), this.entityId()).subscribe(docs => {
      this.documentArray = docs;
    });
  }

  createDocument(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    const newDoc = new Document('', formData['name'], this.entityTable(), this.entityId());

    this.documentService.saveDocument(newDoc).subscribe(doc => {
      this.documentArray.push(doc);
    });
  }

  getReturnUrlQuery() {
    const tree = this.router.createUrlTree([], { relativeTo: this.currentRoute, queryParams: { returnUrl: this.returnUrl } });
    const baseUrl = this.router.serializeUrl(tree);
    return encodeURIComponent(baseUrl || this.router.url);
  }

  getPersonalizationItem(item: any, key: string): string | null {
    if (item.personalization && item.personalization.contentJson != null && item.personalization.contentJson != '') {
      return JSON.parse(item.personalization.contentJson)[key] || null;
    }
    return null;
  }

  openDocument(item: Document) {
    this.dialog.open(DocumentEditComponent, {
      data: { id: item.id },
      panelClass: 'screen-dialog',
      height: '80vh',
      width: '80vw',
    });
  }

}
