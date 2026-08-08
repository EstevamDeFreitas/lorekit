import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WorkspaceRuntimeService } from '../../services/workspace-runtime.service';
import { isElectronRuntime } from '../../utils/runtime-platform';
import { AuthService } from '../../services/auth.service';
import { LocalSyncConflict, LocalSyncResolution, SyncEngineService } from '../../services/sync-engine.service';
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
  protected readonly syncEngine = inject(SyncEngineService);
  private readonly dialog = inject(Dialog);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  protected readonly workspace = inject(WorkspaceRuntimeService);
  private readonly router = inject(Router);
  protected isOpen = false;

  protected onTriggerClick(): void {
    if (!this.auth.isAuthenticated()) {
      this.openAccountDialog();
      return;
    }
    this.isOpen = !this.isOpen;
  }

  protected async toggleSync(): Promise<void> {
    this.auth.setSyncEnabled(!this.auth.syncEnabled());
    if (this.auth.syncEnabled()) {
      await this.workspace.connectAuthenticatedAccount();
    } else {
      this.syncEngine.stop();
    }
  }

  protected async syncNow(): Promise<void> {
    await this.syncEngine.syncNow();
  }

  protected async downloadCloudCopy(): Promise<void> {
    if (this.workspace.recovering()) return;
    const confirmed = window.confirm([
      'Baixar a vers\u00e3o da nuvem e substituir o banco local corrompido?',
      '',
      'Uma c\u00f3pia .bak do arquivo atual ser\u00e1 criada antes da substitui\u00e7\u00e3o.',
    ].join('\n'));
    if (!confirmed) return;

    try {
      await this.workspace.recoverDesktopFromCloud();
      this.isOpen = false;
    } catch (error) {
      console.error('Falha ao baixar a vers\u00e3o da nuvem.', error);
    }
  }

  protected async logout(): Promise<void> {
    this.isOpen = false;
    if (!isElectronRuntime()) {
      await this.workspace.closeWebWorkspace(true);
    }
    await this.auth.logout();
    if (!isElectronRuntime()) {
      await this.router.navigate(['/login']);
    }
  }

  protected async reconnect(): Promise<void> {
    this.isOpen = false;
    if (!isElectronRuntime()) {
      await this.workspace.closeWebWorkspace(true);
    }
    await this.auth.logout();
    this.openAccountDialog();
  }

  protected conflicts(): LocalSyncConflict[] {
    return this.syncEngine.conflicts();
  }

  protected resolutions(): LocalSyncResolution[] {
    return this.syncEngine.resolutions();
  }

  protected formatModifiedAt(value: string): string {
    const timestamp = Number(value);
    return Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleString()
      : value;
  }

  protected formatPayload(payload: Record<string, unknown> | null): string {
    return payload === null ? '(excluído)' : JSON.stringify(payload, null, 2);
  }

  protected async keepMine(conflict: LocalSyncConflict): Promise<void> {
    await this.syncEngine.keepMine(conflict);
  }

  protected async useCloud(conflict: LocalSyncConflict): Promise<void> {
    await this.syncEngine.useCloud(conflict);
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
