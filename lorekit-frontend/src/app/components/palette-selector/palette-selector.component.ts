import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';

export const COLORS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone"
] as const;

export type Color = typeof COLORS[number];

@Component({
  selector: 'app-palette-selector',
  imports: [NgClass],
  template: `
    <div class="relative flex justify-center h-full items-center" (click)="$event.stopPropagation()">
      <div
        class="rounded-full w-7 !h-7 cursor-pointer border border-gray-300 transition-colors duration-200 hover:border-gray-500"
        [ngClass]="['bg-' + selectedColor() + '-500', ' h-' + size() + ' w-' + size()]"
        (click)="togglePalette()">
      </div>
      @if (showPalette) {
        <div class="absolute top-10 flex flex-row gap-2 bg-zinc-800 p-3 border border-zinc-700 rounded-xl shadow-lg z-50">
          @for (color of colors; track color) {
            <div
              class="w-7 h-7 rounded-full cursor-pointer  transition-colors duration-200 hover:border-gray-800 hover:brightness-85"
              [ngClass]="['bg-' + color + '-500']"
              (click)="selectColor(color)">
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './palette-selector.component.css',
})
export class PaletteSelectorComponent {
  selectedColor = input<Color>('zinc');
  selectedColorChange = output<Color>();
  size = input<string>('8');

  colors = COLORS;
  showPalette = false;

  selectColor(color: Color) {
    this.selectedColorChange.emit(color);
    this.showPalette = false;
  }

  togglePalette() {
    this.showPalette = !this.showPalette;
  }
}
