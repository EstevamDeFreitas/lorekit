import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { SearchComponent } from './components/search/search.component';
import { BackupButtonComponent } from './components/backup-button/backup-button.component';
import { DbProvider } from './app.config';
import { FLUSH_PENDING_SAVES_EVENT, PendingSaveEventDetail } from './utils/pending-save-event';

declare const window: any;

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SearchComponent, BackupButtonComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly dbProvider = inject(DbProvider);
  private removePrepareToCloseListener?: () => void;
  private isPreparingToClose = false;

  title = 'lorekit-frontend';

  ngOnInit(): void {
    const electron = window.electronAPI;
    if (!electron?.onPrepareToClose) {
      return;
    }

    this.removePrepareToCloseListener = electron.onPrepareToClose(() => {
      void this.prepareToClose();
    });
    void electron.rendererReady?.();
  }

  ngOnDestroy(): void {
    this.removePrepareToCloseListener?.();
  }

  private async prepareToClose(): Promise<void> {
    if (this.isPreparingToClose) {
      return;
    }

    this.isPreparingToClose = true;
    try {
      const event = new CustomEvent<PendingSaveEventDetail>(FLUSH_PENDING_SAVES_EVENT, {
        detail: { flushes: [] },
      });
      window.dispatchEvent(event);

      await Promise.all(event.detail.flushes);
      await this.dbProvider.flushPendingWrites();
      window.electronAPI.finishPrepareToClose(true);
    } catch (error) {
      console.error('Falha ao salvar as altera\u00e7\u00f5es antes de fechar o aplicativo.', error);
      window.electronAPI.finishPrepareToClose(false);
    } finally {
      this.isPreparingToClose = false;
}
  }
}
