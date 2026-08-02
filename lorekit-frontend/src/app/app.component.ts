import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SearchComponent } from './components/search/search.component';
import { BackupButtonComponent } from './components/backup-button/backup-button.component';
import { CloudButtonComponent } from './components/cloud-button/cloud-button.component';
import { DbProvider } from './app.config';
import { ComponentRefreshService } from './services/component-refresh.service';
import { FLUSH_PENDING_SAVES_EVENT, PendingSaveEventDetail } from './utils/pending-save-event';

declare const window: any;

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, SearchComponent, BackupButtonComponent, CloudButtonComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly dbProvider = inject(DbProvider);
  private readonly componentRefresh = inject(ComponentRefreshService);
  private removePrepareToCloseListener?: () => void;
  private isPreparingToClose = false;

  title = 'lorekit-frontend';
  readonly isRefreshing = signal(false);

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

  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'F5') {
      return;
    }

    event.preventDefault();
    void this.refreshComponents();
  }
  async refreshComponents(): Promise<void> {
    if (this.isRefreshing()) {
      return;
    }

    this.isRefreshing.set(true);
    try {
      await this.flushPendingSaves();
      this.componentRefresh.refresh();
    } catch (error) {
      console.error('Falha ao recarregar os componentes.', error);
    } finally {
      this.isRefreshing.set(false);
    }
  }

  private async prepareToClose(): Promise<void> {
    if (this.isPreparingToClose) {
      return;
    }

    this.isPreparingToClose = true;
    try {
      await this.flushPendingSaves();
      window.electronAPI.finishPrepareToClose(true);
    } catch (error) {
      console.error('Falha ao salvar as alterações antes de fechar o aplicativo.', error);
      window.electronAPI.finishPrepareToClose(false);
    } finally {
      this.isPreparingToClose = false;
    }
  }

  private async flushPendingSaves(): Promise<void> {
    const event = new CustomEvent<PendingSaveEventDetail>(FLUSH_PENDING_SAVES_EVENT, {
      detail: { flushes: [] },
    });
    window.dispatchEvent(event);

    await Promise.all(event.detail.flushes);
    await this.dbProvider.flushPendingWrites();
  }
}
