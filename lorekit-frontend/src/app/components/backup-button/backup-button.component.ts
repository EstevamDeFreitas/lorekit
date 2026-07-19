import { inject, DestroyRef, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { BackupService, BackupStatus } from '../../services/backup.service';

@Component({
  selector: 'app-backup-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <!-- Trigger button -->
      <button
        type="button"
        (click)="toggleMenu()"
        title="Backup"
        class="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-925 border border-zinc-700 text-white hover:border-white transition-colors"
        [class.border-white]="isOpen"
      >
        <i class="fa-solid fa-database text-xs"></i>
      </button>

      <!-- Dropdown -->
      @if (isOpen) {
        <div
          class="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg z-50 overflow-hidden"
        >
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="isProcessing"
            (click)="onExport()"
          >
            <i class="fa-solid fa-cloud-arrow-down w-4 text-center"></i>
            Exportar Backup
          </button>
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="isProcessing"
            (click)="fileInput.click()"
          >
            <i class="fa-solid fa-cloud-arrow-up w-4 text-center"></i>
            Restaurar Backup
          </button>

          @if (isProcessing) {
            <div class="px-3 py-2 text-xs text-zinc-400 flex items-center gap-2 border-t border-zinc-800">
              <i class="fa-solid fa-circle-notch fa-spin"></i>
              Processando...
            </div>
          }

          @if (status.state === 'success') {
            <div class="px-3 py-2 text-xs text-emerald-400 flex items-center gap-2 border-t border-zinc-800">
              <i class="fa-solid fa-circle-check"></i>
              {{ status.message }}
            </div>
          }

          @if (status.state === 'error') {
            <div class="px-3 py-2 text-xs text-red-400 flex items-center gap-2 border-t border-zinc-800">
              <i class="fa-solid fa-circle-exclamation"></i>
              {{ status.message }}
            </div>
          }
        </div>
      }

      <!-- Hidden file input for restore -->
      <input
        #fileInput
        type="file"
        accept=".lorekit,application/json"
        class="hidden"
        (change)="onImportFileSelected($event)"
      />
    </div>
  `,
  styles: [':host { display: block; }'],
})
export class BackupButtonComponent {
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isOpen = false;
  status: BackupStatus = { state: 'idle' };

  get isProcessing(): boolean {
    return this.status.state === 'processing';
  }

  constructor(private backupService: BackupService, private elRef: ElementRef) {
    this.backupService.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((s) => {
      this.status = s;
      if (s.state === 'success' || s.state === 'error') {
        // auto-close dropdown after a short delay on error; success auto-reloads
        if (s.state === 'error') {
          setTimeout(() => {
            this.backupService.status$.next({ state: 'idle' });
          }, 4000);
        }
      }
    });
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.backupService.status$.next({ state: 'idle' });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  async onExport(): Promise<void> {
    await this.backupService.exportBackup();
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.backupService.importBackup(file);
    input.value = '';
  }
}
