import { ChangeDetectionStrategy, Component, inject, input, OnChanges, OnInit, output, SimpleChanges } from '@angular/core';
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
import { ComboBoxComponent } from "../combo-box/combo-box.component";
import { TextAreaComponent } from "../text-area/text-area.component";
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-entity-lateral-menu',
  imports: [ButtonComponent, OverlayModule, InputComponent, RouterModule, FormOverlayDirective, NgClass, ComboBoxComponent, TextAreaComponent],
  template: `
  <div class="flex flex-col gap-4 w-full h-full">
    <div class="flex flex-row justify-around items-center">
      <button class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800 " (click)="currentTab = 'properties'" [ngClass]="{'text-blue-500 bg-blue-300/10 font-bold': currentTab === 'properties'}">Propriedades</button>
      <button class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-800 " (click)="currentTab = 'documents'" [ngClass]="{'text-blue-500 bg-blue-300/10 font-bold': currentTab === 'documents'}">Documentos</button>
    </div>
    @switch (currentTab) {
      @case ('properties') {
        <div class="flex flex-col gap-2 h-[calc(100%-8rem)]  overflow-y-scroll scrollbar-dark">
          @for (field of fields(); track $index) {
            @if (field.options && field.options.length > 0) {
              <app-combo-box
                [label]="field.label"
                [items]="field.options"
                [(comboValue)]="field.value"
                (comboValueChange)="onFieldValueChange(field)"
                [compareProp]="field.optionCompareProp || ''"
                [displayProp]="field.optionDisplayProp || ''"
                >
              </app-combo-box>
            }
            @else if (field.type === 'text-area') {
              <app-text-area
                [label]="field.label"
                [(value)]="field.value"
                (valueChange)="onFieldValueChange(field)"
                >
              </app-text-area>
            }
            @else {
              <app-input
                [label]="field.label"
                [type]="field.type || 'text'"
                [(value)]="field.value"
                (valueChange)="onFieldValueChange(field)"
                >
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
            [fields]="[{ key: 'name', label: 'Título', value: '' }]"
            (onSave)="createDocument($event)"
          ></app-button>
        </div>
        <div class="flex flex-col gap-2 h-[calc(100%-8rem)]  overflow-y-scroll scrollbar-dark">
          @for (item of documentArray; track $index) {
            <button (click)="openDocument(item)" class=" cursor-pointer flex flex-row hover:font-bold items-center gap-2" [ngClass]="'text-' + (getPersonalizationItem(item, 'color') || 'zinc') + '-500'" >
              <i class="fa-solid" [ngClass]="getPersonalizationItem(item, 'icon') || 'fa-file'"></i>
              <h2 [title]="item.title" class="whitespace-nowrap overflow-hidden overflow-ellipsis">{{ item.title }}</h2>
            </button>
          }
          @empty {
            <p class="text-sm text-zinc-500">Nenhum documento encontrado.</p>
          }
        </div>
      }
    }
  </div>`,
  styleUrl: './entity-lateral-menu.component.css',
})
export class EntityLateralMenuComponent implements OnInit {
  documentArray:Array<Document> = [];

  entityTable = input.required<string>();
  entityId = input.required<string>();

  fields = input<FormField[]>([]);
  onSave = output<Record<string, string>>();

  fieldValues: FormField[] = [];

  private fieldValueChanges = new Subject<FormField>();

  currentTab = 'properties';

  returnUrl?: string;

  private dialog = inject(Dialog);
  private documentService = inject(DocumentService);
  private currentRoute = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit() {
    this.loadDocuments();

    this.fieldValues = this.fields();

    this.fieldValueChanges.pipe(
      debounceTime(500) // espera 500ms após a última emissão
    ).subscribe(() => {
      this.onFieldChange();
    });
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

  onFieldValueChange(field: FormField) {
    this.fieldValues.find(f => f.key === field.key)!.value = field.value;

    this.fieldValueChanges.next(field);
  }

  onFieldChange() {
    const formData: Record<string, string> = {};
    this.fieldValues.forEach(field => {
      formData[field.key] = field.value.trim();
    });

    this.onSave.emit(formData);
  }

}
