import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-text-area',
  imports: [FormsModule, NgClass],
  template: `
  <div class="flex flex-col">
    <label class="block text-sm font-medium mb-1">{{ label() }}</label>
    <textarea [placeholder]="placeholder()" [ngClass]="height()" class="w-full bg-zinc-925 border-zinc-800 border focus:outline-none focus:border-zinc-100 focus:border-1 rounded-md p-2 text-sm " [(ngModel)]="value"></textarea>
  </div>
  `,
  styleUrl: './text-area.component.css',
})
export class TextAreaComponent {
  label = input.required<string>();
  placeholder = input<string>('');
  value = model<any>('');
  height = model<string>('h-18');
}
