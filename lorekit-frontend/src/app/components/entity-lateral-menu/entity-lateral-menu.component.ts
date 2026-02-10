import { AfterViewInit, ChangeDetectionStrategy, Component, inject, input, OnChanges, OnInit, output, SimpleChanges } from '@angular/core';
import { ButtonComponent } from "../button/button.component";
import { DocumentService } from '../../services/document.service';
import { Document } from '../../models/document.model';
import {OverlayModule} from '@angular/cdk/overlay';
import { InputComponent } from "../input/input.component";
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormOverlayDirective, FormField } from '../form-overlay/form-overlay.component';
import { NgClass, NgStyle } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { DocumentEditComponent } from '../../pages/documents/document-edit/document-edit.component';
import { ComboBoxComponent } from "../combo-box/combo-box.component";
import { TextAreaComponent } from "../text-area/text-area.component";
import { debounceTime, Subject } from 'rxjs';
import { getPersonalizationValue, getTextClass, getTextColorStyle } from '../../models/personalization.model';
import { getImageByUsageKey } from '../../models/image.model';
import { IconButtonComponent } from '../icon-button/icon-button.component';

@Component({
  selector: 'app-tree-view-list',
  standalone: true,
  imports: [OverlayModule, RouterModule, FormOverlayDirective, NgClass, NgStyle, IconButtonComponent],
  template: `
    <div class="flex flex-col gap-2">
      @for (item of documentArray(); track item.id) {
        <div class="grid overflow-hidden overflow-ellipsis gap-1" style="grid-template-columns: 1.5rem 1fr 1.5rem;">
          <span class="w-6 flex flex-row items-center">
            @if (!isOpen(item)){
              <app-icon-button (click)="showSubDocuments(item)" size="xs" buttonType="secondaryActive" icon="fa-solid fa-angle-right"></app-icon-button>
            }
            @else {
              <app-icon-button (click)="hideSubDocuments(item)" size="xs" buttonType="secondaryActive" icon="fa-solid fa-angle-down"></app-icon-button>
            }
          </span>
          <button (click)="openDocument(item)" class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2" [ngStyle]="{'color':getTextColorStyle(getPersonalizationValue(item, 'color'))}" >
            <div class="flex flex-row items-center">
              <i class="fa-solid " [ngClass]="getPersonalizationItem(item, 'icon') || 'fa-file'"></i>
            </div>
            <h2 [title]="item.title" class=" text-xs">{{ item.title }}</h2>
          </button>
          <app-icon-button
            size="xs"
            buttonType="secondary"
            icon="fa-solid fa-plus"
            appFormOverlay
            [title]="'Criar Documento'"
            [fields]="[{ key: 'name', label: 'Título', value: '' }]"
            (onSave)="createDocument($event, item.id)"
            ></app-icon-button>
        </div>
        @if (isOpen(item)){
          <span class="pl-4">
            @if (item.SubDocuments && item.SubDocuments.length > 0){
              <app-tree-view-list [entityId]="entityId()" (onArrayChange)="emitChange()" [entityTable]="'Document'" [documentArray]="item.SubDocuments || []"></app-tree-view-list>
            }
            @else{
              <p class="text-xs text-zinc-600">Não há Documentos Relacionados</p>
            }
          </span>
        }
      }
    </div>
  `
})
export class TreeViewListComponent {
  documentArray = input.required<Array<Document>>();

  onArrayChange = output<void>();

  openDocuments = new Set<string>();

  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;
  public getTextColorStyle = getTextColorStyle;

  entityTable = input.required<string>();
  entityId = input.required<string>();

  private documentService = inject(DocumentService);

  private dialog = inject(Dialog);

  getPersonalizationItem(item: any, key: string): string | null {
    if (item.Personalization && item.Personalization.contentJson != null && item.Personalization.contentJson != '') {
      return JSON.parse(item.Personalization.contentJson)[key] || null;
    }
    return null;
  }

  isOpen(document: Document): boolean {
    return this.openDocuments.has(document.id);
  }

  showSubDocuments(document: Document) {
    this.openDocuments.add(document.id);
  }

  hideSubDocuments(document: Document) {
    this.openDocuments.delete(document.id);
  }

