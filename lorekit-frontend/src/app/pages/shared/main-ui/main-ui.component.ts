import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet, RouterLink, ActivatedRoute, Router } from '@angular/router';
import { World } from '../../../models/world.model';
import { WorldStateService } from '../../../services/world-state.service';
import { delay } from 'rxjs';
import { WorldService } from '../../../services/world.service';

@Component({
  selector: 'app-main-ui',
  imports: [RouterOutlet, NgClass, RouterLink],
  template: `
  <div class="h-screen">
    <div class="flex mb-4 p-4" [ngClass]="{ 'justify-between': currentWorld != null, 'justify-end': currentWorld == null }">
      @if (currentWorld != null){
        <button routerLink="/app/world" severity="secondary" size="small">{{currentWorld.name}}</button>
      }
      <i ></i>
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
  currentWorld : null | World  = null;

  constructor(private worldStateService: WorldStateService, private route: ActivatedRoute, private worldService: WorldService, private router:Router) {

  }

  ngOnInit() {
    this.worldStateService.currentWorld$.pipe(delay(0)).subscribe(world => {
      this.currentWorld = world;

      if(this.currentWorld == null) {
        this.route.queryParams.subscribe(params => {
          const worldId = params['worldId'];
          if (worldId) {
            this.worldService.getWorldById(worldId).subscribe({
              next: (world) => {
                this.currentWorld = world;
                this.worldStateService.setWorld(world);
              },
              error: (err) => {
                console.error(err);
              }
            });
          }
        });
      }
    });
  }

 }
