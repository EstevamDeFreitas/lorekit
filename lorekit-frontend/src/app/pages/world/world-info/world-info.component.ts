import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { WorldStateService } from '../../../services/world-state.service';
import { World } from '../../../models/world.model';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from "../../../components/button/button.component";
import { WorldService } from '../../../services/world.service';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { EditorComponent } from "../../../components/editor/editor.component";

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent, NgClass, FormsModule, IconButtonComponent, EditorComponent],
  template: `
    <div class="flex flex-col ">
      <div class="flex flex-row items-center">
        <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/world"></app-icon-button>
        <input type="text" (blur)="saveWorldName()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="currentWorld.name" />
        <app-icon-button buttonType="white" icon="fa-solid fa-palette" size="xl" title="Personalizar"></app-icon-button>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 mt-10">
        <div class="flex-4 h-auto  flex flex-col">
          <div class="flex flex-row gap-4 ms-1">
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'details'" [ngClass]="{'bg-emerald-500/50': currentTab === 'details'}">Detalhes do mundo</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'localities'" [ngClass]="{'bg-emerald-500/50': currentTab === 'localities'}">Localidades</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'characters'" [ngClass]="{'bg-emerald-500/50': currentTab === 'characters'}">Personagens</a>
            <a class="px-4 py-2 rounded-md text-md cursor-pointer hover:bg-zinc-900" (click)="currentTab = 'objects'" [ngClass]="{'bg-emerald-500/50': currentTab === 'objects'}">Objetos</a>
          </div>
          <div class="p-4 rounded-lg mt-2 flex flex-col">
            @if (!isLoading) {
              @switch (currentTab) {
                @case ('details') {
                  <app-editor [document]="currentWorld.description || ''" (saveDocument)="onDocumentSave($event)" class="w-full"></app-editor>
                }
                @case ('localities') {
                  <p>Localidades</p>
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
        <div class="flex-1 mt-6.5">
          <div class="p-4 rounded-lg mt-4 bg-zinc-900">

          </div>
        </div>
      </div>
    </div>

  `,
  styleUrl: './world-info.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldInfoComponent implements OnInit {
  currentWorld: World = new World();
  currentWorldId: string = '';

  currentTab : string = 'details';

  isLoading: boolean = false;

  constructor(private router:Router, private currentRoute : ActivatedRoute, private worldService : WorldService, private cdr: ChangeDetectorRef) {
    this.isLoading = true;
    this.currentRoute.params.subscribe(params => {
      this.currentWorldId = params['worldId'];

    });
  }

  ngOnInit() {
    this.getWorld();
  }

  getWorld() {
    this.worldService.getWorldById(this.currentWorldId).subscribe({
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
