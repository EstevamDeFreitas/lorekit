import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, input } from '@angular/core';
import { SafeDeleteComponent } from '../safe-delete/safe-delete.component';
import { IconButtonComponent } from "../icon-button/icon-button.component";

@Component({
  selector: 'app-safe-delete-button',
  imports: [IconButtonComponent],
  template: `<app-icon-button (click)="openSafeDeleteDialog()" buttonType="danger" icon="fa-solid fa-trash" [size]="size()" title="Excluir"></app-icon-button>`,
  styleUrl: './safe-delete-button.component.css',
})
export class SafeDeleteButtonComponent {
  safeDeleteDialog = inject(Dialog);

  size = input<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('base');
  entityName = input.required<string>();
  entityTable = input.required<string>();
  entityId = input.required<string>();

  openSafeDeleteDialog() {
    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: this.entityName(),
        entityTable: this.entityTable(),
        entityId: this.entityId()
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }
}
