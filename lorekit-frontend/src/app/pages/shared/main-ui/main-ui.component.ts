import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet, RouterLink, ActivatedRoute, Router, RouterLinkActive } from '@angular/router';
import { World } from '../../../models/world.model';
import { WorldStateService } from '../../../services/world-state.service';
import { delay } from 'rxjs';
import { WorldService } from '../../../services/world.service';
import { ButtonComponent } from "../../../components/button/button.component";
import { Dialog } from '@angular/cdk/dialog';
import { SettingsComponent } from '../../settings/settings/settings.component';

@Component({
  selector: 'app-main-ui',
  imports: [RouterOutlet, NgClass, RouterLink, ButtonComponent, RouterLinkActive],
  template: `
  <div class="h-screen w-screen overflow-hidden flex flex-row gap-4 p-4">
    <div class="flex flex-col  justify-between p-4 w-70 bg-zinc-900 rounded-lg top-0" >
      <div>
        <div class="flex flex-col gap-2 mb-4">
          <a class="flex flex-row items-center p-2 text-sm rounded-md font-bold gap-3 hover:bg-zinc-800" routerLink="/app/world" routerLinkActive="bg-yellow-500 text-zinc-800 hover:!bg-yellow-400">
            <i class="fa-solid fa-earth "></i>
            <span class="">Mundos</span>
          </a>
          <a class="flex flex-row items-center p-2 text-sm rounded-md font-bold gap-3 hover:bg-zinc-800" routerLink="/app/location" routerLinkActive="bg-yellow-500 text-zinc-800 hover:!bg-yellow-400">
            <i class="fa-solid fa-city "></i>
            <span class="">Localidades</span>
          </a>
        </div>
      </div>

      <div class="h-20">
        <a (click)="openSettings()" class="flex flex-row items-center p-2 text-sm rounded-md font-bold gap-3 cursor-pointer hover:bg-zinc-800">
          <i class="fa-solid fa-gears "></i>
          <span class="">Configurações</span>
        </a>
      </div>
    </div>
    <div class="p-4 h-screen flex-1">
      <router-outlet />
    </div>
  </div>
  `,
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainUiComponent {
  currentWorld: null | World = null;
  settingsDialog = inject(Dialog);

  worlds: World[] = [];

  constructor(private worldStateService: WorldStateService, private route: ActivatedRoute, private worldService: WorldService, private router: Router) {

  }

  ngOnInit() {

  }

  openSettings() {
    this.settingsDialog.open(SettingsComponent, {
      autoFocus: false,
      restoreFocus: false
    });
  }

}
