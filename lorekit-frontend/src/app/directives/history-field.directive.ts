import { AfterViewInit, DestroyRef, Directive, DoCheck, ElementRef, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { HistoryAddress, HistoryEditKind, HistoryField } from '../models/entity-history.model';
import { EntityHistoryService } from '../services/entity-history.service';
import { EntityHistoryContextDirective } from './entity-history-context.directive';

@Directive({
  selector: 'input[historyField], textarea[historyField], [contenteditable][historyField]',
  host: {
    '[attr.data-history-field]': 'address() ? "true" : null',
    '(focusin)': 'start()',
    '(beforeinput)': 'beforeInput($event)',
    '(input)': 'changed()',
    '(blur)': 'blur()',
    '(compositionstart)': 'compositionStart()',
    '(compositionend)': 'compositionEnd()',
  },
})
export class HistoryFieldDirective implements AfterViewInit, DoCheck {
  readonly historyField = input<string | HistoryField | null>(null);
  readonly historyRead = input<(() => string) | null>(null);
  private readonly context = inject(EntityHistoryContextDirective, { optional: true });
  private readonly history = inject(EntityHistoryService);
  private readonly element = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement | HTMLElement>>(ElementRef).nativeElement;
  private readonly control = inject(NgControl, { optional: true, self: true });
  private unregister?: () => void;
  private registeredKey = '';
  private previous = '';
  private composing = false;
  private kind: HistoryEditKind = 'typing';

  constructor() { inject(DestroyRef).onDestroy(() => { this.unregister?.(); }); }
  ngAfterViewInit(): void { this.bind(); }
  ngDoCheck(): void { this.bind(); }

  address(): HistoryAddress | null {
    const entity = this.context?.historyEntity();
    const field = this.historyField();
    return entity?.id && field ? { entity, field: typeof field === 'string' ? { column: field, label: field } : field } : null;
  }

  start(): void { this.context?.activate(); this.bind(); this.previous = this.value(); }
  beforeInput(event: InputEvent): void {
    this.bind();
    this.kind = event.inputType === 'insertFromPaste' ? 'paste' : event.inputType.startsWith('format') ? 'format' : 'typing';
  }
  compositionStart(): void { this.composing = true; this.history.boundary(); }
  compositionEnd(): void { this.composing = false; this.kind = 'composition'; this.changed(); }
  blur(): void { if (!this.composing) this.changed(); this.history.boundary(); }

  changed(): void {
    if (this.composing || this.history.applying()) return;
    const address = this.address();
    if (!address) return;
    const read = this.historyRead();
    const value = read ? Promise.resolve().then(read) : this.value();
    void this.history.capture(address, this.previous, value, this.kind);
    if (typeof value === 'string') this.previous = value;
    this.kind = 'typing';
  }

  private bind(): void {
    const address = this.address();
    if (!address) {
      this.unregister?.();
      this.unregister = undefined;
      this.registeredKey = '';
      return;
    }
    const key = JSON.stringify(address);
    if (key === this.registeredKey) return;
    this.unregister?.();
    this.registeredKey = key;
    this.previous = this.value();
    this.history.observe(address, this.previous);
    this.unregister = this.history.register({ address, apply: value => {
      this.previous = value;
      if (this.historyRead()) return;
      if (this.element instanceof HTMLInputElement || this.element instanceof HTMLTextAreaElement) this.element.value = value;
      else this.element.innerText = value;
      this.control?.control?.setValue(value, { emitViewToModelChange: false });
      this.control?.viewToModelUpdate(value);
    } });
  }

  private value(): string {
    const read = this.historyRead();
    if (read) return read();
    return this.element instanceof HTMLInputElement || this.element instanceof HTMLTextAreaElement
      ? this.element.value : this.element.innerText.replace(/\u00a0/g, ' ').replace(/\n$/g, '');
  }
}
