import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { StyleType } from '../../models/styles.type';

@Component({
  selector: 'app-button',
  imports: [NgClass],
  template: `<button [ngClass]="buttonClasses" [disabled]="disabled()">{{label()}}</button>`,
  styleUrl: './button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  label = input.required<string>();
  type = input<StyleType>('primary');
  disabled = input<boolean>(false);

  get buttonClasses():string {
    const base = 'px-4 py-2 rounded-lg font-medium focus:outline-none transition';

    const types = {
      primary: 'bg-amber-600 text-white ',
      secondary: 'bg-zinc-800 text-white',
      white: 'bg-zinc-50 text-zinc-900',
      danger: 'bg-red-500 text-white'
    }

    return `${base} ${types[this.type()]} ${this.disabled() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-85 active:brightness-70'}`;
  }
}
