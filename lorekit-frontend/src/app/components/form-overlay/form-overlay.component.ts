import { Directive, input, output, ViewContainerRef, inject, OnInit, OnDestroy, signal, ElementRef } from '@angular/core';
import { Overlay, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { InputComponent } from '../input/input.component';
import { ButtonComponent } from '../button/button.component';
import { ComboBoxComponent } from "../combo-box/combo-box.component";

export interface FormField {
  key: string;
  label: string;
  value: string;
  options?: any[];
  optionCompareProp?: string;
  optionDisplayProp?: string;
  clearable?: boolean;
  type?: 'text' | 'email' | 'password' | 'number' | 'text-area';
}

@Component({
  selector: 'app-form-overlay',
  imports: [InputComponent, ButtonComponent, ComboBoxComponent],
  template: `
    <div class="bg-zinc-800 p-2 rounded-md min-w-64 shadow-lg border border-zinc-700">
      <div class="mb-3 font-semibold text-white">{{ title() }}</div>
      <div class="flex flex-col gap-3">
        @for (field of fields(); track field.key) {
          @if (field.options && field.options.length > 0) {
            <app-combo-box
              [label]="field.label"
              [items]="field.options"
              [(comboValue)]="field.value"
              [clearable]="field.clearable || false"
              [compareProp]="field.optionCompareProp || ''"
              [displayProp]="field.optionDisplayProp || ''"
              >
            </app-combo-box>
          }
          @else {
            <app-input
              [label]="field.label"
              [type]="field.type || 'text'"
              [(value)]="field.value"
              >
            </app-input>
          }
        }
        <div class="flex gap-2">
          <app-button
            [label]="saveLabel()"
            buttonType="primary"
            (click)="handleSave()">
          </app-button>
          <app-button
            label="Cancelar"
            buttonType="secondary"
            (click)="handleCancel()">
          </app-button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './form-overlay.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormOverlayComponent {
  title = input.required<string>();
  saveLabel = input<string>('Salvar');
  fields = input.required<FormField[]>();

  onSave = output<Record<string, string>>();
  onCancel = output<void>();

  handleSave() {
    const formData: Record<string, string> = {};
    this.fields().forEach(field => {
      formData[field.key] = field.value ? field.value.trim() : '';
    });

    // TODO: Tratar validação dos campos obrigatórios
    // const hasEmptyFields = this.fields().some(field => field.value.trim() === '');
    // if (hasEmptyFields) {
    //   return;
    // }

    this.onSave.emit(formData);
  }

  handleCancel() {
    this.onCancel.emit();
  }
}

@Directive({
  selector: '[appFormOverlay]'
})
export class FormOverlayDirective implements OnInit, OnDestroy {
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private elementRef = inject(ElementRef);

  title = input.required<string>();
  saveLabel = input<string>('Salvar');
  fields = input.required<FormField[]>();
  positions = input<ConnectedPosition[]>([
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'top',
      offsetY: 8
    },
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 8
    }
  ]);

  // Outputs
  onSave = output<Record<string, string>>();
  onToggle = output<boolean>();

  private overlayRef: OverlayRef | null = null;
  private isOpen = signal(false);

  ngOnInit() {
    this.elementRef.nativeElement.addEventListener('click', this.toggle.bind(this));
  }

  ngOnDestroy() {
    this.close();
    if (this.elementRef?.nativeElement) {
      this.elementRef.nativeElement.removeEventListener('click', this.toggle.bind(this));
    }
  }

  private toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  private open() {
    if (this.overlayRef) {
      return;
    }

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(this.positions())
      .withPush(false);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });

    const componentPortal = new ComponentPortal(FormOverlayComponent);
    const componentRef = this.overlayRef.attach(componentPortal);

    componentRef.setInput('title', this.title());
    componentRef.setInput('saveLabel', this.saveLabel());
    componentRef.setInput('fields', [...this.fields()]);

    componentRef.instance.onSave.subscribe((data) => {
      this.onSave.emit(data);
      this.resetFields();
      this.close();
    });

    componentRef.instance.onCancel.subscribe(() => {
      this.close();
    });

    this.overlayRef.backdropClick().subscribe(() => {
      this.close();
    });

    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });

    this.isOpen.set(true);
    this.onToggle.emit(true);
  }

  private close() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
      this.isOpen.set(false);
      this.onToggle.emit(false);
    }
  }

  private resetFields() {
    const currentFields = this.fields();
    currentFields.forEach(field => {
      field.value = '';
    });
  }
}
