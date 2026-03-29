import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-icon-button',
  imports: [NgClass, RouterLink],
  template: `<button [ngClass]="buttonClasses" [routerLink]="this.route()" [title]="title()"><i [ngClass]="icon()"></i></button>`,
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
    const base = 'rounded-md font-medium focus:outline-none transition text-' + this.size();

    const padding = this.size() === 'xss' ? 'px-1 py-0.5' : 'px-2 py-1';

    let currentTypeStyle = "";

    switch (this.buttonType()) {
      case 'primary':
        currentTypeStyle = 'bg-yellow-300' + (this.disabled() ? ' text-zinc-600' : ' text-white ');
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
        currentTypeStyle = (this.disabled() ? ' text-zinc-600' : ' text-yellow-600');
        break;
      case 'secondaryActive':
        currentTypeStyle = (this.disabled() ? ' text-zinc-600' : ' text-zinc-600');
        break;
      case 'whiteActive':
        currentTypeStyle = (this.disabled() ? ' text-zinc-600' : ' text-white');
        break;

    }

    return `${base} ${padding} ${currentTypeStyle} ${this.disabled() ? ' cursor-not-allowed' : ' cursor-pointer hover:brightness-85 active:brightness-70'}`;
  }
}
