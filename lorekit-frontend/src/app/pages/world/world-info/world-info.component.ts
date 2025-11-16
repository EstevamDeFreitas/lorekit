import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
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
import { Image } from '../../../models/image.model';
import { ImageService } from '../../../services/image.service';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue } from '../../../models/personalization.model';

@Component({
  standalone: true,
  imports: [NgStyle, NgClass, FormsModule, IconButtonComponent, EditorComponent, PersonalizationButtonComponent, EntityLateralMenuComponent, LocationListComponent, SafeDeleteButtonComponent],
  template: `
    <div class="flex flex-col h-screen">
      @if(currentWorld.Image){
        <img [src]="currentWorld.Image.filePath" class="w-full h-36 object-cover rounded-md">
      }
      @else{
        <div class="w-full h-36 object-cover rounded-md" [ngStyle]="{'background-color': getPersonalizationValue(currentWorld, 'color') || 'var(--color-zinc-800)'}"></div>
      }
      <br>
      <div class="flex flex-row items-center">
        <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/world"></app-icon-button>
        <input type="text" (blur)="saveWorldName()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="currentWorld.name" />
        <div class="flex flex-row gap-2">
          <app-personalization-button [entityId]="currentWorld.id" [entityTable]="'World'" [size]="'xl'" (onClose)="getWorld()"></app-personalization-button>
          <app-safe-delete-button [entityName]="currentWorld.name" [entityId]="currentWorld.id" [entityTable]="'World'" [size]="'xl'" ></app-safe-delete-button>
        </div>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 flex-1 overflow-hidden h-full mt-10">
        <div class="flex-4 h-auto  flex flex-col overflow-hidden">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'details'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'details'}">Detalhes do mundo</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'localities'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'localities'}">Localidades</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'characters'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'characters'}">Personagens</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'objects'" [ngClass]="{'text-yellow-500 bg-yellow-300/10 font-bold': currentTab === 'objects'}">Objetos</a>
          </div>
          <div class="p-4 pb-10 rounded-lg mt-2 flex-1 overflow-hidden flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('details') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-editor docTitle="Descrição" entityTable="World" [entityName]="currentWorld.name" [document]="currentWorld.description || ''" (saveDocument)="onDocumentSave($event)"></app-editor>
                  </div>
                }
                @case ('localities') {
                  <div class="w-full flex-1 overflow-y-auto scrollbar-dark">
                    <app-location-list [worldId]="currentWorld.id"></app-location-list>
                  </div>
                }
                @case ('characters') {
                  <p>Personagens</p>
                }
                @case ('objects') {
                  <p>Objetos</p>
                }
              }
            }

          </div>

        </div>
        <div class="w-70">
          @if (!isLoading && currentWorldId){
            <div class="p-4 rounded-lg bg-zinc-900 ">
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
  currentWorld: World = new World();
  currentWorldId: string | null = null;

  public getPersonalizationValue = getPersonalizationValue;

  currentTab : string = 'details';

  isLoading: boolean = false;

  fields: FormField[] = [];

  constructor(private router:Router, private currentRoute : ActivatedRoute, private worldService : WorldService, private cdr: ChangeDetectorRef) {
    this.isLoading = true;
    this.currentRoute.params.subscribe(params => {
      this.currentWorldId = params['worldId'];
      this.getWorld();
    });
  }

  ngOnInit() {

  }

  getWorld() {
    this.currentWorld = this.worldService.getWorldById(this.currentWorldId!);
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
