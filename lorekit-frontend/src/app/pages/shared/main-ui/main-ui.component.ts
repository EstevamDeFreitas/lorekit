import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { SettingsComponent } from '../../settings/settings/settings.component';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { animate, query, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-main-ui',
  imports: [RouterOutlet, NavButtonComponent],
  template: `
  <div class="h-screen w-screen overflow-hidden flex flex-row gap-4">
    <div class="flex flex-col  justify-between p-4 w-60 border-r pt-12 border-zinc-800 top-0" >
      <div>
        <div class="flex flex-col gap-2 mb-4">
          <app-nav-button [label]="'Mundos'" [route]="'/app/world'" [icon]="'fa-solid fa-earth'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Localidades'" [route]="'/app/location'" [icon]="'fa-solid fa-location-dot'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Documentos'" [route]="'/app/document'" [icon]="'fa-solid fa-file'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Espécies'" [route]="'/app/specie'" [icon]="'fa-solid fa-paw'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Personagens'" [route]="'/app/character'" [icon]="'fa-solid fa-users'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Culturas'" [route]="'/app/culture'" [icon]="'fa-solid fa-mortar-pestle'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Organizações'" [route]="'/app/organization'" [icon]="'fa-solid fa-building'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Relações'" [route]="'/app/relations'" [icon]="'fa-solid fa-share-nodes'" size="sm" [fullWidth]="true" [direction]="'right'"></app-nav-button>
        </div>
      </div>

      <div class="">
        <a (click)="openSettings()" class="flex flex-row items-center p-2 text-sm rounded-md font-bold gap-3 cursor-pointer hover:bg-zinc-800">
          <i class="fa-solid fa-gears "></i>
          <span class="">Configurações</span>
        </a>
      </div>
    </div>
    <div class="px-4  h-[calc(100vh-2.5rem)] mt-10 overflow-y-auto scrollbar-dark flex-1" [@routeTransition]="routeAnimationState">
      <router-outlet (activate)="onRouteActivate()" />
    </div>
  </div>
  `,
  styleUrl: './main-ui.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
  animations: [
    trigger('routeTransition', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
        ], { optional: true }),
      ])
    ])
  ],
})
export class MainUiComponent {
  settingsDialog = inject(Dialog);
  routeAnimationState = 0;

  onRouteActivate() {
    this.routeAnimationState++;
  }

  openSettings() {
    this.settingsDialog.open(SettingsComponent, {
      autoFocus: false,
      restoreFocus: false,
    });
  }

}
