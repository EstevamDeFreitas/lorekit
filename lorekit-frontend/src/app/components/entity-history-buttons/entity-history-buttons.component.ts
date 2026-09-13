import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EntityHistoryService } from '../../services/entity-history.service';
import { EntityHistoryShortcutsService } from '../../services/entity-history-shortcuts.service';

@Component({
  selector: 'app-entity-history-buttons',
  templateUrl: './entity-history-buttons.component.html',
  styleUrl: './entity-history-buttons.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-history-buttons': 'true' },
})
export class EntityHistoryButtonsComponent {
  readonly history = inject(EntityHistoryService);
  constructor() { inject(EntityHistoryShortcutsService).start(); }
  undoLabel(): string { return this.label('Desfazer', this.history.undoStep()?.field.label, 'Ctrl+Z'); }
  redoLabel(): string { return this.label('Refazer', this.history.redoStep()?.field.label, 'Ctrl+Y'); }
  private label(action: string, field: string | undefined, shortcut: string): string {
    return `${action}${field ? ' edição de ' + field : ''} (${shortcut})`;
  }
}
