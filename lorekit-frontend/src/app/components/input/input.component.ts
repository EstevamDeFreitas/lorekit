import { Component, input, model, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HistoryFieldDirective } from '../../directives/history-field.directive';
import { HistoryField } from '../../models/entity-history.model';

@Component({
  selector: 'app-input',
  imports: [FormsModule, CommonModule, HistoryFieldDirective],
  template: `
    <div class="flex flex-col ">
      @if (label() != '') {
        <label class="mb-1 text-xs text-white" [style.color]="labelColor() || null" [ngClass]="{'!text-red-500':errorMessage() != ''}">{{ label() }}</label>
      }
      <input
        [historyField]="historyField()"
        [historyRead]="historyRead()"
        [type]="type()"
        [(ngModel)]="value"
        (blur)="markAsTouched()"
        [placeholder]="placeholder()"
        [ngClass]="{'!ring-red-500':errorMessage() != ''}"
        class="rounded-lg px-3 py-2 ring-1 bg-zinc-940 text-{{size()}} ring-zinc-900 transition focus:outline-none focus:ring-zinc-100 focus:ring-1 placeholder:text-white/10"
      />
      @if (errorMessage() != '') {
        <span class="text-red-500 text-xs mt-1">
          {{ errorMessage() }}
        </span>
      }

    </div>
  `,
  styleUrl: './input.component.css'
})
export class InputComponent {
  historyField = input<string | HistoryField | null>(null);
  historyRead = input<(() => string) | null>(null);
  label = input<string>('');
  labelColor = input<string | null>(null);
  placeholder = input<string>('');
  type = input<string>('text');
  value = model<any>('');
  required = input<boolean>(false);
  size = input<string>('sm')

  touched = signal(false);



  markAsTouched() {
    this.touched.set(true);

    console.log("touched");

  }

  errorMessage = computed(() => {
    if (!this.touched()) return '';

    if (this.required() && !this.value()) {
      return 'Campo obrigatório.';
    }

    if (this.type() == 'email' && this.value() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value())) {
      return 'E-mail inválido.';
    }

    return '';
  });

  public forceValidation() {
    this.touched.set(true);
  }


}
