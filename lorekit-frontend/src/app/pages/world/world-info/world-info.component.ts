import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorldStateService } from '../../../services/world-state.service';
import { World } from '../../../models/world.model';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-world-info',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex flex-col ">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-2xl font-bold mb-4"></h3>
      </div>
      <div class="flex gap-4 flex-1 ">
        <div class="w-84 bg-(--p-zinc-900) p-4 rounded flex flex-col gap-2">
          <a link size="small" class="w-full !flex !justify-start" routerLinkActive="p-highlight" routerLink="/app/world/info/edit" [queryParams]="{'worldId': currentWorld.id}">
            <i class="pi pi-info"></i>
            <span>Informações do Mundo</span>
          </a>
          <a size="small" class="w-full !flex !justify-start" routerLink="/" [queryParams]="{'worldId': currentWorld.id}">
            <i class="pi pi-info"></i>
            <span>Personagens</span>
          </a>
        </div>
        <div class="h-full">
          <router-outlet />
        </div>
      </div>
    </div>

  `,
  styleUrl: './world-info.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldInfoComponent {
  currentWorld: World = new World();

  constructor(private worldStateService: WorldStateService, private router:Router) {

  }

  ngOnInit() {
    let world = this.worldStateService.getCurrentWorld();

    if(world == null) {
      this.router.navigate(['/app/world']);
      return;
    }

    this.currentWorld = world;

  }

}
