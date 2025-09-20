import { ChangeDetectionStrategy, Component, input, OnInit } from '@angular/core';
import { ButtonComponent } from "../button/button.component";
import { DocumentService } from '../../services/document.service';
import { Document } from '../../models/document.model';
import {OverlayModule} from '@angular/cdk/overlay';
import { InputComponent } from "../input/input.component";
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-entity-lateral-menu',
  imports: [ButtonComponent, OverlayModule, InputComponent, RouterModule],
  template: `
  <div class="flex flex-col gap-4">
    <div class="flex flex-row justify-between items-center">
      <h3 class="text-base">Documentos</h3>
      <app-button label="Novo" size="xs" icon="fa-plus" buttonType="white" (click)="documentCreationOpen = !documentCreationOpen" cdkOverlayOrigin #trigger="cdkOverlayOrigin"></app-button>
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="trigger"
        [cdkConnectedOverlayOpen]="documentCreationOpen"
        [cdkConnectedOverlayPositions]="[
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'end',
            overlayY: 'top'
          }
        ]"
        >
        <div class="bg-zinc-800 p-2 rounded-md">
          <div class="mb-2 text-bold">Criar Novo Documento</div>
          <div class="flex flex-col gap-2">
            <app-input [label]="'Título do Documento'" [(value)]="newDocumentTitle"></app-input>
            <app-button label="Criar" (click)="createDocument()"></app-button>
          </div>
        </div>
      </ng-template>
    </div>
    <div class="flex flex-col gap-2 max-h-50 overflow-y-scroll scrollbar-dark">
      @for (item of documentArray; track $index) {
        <a [routerLink]="['/app/document/edit', item.id]" [queryParams]="{ returnUrl: getReturnUrlQuery() }" class="p-2 rounded-md border border-zinc-800 hover:bg-zinc-800 cursor-pointer" >
          <h2>{{ item.title }}</h2>
        </a>
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

  documentCreationOpen = false;

  newDocumentTitle = '';

  entityTable = input.required<string>();
  entityId = input.required<string>();

  returnUrl?: string;

  constructor(private documentService: DocumentService, private currentRoute : ActivatedRoute, private router:Router) {
  }

  ngOnInit() {
    this.loadDocuments();
  }


  loadDocuments() {
    this.documentService.getDocuments(this.entityTable(), this.entityId()).subscribe(docs => {
      this.documentArray = docs;
    });
  }

  createDocument() {
    if (this.newDocumentTitle.trim() === '') {
      return;
    }

    const newDoc = new Document('', this.newDocumentTitle, this.entityTable(), this.entityId());

    this.documentService.saveDocument(newDoc).subscribe(doc => {
      this.documentArray.push(doc);
      this.newDocumentTitle = '';
      this.documentCreationOpen = false;
    });
  }

  getReturnUrlQuery() {
    const tree = this.router.createUrlTree([], { relativeTo: this.currentRoute, queryParams: { returnUrl: this.returnUrl } });
    const baseUrl = this.router.serializeUrl(tree);
    return encodeURIComponent(baseUrl || this.router.url);
  }

}
