import { ChangeDetectorRef, DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';
import { HistoryAddress, HistoryEntity, historyEntityKey } from '../models/entity-history.model';
import { EntityHistoryService } from '../services/entity-history.service';
import { parseHistoryJson, writeHistoryPath } from '../services/entity-history-store.service';

@Directive({
  selector: '[historyEntity]',
  host: {
    '(focusin)': 'activate($event)',
    '(mousedown)': 'activate($event)',
    '[attr.data-history-entity]': 'historyEntity().id || null',
    '[attr.data-history-table]': 'historyEntity().table',
  },
})
export class EntityHistoryContextDirective {
  readonly historyEntity = input.required<HistoryEntity>();
  readonly historyModel = input<unknown>(null);
  readonly historyRestored = output<{ address: HistoryAddress; value: string }>();
  private readonly history = inject(EntityHistoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly element = inject(ElementRef).nativeElement as HTMLElement;

  constructor() {
    inject(DestroyRef).onDestroy(this.history.onRestore((address, value) => {
      if (historyEntityKey(address.entity) !== historyEntityKey(this.historyEntity())) return;
      const model = this.historyModel();
      const { field } = address;
      if (model && typeof model === 'object' && !field.dynamicId && !field.target) {
        const record = model as Record<string, unknown>;
        if (field.path?.length) {
          const data = parseHistoryJson(record[field.column], field.path);
          writeHistoryPath(data, field.path, value);
          record[field.column] = JSON.stringify(data);
        } else {
          record[field.column] = value;
        }
      }
      this.historyRestored.emit({ address, value });
      this.cdr.markForCheck();
    }));
  }

  activate(event?: Event): void {
    if (event?.target instanceof HTMLElement && event.target.closest('[data-history-entity]') !== this.element) return;
    const entity = this.historyEntity();
    if (entity.id) this.history.activate(entity);
  }
}
