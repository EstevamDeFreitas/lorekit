import { DestroyRef, inject, Injectable } from '@angular/core';
import { EntityHistoryService } from './entity-history.service';

@Injectable({ providedIn: 'root' })
export class EntityHistoryShortcutsService {
  private readonly history = inject(EntityHistoryService);
  private started = false;

  constructor() { inject(DestroyRef).onDestroy(() => this.stop()); }

  start(): void {
    if (this.started) return;
    this.started = true;
    document.addEventListener('keydown', this.keydown, true);
    document.addEventListener('beforeinput', this.beforeInput, true);
    window.addEventListener('lorekit:history-external-change', this.external);
    window.addEventListener('lorekit:history-reset', this.reset);
  }

  private readonly reset = (): void => this.history.clear();
  private readonly external = (): void => this.history.validateExternal();
  private readonly keydown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    const direction = key === 'z' && !event.shiftKey ? 'undo' : key === 'y' || (key === 'z' && event.shiftKey) ? 'redo' : null;
    if (!direction || !this.participates(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void this.history[direction]();
  };

  private readonly beforeInput = (event: Event): void => {
    const input = event as InputEvent;
    if (input.isComposing || !this.participates(event.target)) return;
    if (this.history.busy()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (input.inputType !== 'historyUndo' && input.inputType !== 'historyRedo') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void (input.inputType === 'historyUndo' ? this.history.undo() : this.history.redo());
  };

  private participates(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const modal = target.closest('[role="dialog"], .cdk-overlay-pane');
    if (modal && !target.closest('[data-history-entity]')) return false;
    const field = target.closest('[data-history-field]');
    if (target.closest('input,textarea,[contenteditable="true"]') && !field) return false;
    const context = target.closest<HTMLElement>('[data-history-entity]');
    if (context?.dataset['historyTable'] && context.dataset['historyEntity']) {
      this.history.activate({ table: context.dataset['historyTable'], id: context.dataset['historyEntity'] });
    }
    return !!this.history.active();
  }

  private stop(): void {
    document.removeEventListener('keydown', this.keydown, true);
    document.removeEventListener('beforeinput', this.beforeInput, true);
    window.removeEventListener('lorekit:history-external-change', this.external);
    window.removeEventListener('lorekit:history-reset', this.reset);
    this.started = false;
  }
}
