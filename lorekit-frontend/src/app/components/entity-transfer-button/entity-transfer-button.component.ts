import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { Dialog } from '@angular/cdk/dialog';
import { EntityTransferDialogComponent } from '../entity-transfer-dialog/entity-transfer-dialog.component';

@Component({
  selector: 'app-entity-transfer-button',
  imports: [IconButtonComponent],
  template: `<app-icon-button (click)="exportEntity()" buttonType="white" icon="fa-solid fa-file-export" [size]="size()" title="Exportar .lorekit"></app-icon-button>`,
  styleUrl: './entity-transfer-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityTransferButtonComponent {
  private readonly dialog = inject(Dialog);

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
      if (entityTable !== 'Character') throw new Error('A exportação v2 está disponível para personagens.');
      this.dialog.open(EntityTransferDialogComponent, { data: { mode: 'export', entityId }, width: '760px', maxWidth: '95vw', disableClose: true });
    } catch (error: any) {
      alert(error?.message || 'Falha ao exportar a entidade.');
    }
  }
}
