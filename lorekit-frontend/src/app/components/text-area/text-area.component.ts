import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-text-area',
  imports: [FormsModule, NgClass],
  template: `
  <div class="flex flex-col">
    <label class="block text-xs font-medium mb-1" [style.color]="labelColor() || null">{{ label() }}</label>
    <textarea [placeholder]="placeholder()" [ngClass]="height()" class="w-full rounded-lg bg-zinc-940 px-3 py-2 text-sm ring-1 ring-zinc-900 transition focus:outline-none focus:ring-1 focus:ring-zinc-100" [(ngModel)]="value"></textarea>
  </div>
  `,
  styleUrl: './text-area.component.css',
})
export class TextAreaComponent {
  label = input.required<string>();
  labelColor = input<string | null>(null);
  placeholder = input<string>('');
  value = model<any>('');
  height = model<string>('h-18');
}
