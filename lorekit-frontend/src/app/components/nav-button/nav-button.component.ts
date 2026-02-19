import { Component, input } from '@angular/core';
import { StyleType, TextSizeType } from '../../models/styles.type';
import { Params, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-nav-button',
  imports: [NgClass, RouterLink, RouterLinkActive],
  template: `
    @if (this.route() == null){
      <a [ngClass]="getButtonClasses()">
        <div [ngClass]="getContentClasses()">
          @if (icon()) {
            <div [ngClass]="getIconWrapperClasses()">
              <i [class]="icon()"></i>
            </div>
          }
          <span>{{label()}}</span>
        </div>
        <div [ngClass]="getBarClasses()"></div>
      </a>
    }
    @else {
      <a [routerLink]="this.route()" [queryParams]="this.params()" [routerLinkActive]="getRouterLinkActiveClasses()" #rla="routerLinkActive" [ngClass]="getButtonClasses(rla.isActive)">
        <div [ngClass]="getContentClasses()">
          @if (icon()) {
            <div [ngClass]="getIconWrapperClasses()">
              <i [class]="icon()"></i>
            </div>
          }
          <span>{{label()}}</span>
        </div>
        <div [ngClass]="getBarClasses(rla.isActive)"></div>
      </a>
    }
  `,
  styleUrl: './nav-button.component.css',
})
export class NavButtonComponent {

  label = input.required<string>();
  buttonType = input<StyleType>('primary');
  route = input<string>();
  params = input<Params>({});
  active = input<boolean>(false);
  icon = input<string>();
  size = input<TextSizeType>('base');
  direction = input<'down' | 'up' | 'left' | 'right'>('down');
  fullWidth = input<boolean>(false);

  getButtonClasses(routeIsActive: boolean = false):string {
    let layout = this.fullWidth() ? 'w-full flex flex-row items-center rounded-md px-1 py-1' : 'inline-block px-2 py-3';
    const isActive = this.active() || routeIsActive;

    let base = `${layout} cursor-pointer hover:font-bold relative group text-${this.size()}`;

    const types = {
        primary: 'text-white',
        secondary: 'text-white',
        white: 'text-zinc-900',
        danger: 'text-white'
    }

    const activeTypes = {
      primary: 'text-yellow-300 font-bold',
      secondary: 'text-zinc-800 font-bold',
      white: 'text-zinc-50 font-bold',
      danger: 'text-red-600 font-bold'
    }

    return base + ' ' + (isActive ? activeTypes[this.buttonType()] : types[this.buttonType()]) ;
  }

  getContentClasses(): string {
    return this.fullWidth()
      ? 'flex flex-row items-center gap-3 w-full'
      : 'flex flex-col items-center gap-1';
  }

  getIconWrapperClasses(): string {
    return this.fullWidth()
      ? 'w-5 flex flex-row justify-center'
      : '';
  }

  getRouterLinkActiveClasses():string {
    const activeTypes = {
      primary: 'text-yellow-300 font-bold',
      secondary: 'text-zinc-800 font-bold',
      white: 'text-zinc-50 font-bold',
      danger: 'text-red-600 font-bold'
    }

    return activeTypes[this.buttonType()];
  }

  getBarClasses(routeIsActive: boolean = false):string {
    let base = 'absolute rounded-md transition-all duration-300';
    const isActive = this.active() || routeIsActive;

    const positions = {
      down: isActive
        ? 'bottom-0 left-0 w-full h-1'
        : 'bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 group-hover:w-8',
      up: isActive
        ? 'top-0 left-0 w-full h-1'
        : 'top-0 left-1/2 -translate-x-1/2 w-0 h-1 group-hover:w-8',
      left: isActive
        ? 'left-0 top-0 w-1 h-full'
        : 'left-0 top-1/2 -translate-y-1/2 w-1 h-0 group-hover:h-4',
      right: isActive
        ? 'right-0 top-0 w-1 h-full'
        : 'right-0 top-1/2 -translate-y-1/2 w-1 h-0 group-hover:h-4'
    }

    const activeColors = {
      primary: 'bg-yellow-300',
      secondary: 'bg-zinc-800',
      white: 'bg-zinc-50',
      danger: 'bg-red-600'
    }

    return base + ' ' + (isActive ? activeColors[this.buttonType()] : 'bg-white') + ' ' + positions[this.direction()];
  }


}
