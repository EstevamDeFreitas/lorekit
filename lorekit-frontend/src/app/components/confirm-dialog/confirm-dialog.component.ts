import { Injectable } from '@angular/core';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  constructor(private dialog: Dialog) {}
  ask(message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, { data: message });
    return ref.closed.toPromise().then(r => !!r);
  }
}

@Component({
  imports: [ButtonComponent],
  template: `
    <div class="screen-dialog">
      <p>{{data}}</p>
      <br>
      <div class="flex gap-2">
        <app-button label="Confirmar" buttonType="danger" (click)="close(true)"></app-button>
        <app-button label="Cancelar" buttonType="secondary" (click)="close(false)"></app-button>
      </div>
    </div>
  `
})
class ConfirmDialogComponent {
  ref = inject<DialogRef<boolean>>(DialogRef<boolean>);
  readonly data = inject<string>(DIALOG_DATA);
  close(result: boolean) { this.ref.close(result); }
}
