import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { World } from '../../../models/world.model';
import { WorldStateService } from '../../../services/world-state.service';
import { delay } from 'rxjs';

@Component({
  selector: 'app-main-ui',
  imports: [RouterOutlet, ButtonModule, NgClass, RouterLink],
  template: `
  <div class="p-4">
    <div class="flex mb-4" [ngClass]="{ 'justify-between': currentWorld != null, 'justify-end': currentWorld == null }">
      @if (currentWorld != null){
        <button pButton icon="pi pi-globe" routerLink="/app/world" severity="secondary" size="small">{{currentWorld.name}}</button>
      }
      <p-button icon="pi pi-user" size="small" />
    </div>
    <router-outlet />
  </div>
  `,
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainUiComponent {
  currentWorld : null | World  = null;

  constructor(private worldStateService: WorldStateService) {
  }

  ngOnInit() {
    this.worldStateService.currentWorld$.pipe(delay(0)).subscribe(world => {
      this.currentWorld = world;
    });
  }

 }
