import { Component, input } from '@angular/core';
import { StyleType, TextSizeType } from '../../models/styles.type';
import { Params, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-nav-button',
  imports: [NgClass, RouterLink, RouterLinkActive],
  templateUrl: './nav-button.component.html',
  styleUrl: './nav-button.component.css',
})
export class NavButtonComponent {

  label = input.required<string>();
  buttonType = input<StyleType>('primary');
  route = input<string>();
  params = input<Params>({});
  active = input<boolean>(false);
  activeColor = input<string>();
  icon = input<string>();
  size = input<TextSizeType>('base');
  direction = input<'down' | 'up' | 'left' | 'right'>('down');
  fullWidth = input<boolean>(false);
  showLabel = input<boolean>(true);

  getButtonClasses(routeIsActive: boolean = false):string {
    let layout = this.fullWidth() ? 'w-full flex flex-row items-center rounded-md px-1 py-1 h-7' : 'inline-block px-2 py-3';
    const isActive = this.active() || routeIsActive;

    let base = `nav-button ${layout} cursor-pointer relative group text-${this.size()}`;
    if (this.fullWidth() && !this.showLabel()) {
      base += ' nav-button--activity';
    }

    const types = {
        primary: 'text-zinc-400 hover:text-zinc-200',
        secondary: 'text-zinc-400 hover:text-zinc-200',
        white: 'text-zinc-900 hover:text-zinc-700',
        danger: 'text-zinc-400 hover:text-zinc-200',
        pink: 'text-zinc-400 hover:text-zinc-200'
    }

    const activeTypes = {
      primary: 'text-yellow-300',
      secondary: 'text-zinc-800',
      white: 'text-zinc-50',
      danger: 'text-red-600',
      pink: 'text-pink-400'
    }

    let overrideColor = this.activeColor();

    if(overrideColor){
      overrideColor = 'text-'+overrideColor;
    }

    return base + ' ' + `${isActive ? 'nav-button--active font-bold' : ''} ` + (isActive ? overrideColor ?? activeTypes[this.buttonType()] : types[this.buttonType()]);
  }

  getActiveColorCss(): string {
    const activeColors = {
      primary: 'yellow-400',
      secondary: 'zinc-300',
      white: 'zinc-50',
      danger: 'red-500',
      pink: 'pink-400',
    };

    return `var(--color-${this.activeColor() ?? activeColors[this.buttonType()]})`;
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

}
