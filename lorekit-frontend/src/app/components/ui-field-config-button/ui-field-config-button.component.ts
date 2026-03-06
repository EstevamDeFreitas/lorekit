import { Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

@Component({
  selector: 'app-ui-field-config-button',
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="'/app/ui-field-config/edit'"
      [queryParams]="queryParams()"
      class="rounded-md px-2 py-1 text-xl text-white cursor-pointer hover:brightness-85 active:brightness-70"
      title="Configurar layout de campos">
      <i class="fa-solid fa-table-cells-large"></i>
    </a>
  `,
  styleUrl: './ui-field-config-button.component.css',
})
export class UiFieldConfigButtonComponent {
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
}
