import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-world-list',
  imports: [ CommonModule, RouterLink],
  template: `
  <div>
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-2xl font-bold mb-4">Mundos</h3>
      <button *ngIf="worlds.length !== 0" label="Criar Mundo" class="p-button-secondary" size="small"></button>
    </div>

    <div *ngIf="worlds.length === 0; else worldsList" class="text-center">
      <p>No worlds available. Please create a new world.</p>
      <button label="Create New World" routerLink="/app/world/edit" class="mt-4"></button>
    </div>

    <ng-template #worldsList>
      <div class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (world of worlds; track world.id) {
          <div class="cursor-pointer selectable-jump" (click)="onWorldSelected(world.id)">
            <ng-template #title>{{world.name}}</ng-template>
            <ng-template #subtitle>{{world.description}}</ng-template>
        </div>
        }
      </div>
    </ng-template>
  </div>

  `,
  styleUrl: './world-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldListComponent {

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

}
