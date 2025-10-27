import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorldStateService } from '../../../services/world-state.service';
import { ButtonComponent } from "../../../components/button/button.component";
import {OverlayModule} from '@angular/cdk/overlay';
import { InputComponent } from "../../../components/input/input.component";
import { ImageService } from '../../../services/image.service';
import { environment } from '../../../../enviroments/environment';
import { buildImageUrl } from '../../../models/image.model';

@Component({
  selector: 'app-world-list',
  imports: [CommonModule, RouterLink, ButtonComponent, NgClass, OverlayModule, InputComponent],
  template: `
  <div class="h-screen flex flex-col">
    <div class="flex flex-row justify-between items-center mb-4">
      <h3 class="text-xl font-bold">Mundos</h3>
      <app-button buttonType="white" label="Novo" (click)="worldCreationOpen = !worldCreationOpen" cdkOverlayOrigin #trigger="cdkOverlayOrigin"></app-button>
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="trigger"
        [cdkConnectedOverlayOpen]="worldCreationOpen"
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
          <div class="mb-2 text-bold">Criar Novo Mundo</div>
          <div class="flex flex-col gap-2">
            <app-input [label]="'Nome do Mundo'" [(value)]="newWorldName"></app-input>
            <app-button label="Criar" (click)="createWorld()"></app-button>
          </div>
        </div>
      </ng-template>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-dark">
      <br>
      @if (worlds.length === 0){
        <div class="text-center">
          <p>Nenhum mundo disponível.</p>
          <!-- <button label="Criar Novo Mundo" routerLink="/app/world/edit" class="mt-4"></button> -->
        </div>
      } @else{
        <div class=" grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (world of worlds; track world.id) {
            @if(world.Image != null) {
              <div class="rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2" [ngStyle]="{'background-image': 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(' + buildImageUrl(world.Image.filePath) + ')', 'background-size': 'cover', 'background-position': 'center'}" (click)="onWorldSelected(world.id)">
                <div class="flex flex-row gap-2 items-center">
                  <i class="fa-solid text-xl" [ngClass]="getPersonalizationItem(world, 'icon') || 'fa-earth'"></i>
                  <div class="text-base font-bold">{{world.name}}</div>
                </div>
                <div class="text-xs">{{world.concept}}</div>
              </div>
            }
            @else{
              <div class="rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2" [ngClass]="getWorldColor(world)" (click)="onWorldSelected(world.id)">
                <div class="flex flex-row gap-2 items-center">
                  <i class="fa-solid text-xl" [ngClass]="getPersonalizationItem(world, 'icon') || 'fa-earth'"></i>
                  <div class="text-base font-bold">{{world.name}}</div>
                </div>
                <div class="text-xs">{{world.concept}}</div>
              </div>
            }

          }
        </div>
      }
    </div>


  </div>

  `,
  styleUrl: './world-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldListComponent {
  worldCreationOpen = false;
  newWorldName = '';

  public buildImageUrl = buildImageUrl;

  worlds: World[] = [];

  private imageService = inject(ImageService);
  worldsWithImages: { [key: string]: string | undefined } = {};

  constructor(private worldService: WorldService, private worldStateService : WorldStateService, private router:Router) { }

  ngOnInit() {
    this.worldStateService.clearWorld();
    this.loadWorlds();
  }

  trackById(index: number, world: World) {
    return world.id;
  }

  loadWorlds() {
    this.worlds = this.worldService.getWorlds();
  }

  onWorldSelected(worldId : string) {
    const world = this.worlds.find(w => w.id === worldId);

    if (!world) {
      return;
    }

    this.worldStateService.setWorld(world);

    this.router.navigate(['/app/world/info', worldId]);
  }

  getPersonalizationItem(world: World, key: string): string | null {
    if (world.Personalization && world.Personalization.contentJson != null && world.Personalization.contentJson != '') {
      return JSON.parse(world.Personalization.contentJson)[key] || null;
    }
    return null;
  }

  getWorldColor(world: World): string {
    const color = this.getPersonalizationItem(world, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createWorld() {
    if (this.newWorldName.trim() === '') {
      return;
    }

    const newWorld: World = {
      id: '',
      name: this.newWorldName,
      description: ''
    };

    this.worldService.createWorld(newWorld);
    this.worldCreationOpen = false;
    this.loadWorlds();
  }


}
