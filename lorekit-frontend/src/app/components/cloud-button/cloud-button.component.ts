import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CloudAccountDialogComponent } from '../cloud-account-dialog/cloud-account-dialog.component';

@Component({
  selector: 'app-cloud-button',
  imports: [],
  templateUrl: './cloud-button.component.html',
  styleUrl: './cloud-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class CloudButtonComponent {
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  protected isOpen = false;

  protected onTriggerClick(): void {
    if (!this.auth.isAuthenticated()) {
      this.openAccountDialog();
      return;
    }
    this.isOpen = !this.isOpen;
  }

  protected toggleSync(): void {
    this.auth.setSyncEnabled(!this.auth.syncEnabled());
  }

  protected async logout(): Promise<void> {
    this.isOpen = false;
    await this.auth.logout();
  }

  protected async reconnect(): Promise<void> {
    this.isOpen = false;
    await this.auth.logout();
    this.openAccountDialog();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
    }
  }

  private openAccountDialog(): void {
    this.isOpen = false;
    this.dialog.open<boolean>(CloudAccountDialogComponent, {
      autoFocus: 'dialog',
      restoreFocus: true,
      disableClose: false,
    });
  }
}
