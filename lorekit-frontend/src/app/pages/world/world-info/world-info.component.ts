import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorldStateService } from '../../../services/world-state.service';
import { World } from '../../../models/world.model';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { ButtonComponent } from "../../../components/button/button.component";

@Component({
  selector: 'app-world-info',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent],
  template: `
    <div class="flex flex-col ">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-2xl font-bold mb-4"></h3>
      </div>
      <div class="flex gap-4 flex-1 ">
        <div class="w-60 rounded flex flex-col gap-4">
          <app-button buttonType="white" [useRouteActive]="true" label="Informações do Mundo" route="/app/world/info/edit" [params]="{'worldId': currentWorld.id}"></app-button>
          <app-button buttonType="white" [useRouteActive]="true" label="Personagens" route="/" [params]="{'worldId': currentWorld.id}"></app-button>
        </div>
        <div class="h-full w-full p-4 rounded-lg bg-zinc-900">
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
