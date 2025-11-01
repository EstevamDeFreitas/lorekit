import { Component, input, model, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-input',
  imports: [FormsModule, CommonModule],
  template: `
    <div class="flex flex-col">
      @if (label() != '') {
        <label class="mb-1 text-sm text-white" [ngClass]="{'!text-red-500':errorMessage() != ''}">{{ label() }}</label>
      }
      <input
        [type]="type()"
        [(ngModel)]="value"
        (blur)="markAsTouched()"
        [placeholder]="placeholder()"
        [ngClass]="{'!ring-red-500':errorMessage() != ''}"
        class="rounded-lg px-3 py-2 ring-1 bg-zinc-925 ring-zinc-800 transition focus:outline-none focus:ring-zinc-100 focus:ring-1 placeholder:text-white/10"
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
  label = input<string>('');
  placeholder = input<string>('');
  type = input<string>('text');
  value = model<any>('');
  required = input<boolean>(false);

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
