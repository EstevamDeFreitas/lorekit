import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { EntityLateralMenuComponent } from '../entity-lateral-menu/entity-lateral-menu.component';
import { FormField } from '../form-overlay/form-overlay.component';

@Component({
  selector: 'app-entity-lateral-menu-button',
  imports: [IconButtonComponent, EntityLateralMenuComponent],
  templateUrl: './entity-lateral-menu-button.component.html',
  styleUrl: './entity-lateral-menu-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityLateralMenuButtonComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  entityTable = input.required<string>();
  entityId = input.required<string>();
  fields = input<FormField[]>([]);
  size = input<string>('xl');
  title = input<string>('Campos e documentos');

  onSave = output<Record<string, string>>();

  protected readonly isOpen = signal(false);
  protected readonly panelWidth = signal(384);

  protected togglePanel(): void {
    this.isOpen.update(isOpen => !isOpen);

    if (!this.isOpen()) return;

    requestAnimationFrame(() => this.updatePanelWidth());
  }

  protected closePanel(): void {
    this.isOpen.set(false);
  }

  protected handleSave(formData: Record<string, string>): void {
    this.onSave.emit(formData);
  }

  private updatePanelWidth(): void {
    const hostElement = this.host.nativeElement;
    const container = hostElement.closest('.\\@container') as HTMLElement | null;
    const bounds = container?.getBoundingClientRect();
    const availableWidth = bounds ? bounds.right - hostElement.getBoundingClientRect().left : window.innerWidth;

    this.panelWidth.set(Math.max(280, Math.min(384, availableWidth - 16)));
  }
}