  openDocument(item: Document) {
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

  createDocument(formData: Record<string, string>, parentDocumentId: string) {
    if (formData['name'].trim() === '') {
      return;
    }

    let newDoc = new Document('', formData['name'], '');

    newDoc = this.documentService.saveDocument(newDoc, "Document", parentDocumentId);

    this.emitChange();
  }
}

@Component({
  selector: 'app-entity-lateral-menu',
  imports: [ButtonComponent, OverlayModule, InputComponent, RouterModule, FormOverlayDirective, NgClass, ComboBoxComponent, TextAreaComponent, TreeViewListComponent],
  template: `
  <div class="flex flex-col gap-4 w-full h-full">
    <div class="flex flex-row justify-around items-center">
      <button class="px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-zinc-800 " (click)="currentTab = 'properties'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'properties'}">Propriedades</button>
      <button class="px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-zinc-800 " (click)="currentTab = 'documents'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'documents'}">Documentos</button>
    </div>
    @switch (currentTab) {
      @case ('properties') {
        <div class="flex flex-col gap-2 h-[calc(100%-8rem)]  overflow-y-scroll scrollbar-dark">
          @for (field of fieldValues; track field.key) {
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
                height="h-24"
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
            <app-tree-view-list [entityId]="entityId()" [entityTable]="entityTable()" (onArrayChange)="loadDocuments()" [documentArray]="documentArray"></app-tree-view-list>
          <!-- @for (item of documentArray; track $index) {
            <button (click)="openDocument(item)" class=" cursor-pointer flex flex-row hover:font-bold items-center gap-2" [ngStyle]="{'color':getTextColorStyle(getPersonalizationValue(item, 'color'))}" >
              <i class="fa-solid" [ngClass]="getPersonalizationItem(item, 'icon') || 'fa-file'"></i>
              <h2 [title]="item.title" class="whitespace-nowrap overflow-hidden overflow-ellipsis">{{ item.title }}</h2>
            </button>
          }
          @empty {
            <p class="text-sm text-zinc-500">Nenhum documento encontrado.</p>
          } -->
        </div>
      }
    }
  </div>`,
  styleUrl: './entity-lateral-menu.component.css',
})
export class EntityLateralMenuComponent implements OnInit, OnChanges, AfterViewInit {
  documentArray:Array<Document> = [];

  entityTable = input.required<string>();
  entityId = input.required<string>();

  fields = input<FormField[]>([]);
  onSave = output<Record<string, any>>(); // <-- aceitar qualquer tipo (strings, objetos, etc.)

  fieldValues: FormField[] = [];

  public getPersonalizationValue = getPersonalizationValue;
    public getImageByUsageKey = getImageByUsageKey;
    public getTextColorStyle = getTextColorStyle;

  private fieldValueChanges = new Subject<FormField>();
  private initialized = false;

  currentTab = 'properties';

  returnUrl?: string;

  private dialog = inject(Dialog);
  private documentService = inject(DocumentService);
  private currentRoute = inject(ActivatedRoute);
  private router = inject(Router);

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

  getReturnUrlQuery() {
    const tree = this.router.createUrlTree([], { relativeTo: this.currentRoute, queryParams: { returnUrl: this.returnUrl } });
    const baseUrl = this.router.serializeUrl(tree);
    return encodeURIComponent(baseUrl || this.router.url);
  }

  getPersonalizationItem(item: any, key: string): string | null {
    if (item.Personalization && item.Personalization.contentJson != null && item.Personalization.contentJson != '') {
      return JSON.parse(item.Personalization.contentJson)[key] || null;
    }
    return null;
  }

  openDocument(item: Document) {
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

  onFieldValueChange(field: FormField) {

    const idx = this.fieldValues.findIndex(f => f.key === field.key);

    if (idx >= 0) this.fieldValues[idx].value = field.value;

    if (!this.initialized) return; // evita emitir no init
    this.fieldValueChanges.next(field);
  }

  onFieldChange() {
    const formData: Record<string, any> = {}; // <-- não restringir a string
    this.fieldValues.forEach(field => {
      formData[field.key] = field.value;
    });

    this.onSave.emit(formData);
  }

  private syncFieldsFromInput() {
    const src = this.fields() || [];

    // Primeira carga: copia valores iniciais
    if (!this.fieldValues || this.fieldValues.length === 0) {
      this.fieldValues = src.map(f => ({ ...f, value: f.value ?? '' }));
      return;
    }

    // Merge: preserva valores já editados por key
    const currentByKey = new Map(this.fieldValues.map(f => [f.key, f.value]));
    this.fieldValues = src.map(f => {
      const existing = currentByKey.get(f.key);
      return { ...f, value: existing !== undefined ? existing : (f.value ?? '') };
    });
  }

}


