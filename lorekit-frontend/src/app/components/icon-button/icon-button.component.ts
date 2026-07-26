import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-icon-button',
  imports: [NgClass, RouterLink],
  template: `<button [ngClass]="buttonClasses" [routerLink]="this.route()" [title]="title()" [disabled]="disabled()">
  <i [ngClass]="icon()"></i>
  </button>`,
  styleUrl: './icon-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButtonComponent {
  buttonType = input<string>('primary');
  size = input<string>('base');
  icon = input<string>('fa-solid fa-plus');
  title = input<string>('Adicionar');
  disabled = input<boolean>(false);
  route = input<string>();

  get buttonClasses(): string {
    const base = 'rounded-md relative font-medium focus:outline-none transition text-' + this.size();

    const size = this.getSize(this.size());

    let currentTypeStyle = "";

    switch (this.buttonType()) {
      case 'primary':
        currentTypeStyle = 'bg-yellow-400' + (this.disabled() ? ' text-zinc-600' : ' text-zinc-900 ');
        break;
      case 'secondary':
        currentTypeStyle = 'bg-zinc-800' + (this.disabled() ? ' text-zinc-600' : ' text-white ');
        break;
      case 'white':
        currentTypeStyle = 'bg-zinc-50' + (this.disabled() ? ' text-zinc-600' : ' text-zinc-900 ');
        break;
      case 'danger':
        currentTypeStyle = 'bg-red-500' + (this.disabled() ? ' text-zinc-600' : ' text-white ');
        break;
      case 'primaryActive':
        currentTypeStyle = 'hover:bg-yellow-800 hover:text-zinc-900 ' +  (this.disabled() ? ' text-zinc-600' : ' text-yellow-600');
        break;
      case 'secondaryActive':
        currentTypeStyle = 'hover:bg-zinc-800 hover:text-zinc-50 ' +  (this.disabled() ? ' text-zinc-600' : ' text-zinc-600');
        break;
      case 'whiteActive':
        currentTypeStyle = (this.disabled() ? ' text-zinc-600' : ' text-white');
        break;

    }

    return `${base} ${size} ${currentTypeStyle} ${this.disabled() ? ' cursor-not-allowed' : ' cursor-pointer hover:brightness-85 active:brightness-70'}`;
  }

  getSize(key:string) : string{
    switch(key){
      case 'xs':
        return 'h-6 w-6';
      case 'sm':
        return 'h-6.5 w-6.5';
      case 'base':
        return 'h-7 w-7';
      case 'lg':
        return 'h-7.5 w-7.5';
      case 'xl':
        return 'h-8 w-8';
      case '2xl':
        return 'h-9 w-9';
      default:
        return 'h-6 w-6';
    }
  }
}
