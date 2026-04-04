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
  <div class="h-screen w-screen overflow-hidden flex flex-row">
    <div class="flex flex-col bg-zinc-900 justify-between ps-4 w-15 border-r pt-4 pb-4 border-zinc-700 top-0" >

      <div>
        <div class="pr-3 mb-8">
          <img src="assets/lorekit-logo.png" alt="Lorekit">
        </div>
        <div class="flex flex-col gap-4 mb-4">
          <app-nav-button [label]="'Mundos'" [showLabel]="false" [route]="'/app/world'" [icon]="'fa-solid fa-earth'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Localidades'" [showLabel]="false" [route]="'/app/location'" [icon]="'fa-solid fa-location-dot'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Documentos'" [showLabel]="false" [route]="'/app/document'" [icon]="'fa-solid fa-file'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Linhas do Tempo'" [showLabel]="false" [route]="'/app/timeline'" [icon]="'fa-solid fa-timeline'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Espécies'" [showLabel]="false" [route]="'/app/specie'" [icon]="'fa-solid fa-paw'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Personagens'" [showLabel]="false" [route]="'/app/character'" [icon]="'fa-solid fa-users'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Culturas'" [showLabel]="false" [route]="'/app/culture'" [icon]="'fa-solid fa-mortar-pestle'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Organizações'" [showLabel]="false" [route]="'/app/organization'" [icon]="'fa-solid fa-building'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
          <app-nav-button [label]="'Relações'" [showLabel]="false" [route]="'/app/relations'" [icon]="'fa-solid fa-share-nodes'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
        </div>
      </div>

      <div class="">
        <app-nav-button [label]="'Configurações'" (click)="openSettings()" [showLabel]="false" [icon]="'fa-solid fa-gears'" size="xl" [fullWidth]="true" [direction]="'right'"></app-nav-button>
      </div>
    </div>
    <div class="pr-4  h-[calc(100vh-2.5rem)] mt-10 overflow-y-auto scrollbar-dark flex-1" [@routeTransition]="routeAnimationState">
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
          style({ opacity: 0 }),
          animate('180ms ease-out', style({ opacity: 1 }))
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
