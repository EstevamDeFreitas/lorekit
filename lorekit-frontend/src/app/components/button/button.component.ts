import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { StyleType } from '../../models/styles.type';
import { Params, Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-button',
  imports: [NgClass, RouterLink, RouterLinkActive],
  template: `
    @if (this.route() == null){
      <button [ngClass]="buttonClasses" [disabled]="disabled()">{{label()}}</button>
    } @else if (!this.useRouteActive()) {
      <a [routerLink]="this.route()" [ngClass]="buttonClasses" >{{label()}}</a>
    }
    @else {
      <a [routerLink]="this.route()" [queryParams]="this.params()" [routerLinkActive]="routeActiveClass" [ngClass]="buttonClasses" >{{label()}}</a>
    }

  `,
  styleUrl: './button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  label = input.required<string>();
  buttonType = input<StyleType>('primary');
  disabled = input<boolean>(false);
  route = input<string>();
  params = input<Params>({});
  useRouteActive = input<boolean>(false);

  get buttonClasses():string {
    const base = 'px-4 py-2 rounded-lg font-medium focus:outline-none transition flex w-full';

    if(!this.useRouteActive()) {
      const types = {
          primary: 'bg-emerald-600 text-white ',
          secondary: 'bg-zinc-800 text-white',
          white: 'bg-zinc-50 text-zinc-900',
          danger: 'bg-red-500 text-white'
      }

      return `${base} ${types[this.buttonType()]} ${this.disabled() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-85 active:brightness-70'}`;
    }

    const types = {
        primary: 'bg-amber-600 text-white',
        secondary: 'bg-zinc-800 text-white',
        white: 'bg-zinc-50 text-zinc-900',
        danger: 'bg-red-500 text-white'
    }

    return `${base} ${this.disabled() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-85 hover:' + types[this.buttonType()] + ' active:brightness-70'}`;
  }

  get routeActiveClass(): string {
    const types = {
        primary: 'bg-amber-600 text-white',
        secondary: 'bg-zinc-800 text-white',
        white: 'bg-zinc-50 text-zinc-900',
        danger: 'bg-red-500 text-white'
    }

    return types[this.buttonType()];
  }
}
