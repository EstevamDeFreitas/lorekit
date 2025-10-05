import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { WorldStateService } from '../../../services/world-state.service';
import { World } from '../../../models/world.model';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
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

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent, NgIf, NgClass, FormsModule, IconButtonComponent, EditorComponent, PersonalizationButtonComponent, EntityLateralMenuComponent, LocationListComponent],
  template: `
    <div class="flex flex-col h-screen">
      <div class="flex flex-row items-center">
        <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/world"></app-icon-button>
        <input type="text" (blur)="saveWorldName()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="currentWorld.name" />
        <app-personalization-button [entityId]="currentWorld.id" [entityTable]="'world'" [size]="'xl'"></app-personalization-button>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 h-full mt-10">
        <div class="flex-4 h-auto  flex flex-col">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'details'" [ngClass]="{'text-emerald-500 bg-emerald-300/10 font-bold': currentTab === 'details'}">Detalhes do mundo</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'localities'" [ngClass]="{'text-emerald-500 bg-emerald-300/10 font-bold': currentTab === 'localities'}">Localidades</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'characters'" [ngClass]="{'text-emerald-500 bg-emerald-300/10 font-bold': currentTab === 'characters'}">Personagens</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'objects'" [ngClass]="{'text-emerald-500 bg-emerald-300/10 font-bold': currentTab === 'objects'}">Objetos</a>
          </div>
          <div class="p-4 rounded-lg mt-2 flex flex-col h-[calc(100%-8rem)] overflow-y-auto scrollbar-dark">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('details') {
                  <app-editor [document]="currentWorld.description || ''" (saveDocument)="onDocumentSave($event)" class="w-full"></app-editor>
                }
                @case ('localities') {
                  <app-location-list [worldId]="currentWorld.id"></app-location-list>
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
        <div class="flex-1">
          @if (!isLoading && currentWorldId){
            <div class="p-4 rounded-lg bg-zinc-900">
              <app-entity-lateral-menu *ngIf="!isLoading && currentWorldId" entityTable="world" [entityId]="currentWorldId"></app-entity-lateral-menu>
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

  currentTab : string = 'details';

  isLoading: boolean = false;

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
    this.worldService.getWorldById(this.currentWorldId!).subscribe({
      next: (world) => {
        this.currentWorld = world;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading world:', err);
      }
    });
  }

  saveWorldName() {
  if (!this.currentWorld.name || !this.currentWorldId) return;
    this.worldService.updateWorld(this.currentWorld.id, this.currentWorld).subscribe({
      next: (updatedWorld) => {
        this.currentWorld = updatedWorld;
      },
      error: (err) => {
        console.error('Erro ao salvar nome do mundo:', err);
      }
    });
  }

  onDocumentSave(document: any) {
    if (!this.currentWorldId) return;

    this.currentWorld.description = JSON.stringify(document);

    this.worldService.updateWorld(this.currentWorldId, this.currentWorld).subscribe({
      next: (updatedWorld) => {
      },
      error: (err) => {
        console.error('Erro ao salvar documento:', err);
      }
    });
  }

}
