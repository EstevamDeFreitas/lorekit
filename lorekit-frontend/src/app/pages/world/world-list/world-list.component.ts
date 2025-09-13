import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorldStateService } from '../../../services/world-state.service';
import { ButtonComponent } from "../../../components/button/button.component";
import {OverlayModule} from '@angular/cdk/overlay';
import { InputComponent } from "../../../components/input/input.component";

@Component({
  selector: 'app-world-list',
  imports: [CommonModule, RouterLink, ButtonComponent, NgClass, OverlayModule, InputComponent],
  template: `
  <div>
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-2xl mb-4">Mundos</h3>
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

    @if (worlds.length === 0){
      <div class="text-center">
        <p>Nenhum mundo disponível.</p>
        <!-- <button label="Criar Novo Mundo" routerLink="/app/world/edit" class="mt-4"></button> -->
      </div>
    } @else{
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        @for (world of worlds; track world.id) {
          <div class="cursor-pointer flex flex-col gap-2 selectable-jump border border-zinc-700 bg-zinc-900 p-4 rounded-lg" (click)="onWorldSelected(world.id)">
            <i class="fa-solid text-xl" [ngClass]="getPersonalizationItem(world, 'icon') || 'fa-earth'"></i>
            <div class="text-md font-bold">{{world.name}}</div>
        </div>
        }
      </div>
    }

  </div>

  `,
  styleUrl: './world-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldListComponent {
  worldCreationOpen = false;
  newWorldName = '';

  worlds: World[] = [];

  constructor(private worldService: WorldService, private worldStateService : WorldStateService, private router:Router) { }

  ngOnInit() {
    this.worldStateService.clearWorld();
    this.loadWorlds();
  }

  trackById(index: number, world: World) {
    return world.id;
  }

  loadWorlds() {
    this.worldService.getWorlds().subscribe({
      next: (worlds) => {
        console.log(worlds);

        this.worlds = worlds;
      },
      error: (err) => {
        console.error('Error loading worlds:', err);
      }
    });
  }

  onWorldSelected(worldId : string) {
    const world = this.worlds.find(w => w.id === worldId);

    if (!world) {
      return;
    }

    this.worldStateService.setWorld(world);

    this.router.navigate(['/app/world/info'], {
      queryParams: { worldId: world.id }
    });
  }

  getPersonalizationItem(world: World, key: string): string | null {
    if (world.personalization && world.personalization.contentJson != null && world.personalization.contentJson != '') {
      return JSON.parse(world.personalization.contentJson)[key] || null;
    }
    return null;
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
    this.worldService.createWorld(newWorld).subscribe({
      next: (createdWorld) => {
        this.worlds.push(createdWorld);
        this.newWorldName = '';
        this.worldCreationOpen = false;
      },
      error: (err) => {
        console.error('Error creating world:', err);
      }
    });
  }
}
