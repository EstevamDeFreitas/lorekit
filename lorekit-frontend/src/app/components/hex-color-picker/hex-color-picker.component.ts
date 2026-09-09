import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MOODBOARD_ACCENT_PALETTE, MOODBOARD_FILL_PALETTE } from '../../theme/moodboard-color-palette';

@Component({
  selector: 'app-hex-color-picker',
  templateUrl: './hex-color-picker.component.html',
  styleUrl: './hex-color-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HexColorPickerComponent {
  readonly value = input<string | undefined>();
  readonly valueChange = output<string | undefined>();
  readonly label = input('Cor');
  readonly fillPalette = MOODBOARD_FILL_PALETTE;
  readonly accentPalette = MOODBOARD_ACCENT_PALETTE;

  select(color: string): void { this.valueChange.emit(color); }
  clear(): void { this.valueChange.emit(undefined); }
  customColor(event: Event): void { this.select((event.target as HTMLInputElement).value); }
}
