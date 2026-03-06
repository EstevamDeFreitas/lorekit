import { Component, computed, inject, input } from '@angular/core';
import { Params, Router } from '@angular/router';
import { IconButtonComponent } from '../icon-button/icon-button.component';

@Component({
  selector: 'app-ui-field-config-button',
  imports: [IconButtonComponent],
  template: `
    <app-icon-button
      icon="fa-solid fa-table-cells-large"
      buttonType="white"
      size="lg"
      title="Configurar layout de campos"
      (click)="goToConfig()">
    </app-icon-button>
  `,
  styleUrl: './ui-field-config-button.component.css',
})
export class UiFieldConfigButtonComponent {
  private router = inject(Router);

  entityTable = input.required<string>();
  entityId = input<string | null>(null);
  parentEntityTable = input<string | null>(null);
  parentEntityId = input<string | null>(null);
  parentLabel = input<string | null>(null);
  backRoute = input<string>('/app/culture/list');

  queryParams = computed<Params>(() => {
    const params: Params = {
      entityTable: this.entityTable(),
      backRoute: this.backRoute(),
    };

    if (this.entityId()) {
      params['entityId'] = this.entityId();
    }

    if (this.parentEntityTable() && this.parentEntityId()) {
      params['parentEntityTable'] = this.parentEntityTable();
      params['parentEntityId'] = this.parentEntityId();
    }

    if (this.parentLabel()) {
      params['parentLabel'] = this.parentLabel();
    }

    return params;
  });

  goToConfig(): void {
    this.router.navigate(['/app/ui-field-config/edit'], {
      queryParams: this.queryParams(),
    });
  }
}
