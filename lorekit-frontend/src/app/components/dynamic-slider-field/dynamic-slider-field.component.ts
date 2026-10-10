import { ChangeDetectionStrategy, Component, input, OnChanges, output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { normalizeSliderValue, parseSliderValue, SliderFieldOptions } from '../../models/dynamicfields.model';

@Component({
  selector: 'app-dynamic-slider-field',
  imports: [FormsModule],
  templateUrl: './dynamic-slider-field.component.html',
  styleUrl: './dynamic-slider-field.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicSliderFieldComponent implements OnChanges {
  readonly label = input.required<string>();
  readonly labelColor = input<string | null>(null);
  readonly config = input.required<SliderFieldOptions>();
  readonly value = input<string>('');
  readonly valueChange = output<number>();

  readonly inputId = `dynamic-slider-${crypto.randomUUID()}`;
  currentValue = 0;

  ngOnChanges(_changes: SimpleChanges): void {
    this.currentValue = parseSliderValue(this.value(), this.config());
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.currentValue = normalizeSliderValue(raw, this.config());
    this.valueChange.emit(this.currentValue);
  }

  valueDescription(): string {
    const value = `${this.currentValue}${this.config().unit ? ' ' + this.config().unit : ''}`;
    const limit = this.currentValue === this.config().min ? 'mínimo' : this.currentValue === this.config().max ? 'máximo' : '';
    return limit ? `${value} (${limit})` : value;
  }
}
