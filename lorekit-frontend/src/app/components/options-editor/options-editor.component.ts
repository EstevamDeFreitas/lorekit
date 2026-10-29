import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';

@Component({
  selector: 'app-options-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex min-w-0 flex-col gap-1">
      <span class="flex items-center justify-between gap-2 text-xs text-white">
        <span>Opções</span>
        <span class="text-zinc-400">{{ optionCount() }} {{ optionCount() === 1 ? 'opção' : 'opções' }}</span>
      </span>
      <textarea
        class="scrollbar-dark"
        rows="7"
        [value]="optionsText()"
        (input)="updateOptions($event)"
        placeholder="Primeira opção&#10;Segunda opção&#10;Terceira opção"
      ></textarea>
      <span class="text-xs text-zinc-400">Digite ou cole uma opção por linha. Arraste a borda inferior para ampliar.</span>
    </label>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 7rem;
      resize: vertical;
      border: 1px solid var(--color-zinc-700);
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--color-zinc-940);
      color: var(--color-zinc-100);
      font: inherit;
      font-size: 0.875rem;
      line-height: 1.75;
      caret-color: var(--color-yellow-400);
    }
    textarea::placeholder { color: var(--color-zinc-400); }
    textarea:focus-visible { outline: 2px solid var(--color-yellow-400); outline-offset: 2px; }
  `,
})
export class OptionsEditorComponent {
  readonly value = model<string | undefined>('');
  readonly optionsText = computed(() => (this.value() ?? '').split(';').join('\n'));
  readonly optionCount = computed(() => (this.value() ?? '').split(';').filter(option => option.trim()).length);

  updateOptions(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    // Keep empty lines while typing so Enter can start a new option.
    this.value.set(text.replace(/\r\n?/g, '\n').replace(/\n/g, ';'));
  }
}
