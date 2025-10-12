import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PersonalizationComponent } from '../personalization/personalization.component';
import { IconButtonComponent } from "../icon-button/icon-button.component";


@Component({
  selector: 'app-personalization-button',
  imports: [IconButtonComponent],
  template: `<app-icon-button (click)="openPersonalizationDialog()" buttonType="white" icon="fa-solid fa-palette" [size]="size()" title="Personalizar"></app-icon-button>`,
  styleUrl: './personalization-button.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class PersonalizationButtonComponent {
  personalizationDialog = inject(Dialog);

  entityId = input<string>('');
  entityTable = input<string>('');

  size = input<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('base');

  openPersonalizationDialog() {
    this.personalizationDialog.open(PersonalizationComponent, {
      data: { entityTable: this.entityTable(), entityId: this.entityId() }
    });
  }
}
