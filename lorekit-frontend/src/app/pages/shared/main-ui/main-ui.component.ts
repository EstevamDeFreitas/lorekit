import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet, RouterLink, ActivatedRoute, Router, RouterLinkActive } from '@angular/router';
import { World } from '../../../models/world.model';
import { WorldStateService } from '../../../services/world-state.service';
import { delay } from 'rxjs';
import { WorldService } from '../../../services/world.service';
import { ButtonComponent } from "../../../components/button/button.component";

@Component({
  selector: 'app-main-ui',
  imports: [RouterOutlet, NgClass, RouterLink, ButtonComponent, RouterLinkActive],
  template: `
  <div class="h-screen w-screen flex flex-row gap-4 p-4">
    <div class="flex flex-col  justify-between p-4 w-70 bg-zinc-900 rounded-lg" >
      <div>
        <div class="text-2xl pb-4 border-b border-zinc-800 flex flex-row gap-2 mb-4 items-center">
          <i class="text-emerald-500 fa-solid fa-map"></i>
          <h2 class=" font-bold">LoreKit</h2>
        </div>
        <a class="flex flex-col p-2 rounded-md font-bold gap-4 hover:bg-zinc-800" routerLink="/app/world" routerLinkActive="bg-emerald-500 text-zinc-800 hover:!bg-emerald-500">
          <span class="text-md">Mundos</span>
        </a>
      </div>

      <div class=""></div>
    </div>
    <div class="p-4 h-auto flex-1">
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

  }

}
