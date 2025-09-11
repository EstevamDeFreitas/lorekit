import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorldStateService } from '../../../services/world-state.service';
import { ButtonComponent } from "../../../components/button/button.component";

@Component({
  selector: 'app-world-list',
  imports: [CommonModule, RouterLink, ButtonComponent],
  template: `
  <div>
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-2xl mb-4">Mundos</h3>
      <app-button buttonType="white" label="Novo" route="/app/world/info/edit"></app-button>
    </div>

    @if (worlds.length === 0){
      <div class="text-center">
        <p>Nenhum mundo disponível.</p>
        <button label="Criar Novo Mundo" routerLink="/app/world/edit" class="mt-4"></button>
      </div>
    } @else{
      <div class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (world of worlds; track world.id) {
          <div class="cursor-pointer selectable-jump bg-green-700 p-4 rounded-lg" (click)="onWorldSelected(world.id)">
            <div class="text-lg">{{world.name}}</div>
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

}
