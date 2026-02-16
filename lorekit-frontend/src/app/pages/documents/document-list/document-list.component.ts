import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { LocationService } from '../../../services/location.service';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { OrganizationService } from '../../../services/organization.service';
import { WorldService } from '../../../services/world.service';
import { DocumentService } from '../../../services/document.service';
import { Dialog } from '@angular/cdk/dialog';
import { World } from '../../../models/world.model';
import { Document } from '../../../models/document.model';
import { Location } from '../../../models/location.model';
import { Organization } from '../../../models/organization.model';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../components/button/button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-document-list',
  imports: [NgClass, NgStyle, FormsModule],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row justify-between items-center mb-4 sticky  z-25 bg-zinc-950 py-2" [ngClass]="{'top-0': isRouteComponent(), 'top-13': !isRouteComponent()}">
        @if (isRouteComponent()){
          <h2 class="text-xl font-bold">Documentos Principais</h2>
        }
        @else {
          <div></div>
        }

      </div>
      <div >
        <!-- <br>
        <div class="flex flex-row items-center gap-4">
          @if(!worldId()){
            <app-combo-box class="w-60" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name"  [(comboValue)]="selectedWorld" (comboValueChange)="onWorldSelect()"></app-combo-box>
          }
        </div> -->
        <br>
        <div class=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @if (documents.length === 0){
            <div class="text-center">
              <p>Nenhum documento disponível.</p>
            </div>
          }
          @else {
            @for (document of documents; track document.id) {
              @let img = getImageByUsageKey(document.Images, 'default');
              <div (click)="selectDocument(document.id!)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2',

                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(document, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(document, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(document, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ document.title }}</div>
                    </div>
                    <!-- <div class="flex flex-row gap-1">
                      <div class="text-xs flex text-nowrap flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-earth"></i>
                        <div class="">{{document.ParentWorld?.name}}</div>
                      </div>
                      <div class="text-xs text-nowrap overflow-ellipsis flex flex-row gap-1 items-center p-1 rounded-md bg-zinc-900 text-white w-min">
                        <i class="fa fa-location-dot"></i>
                        <div class="">{{document.ParentLocation?.name}}</div>
                      </div>
                    </div> -->
                  </div>
                </div>
              </div>
            }
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

  dialog = inject(Dialog);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === DocumentListComponent ||
      this.activatedRoute.component === DocumentListComponent;
  });

  worldId = input<string>();
  availableWorlds : World[] = [];
  availableLocations : Location[] = [];
  documents : Document[] = [];

  selectedWorld : string = '';

  ngOnInit(): void {
    // this.worldStateService.currentWorld$.subscribe(world => {
    //   this.selectedWorld = world ? world.id : '';
    // });
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
    this.documents = this.worldId() || this.selectedWorld ? this.documentService.getDocumentsByWorldId(this.worldId() || this.selectedWorld) : this.documentService.getAllDocuments();
  }

  onWorldSelect(){
    this.getDocuments();
  }

  selectDocument(documentId: string) {
    if (this.isRouteComponent()) {
      this.router.navigate(['app/document/edit', documentId]);
    }
    else {
      import('../document-edit/document-edit.component').then(({ DocumentEditComponent }) => {
        const dialogRef = this.dialog.open(DocumentEditComponent, {
          data: { id: documentId },
          panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'],
          height: '80vh',
          width: '80vw',
        });

        dialogRef.closed.subscribe(() => {
          this.getDocuments();
        });
      });
    }
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
