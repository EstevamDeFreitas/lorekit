import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';

export interface DynamicImageViewerDialogData {
  title: string;
  imageUrl: string;
}

@Component({
  selector: 'app-dynamic-image-viewer-dialog',
  imports: [IconButtonComponent],
  templateUrl: './dynamic-image-viewer-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicImageViewerDialogComponent {
  protected readonly data = inject<DynamicImageViewerDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);

  protected close(): void {
    this.dialogRef.close();
  }
}
