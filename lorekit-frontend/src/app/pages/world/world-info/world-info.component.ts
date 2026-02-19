import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, OnInit } from '@angular/core';
import { WorldStateService } from '../../../services/world-state.service';
import { World } from '../../../models/world.model';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { NgClass, NgIf, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from "../../../components/button/button.component";
import { WorldService } from '../../../services/world.service';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { EditorComponent } from "../../../components/editor/editor.component";
import { Dialog } from '@angular/cdk/dialog';
import { PersonalizationComponent } from '../../../components/personalization/personalization.component';
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { EntityLateralMenuComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";
import { LocationListComponent } from "../../locations/location-list/location-list.component";
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { ImageUploaderComponent } from "../../../components/ImageUploader/image-uploader.component";
import { getImageByUsageKey, Image } from '../../../models/image.model';
import { ImageService } from '../../../services/image.service';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { DynamicFieldsComponent } from "../../../components/DynamicFields/DynamicFields.component";
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { EntityTransferButtonComponent } from '../../../components/entity-transfer-button/entity-transfer-button.component';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";

@Component({
  standalone: true,
  imports: [NgStyle, NgClass, FormsModule, IconButtonComponent, EditorComponent, PersonalizationButtonComponent, EntityLateralMenuComponent, LocationListComponent, SafeDeleteButtonComponent, DynamicFieldsComponent, EntityTransferButtonComponent, NavButtonComponent],
  template: `
    <div class="flex flex-col">
      @if(getImageByUsageKey(currentWorld.Images, 'default') != null){
        @let img = getImageByUsageKey(currentWorld.Images, 'default');
        <div class="relative w-full h-[30vh]  overflow-hidden">
          <img [src]="img?.filePath" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950"></div>
        </div>
      }
      @else{
        <div class="w-full h-[30vh] object-cover rounded-md bg-gradient-to-b from-transparent to-zinc-950" [ngStyle]="{'background-image': 'linear-gradient(to bottom, ' + (getPersonalizationValue(currentWorld, 'color') || 'var(--color-zinc-800)') + ', var(--color-zinc-950))'}"></div>
      }
      <div class="flex flex-row items-center sticky py-2 top-0 z-50 bg-zinc-950">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/world"></app-icon-button>
        }
        <input type="text" (blur)="saveWorldName()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="currentWorld.name" />
        <div class="flex flex-row gap-2">
          <app-entity-transfer-button [entityId]="currentWorld.id" [entityTable]="'World'" [size]="'xl'"></app-entity-transfer-button>
          <app-personalization-button [entityId]="currentWorld.id" [entityTable]="'World'" [size]="'xl'" (onClose)="getWorld()"></app-personalization-button>
          <app-safe-delete-button [entityName]="currentWorld.name" [entityId]="currentWorld.id" [entityTable]="'World'" [size]="'xl'" ></app-safe-delete-button>
        </div>
      </div>
      <div class="flex flex-row gap-4 flex-1 mt-10">
        <div class="flex-4 flex flex-col">
          <div class="flex flex-row gap-4 ms-1">
            <app-nav-button [label]="'Detalhes do mundo'" size="sm" [active]="currentTab === 'details'" (click)="currentTab = 'details'"></app-nav-button>
            @if(hasDynamicFields) {
              <app-nav-button [label]="'Propriedades'" size="sm" [active]="currentTab === 'properties'" (click)="currentTab = 'properties'"></app-nav-button>
            }
            <app-nav-button [label]="'Localidades'" size="sm" [active]="currentTab === 'localities'" (click)="currentTab = 'localities'"></app-nav-button>
            <!-- <app-nav-button [label]="'Personagens'" size="sm" [active]="currentTab === 'characters'" (click)="currentTab = 'characters'"></app-nav-button>
            <app-nav-button [label]="'Objetos'" size="sm" [active]="currentTab === 'objects'" (click)="currentTab = 'objects'"></app-nav-button> -->
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('details') {
                  <div class="w-full flex-1">
                    <app-editor [entityId]="currentWorld.id" docTitle="Descrição" entityTable="World" [entityName]="currentWorld.name" [document]="currentWorld.description || ''" (saveDocument)="onDocumentSave($event)"></app-editor>
                  </div>
                }
                @case ('localities') {
                  <div class="w-full flex-1">
                    <app-location-list [worldId]="currentWorld.id"></app-location-list>
                  </div>
                }
                @case ('characters') {
                  <p>Personagens</p>
                }
                @case ('objects') {
                  <p>Objetos</p>
                }
                @case ('properties'){
                  <app-dynamic-fields [entityTable]="'World'" [entityId]="currentWorld.id"></app-dynamic-fields>
                }
              }
            }

          </div>

        </div>
        <div class="w-70">
          @if (!isLoading && currentWorldId){
            <div class="p-4 rounded-lg bg-zinc-900 sticky top-20">
              <app-entity-lateral-menu [fields]="fields" (onSave)="onWorldSave($event)" entityTable="World" [entityId]="currentWorldId"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>

  `,
  styleUrl: './world-info.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldInfoComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  currentWorld: World = new World();
  currentWorldId: string | null = null;

  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab : string = 'details';

  isLoading: boolean = false;

  fields: FormField[] = [];

  private dynamicFieldService = inject(DynamicFieldService);
  hasDynamicFields: boolean = this.dynamicFieldService.getDynamicFields('World').length > 0;

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === WorldInfoComponent ||
      this.currentRoute.component === WorldInfoComponent;
  });

  readonly worldId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.currentRoute.snapshot.paramMap.get('worldId') ?? this.currentWorldId ?? '';
  });

  constructor(private router:Router, private currentRoute : ActivatedRoute, private worldService : WorldService, private cdr: ChangeDetectorRef) {
    this.isLoading = true;
    if (this.data?.id) {
      this.currentWorldId = this.data.id;
      this.getWorld();
    } else {
      this.currentRoute.params.subscribe(params => {
        this.currentWorldId = params['worldId'];
        this.getWorld();
      });
    }
  }

  ngOnInit() {

  }

  getWorld() {
    const id = this.worldId();
    if (!id) {
      this.isLoading = false;
      return;
    }

    this.currentWorldId = id;
    this.currentWorld = this.worldService.getWorldById(id);
    this.buildFields();

    this.isLoading = false;
  }

  saveWorldName() {
  if (!this.currentWorld.name || !this.currentWorldId) return;
    this.worldService.updateWorld(this.currentWorld.id, this.currentWorld);
  }

  onDocumentSave(document: any) {
    if (!this.currentWorldId) return;

    this.currentWorld.description = JSON.stringify(document);

    this.worldService.updateWorld(this.currentWorldId, this.currentWorld)
  }

  onWorldSave(formData: Record<string, string>) {
    this.currentWorld.concept = formData['concept'];

    this.worldService.updateWorld(this.currentWorld.id, this.currentWorld);
  }

  private buildFields() {
    this.fields = [
      { key: 'concept', label: 'Conceito', value: this.currentWorld.concept || '', type: 'text-area' },
    ];
  }

}
