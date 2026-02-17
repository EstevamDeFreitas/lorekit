import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { EntityTransferService } from '../../services/entity-transfer.service';

@Component({
  selector: 'app-entity-transfer-button',
  imports: [IconButtonComponent],
  template: `<app-icon-button (click)="exportEntity()" buttonType="white" icon="fa-solid fa-file-export" [size]="size()" title="Exportar .lorekit"></app-icon-button>`,
  styleUrl: './entity-transfer-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityTransferButtonComponent {
  private readonly entityTransferService = inject(EntityTransferService);

  entityId = input<string>('');
  entityTable = input<string>('');
  size = input<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('base');

  async exportEntity() {
    const entityId = this.entityId();
    const entityTable = this.entityTable();

    if (!entityId || !entityTable) {
      return;
    }

    try {
      await this.entityTransferService.exportEntityBundle(entityTable, entityId);
    } catch (error: any) {
      alert(error?.message || 'Falha ao exportar a entidade.');
    }
  }
}
