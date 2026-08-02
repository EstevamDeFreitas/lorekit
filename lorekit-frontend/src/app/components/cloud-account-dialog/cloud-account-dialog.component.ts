import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AccountLoginFormComponent } from '../account-login-form/account-login-form.component';

@Component({
  selector: 'app-cloud-account-dialog',
  imports: [AccountLoginFormComponent],
  templateUrl: './cloud-account-dialog.component.html',
  styleUrl: './cloud-account-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudAccountDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

  protected close(result = false): void {
    this.dialogRef.close(result);
  }
}
