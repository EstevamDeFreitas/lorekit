import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet, RouterLink, ActivatedRoute, Router } from '@angular/router';
import { World } from '../../../models/world.model';
import { WorldStateService } from '../../../services/world-state.service';
import { delay } from 'rxjs';
import { WorldService } from '../../../services/world.service';
import { ButtonComponent } from "../../../components/button/button.component";

@Component({
  selector: 'app-main-ui',
  imports: [RouterOutlet, NgClass, RouterLink, ButtonComponent],
  template: `
  <div class="h-screen flex flex-row gap-4 p-4">
    <div class="flex flex-col  justify-between p-4 w-70 bg-zinc-900 rounded-lg" >
      <div>
        <div class="text-2xl pb-4 border-b border-zinc-800 flex flex-row gap-2 mb-4 items-center">
          <i class="text-emerald-500 fa-solid fa-map"></i>
          <h2 class=" font-bold">LoreKit</h2>
        </div>
        <div class="flex flex-col gap-4">
          <span class="text-lg">Mundos</span>
          <div class="flex flex-row gap-2 flex-wrap">
            @for (world of worlds; track world.id) {
              <div [title]="world.name" (click)="onWorldSelected(world.id)" class="cursor-pointer flex flex-col bg-zinc-800 w-30 h-20 selectable-jump p-3 rounded-lg hover:bg-green-700" [ngClass]="{'bg-green-700': currentWorld?.id === world.id}">
                <i class="fa-solid text-md mb-2" [ngClass]="worldHasPersonalization(world)? getPersonalization(world, 'icon') : 'fa-earth'"></i>
                <h4 class="text-xs text-ellipsis">{{ world.name }}</h4>
              </div>
            }
            <div class="flex flex-col align-center justify-center cursor-pointer bg-white w-30 h-20 selectable-jump p-3 rounded-lg">
              <h4 class="text-xs text-ellipsis text-center text-zinc-800 font-bold">Novo Mundo</h4>
            </div>
          </div>

        </div>
      </div>

      <div class=""></div>
    </div>
    <div class="p-4 h-auto">
      <router-outlet />
    </div>
  </div>
  `,
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainUiComponent {
  currentWorld: null | World = null;

  worlds: World[] = [];

  constructor(private worldStateService: WorldStateService, private route: ActivatedRoute, private worldService: WorldService, private router: Router) {

  }

  ngOnInit() {
    this.loadWorlds();

    // this.worldStateService.currentWorld$.pipe(delay(0)).subscribe(world => {
    //   this.currentWorld = world;

    //   if (this.currentWorld == null) {
    //     this.route.queryParams.subscribe(params => {
    //       const worldId = params['worldId'];
    //       if (worldId) {
    //         this.worldService.getWorldById(worldId).subscribe({
    //           next: (world) => {
    //             this.currentWorld = world;
    //             this.worldStateService.setWorld(world);
    //           },
    //           error: (err) => {
    //             console.error(err);
    //           }
    //         });
    //       }
    //     });
    //   }
    // });
  }

  loadWorlds() {
    this.worldService.getWorlds().subscribe({
      next: (worlds) => {
        this.worlds = worlds;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  worldHasPersonalization(world: World): boolean {
    return world.personalization != null && world.personalization.contentJson !== '' && JSON.parse(world.personalization.contentJson).icon != null;
  }

  getPersonalization(world: World, key: string): string {
    if (world.personalization) {
      return JSON.parse(world.personalization.contentJson)[key] || '';
    }
    return '';
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
