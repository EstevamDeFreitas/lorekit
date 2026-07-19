import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DbProvider } from '../app.config';
import { ElectronSafeAPI, openDbAndEnsureSchema, persistDbToDisk } from '../database/database.helper';

declare const window: any;

export type BackupStatus = { state: 'idle' } | { state: 'processing' } | { state: 'success'; message: string } | { state: 'error'; message: string };

type BackupImageEntry = {
  id: string;
  relativePath: string;
  dataBase64: string;
};

type LorekitFullBackup = {
  format: 'lorekit-full-backup';
  version: 1;
  exportedAt: string;
  appVersion: string;
  imageRootUsed: string;
  database: string;
  images: BackupImageEntry[];
};

@Injectable({ providedIn: 'root' })
export class BackupService {
  readonly status$ = new BehaviorSubject<BackupStatus>({ state: 'idle' });

  constructor(private dbProvider: DbProvider) {}

  // ─── Export ───────────────────────────────────────────────────────────────

  async exportBackup(): Promise<void> {
    this.status$.next({ state: 'processing' });
    try {
      await this.dbProvider.flushPendingWrites();
      const api = ElectronSafeAPI.electron;

      const [dbPath, imagesRoot] = await Promise.all([
        api.getDbPath(),
        api.getImagePath(),
      ]);

      const dbBinary = await api.readFile(dbPath);
      if (!dbBinary) {
        throw new Error('Não foi possível ler o banco de dados.');
      }

      // Collect all images from DB
      const crud = this.dbProvider.getCrudHelper();
      const imageRows: any[] = crud.findAll('Image') ?? [];

      const imageEntries: BackupImageEntry[] = [];
      const normalizedRoot = this.normalizePath(imagesRoot);

      for (const img of imageRows) {
        if (!img?.id || !img?.filePath) continue;
        const binary = await api.readFile(img.filePath);
        if (!binary) continue;

        const normalizedFilePath = this.normalizePath(img.filePath);
        const relativePath = normalizedFilePath.startsWith(normalizedRoot + '/')
          ? normalizedFilePath.slice(normalizedRoot.length + 1)
          : normalizedFilePath;

        imageEntries.push({
          id: img.id,
          relativePath,
          dataBase64: this.uint8ToBase64(binary instanceof Uint8Array ? binary : new Uint8Array(binary)),
        });
      }

      const appVersion = (await api.getAppVersion?.()) ?? 'unknown';

      const bundle: LorekitFullBackup = {
        format: 'lorekit-full-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion,
        imageRootUsed: imagesRoot,
        database: this.uint8ToBase64(dbBinary instanceof Uint8Array ? dbBinary : new Uint8Array(dbBinary)),
        images: imageEntries,
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      const defaultName = `lorekit-backup-${dateStr}.lorekit`;

      // Open native save dialog
      const chosenPath: string | null = await (window?.electronAPI?.showSaveDialog?.(defaultName) ?? null);
      if (!chosenPath) {
        this.status$.next({ state: 'idle' });
        return;
      }

      const json = JSON.stringify(bundle);
      const encoded = new TextEncoder().encode(json);
      await api.writeFile(chosenPath, encoded);

      this.status$.next({ state: 'success', message: 'Backup exportado com sucesso!' });
    } catch (err: any) {
      this.status$.next({ state: 'error', message: err?.message ?? 'Erro ao exportar backup.' });
    }
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  async importBackup(file: File): Promise<void> {
    this.status$.next({ state: 'processing' });
    try {
      await this.dbProvider.flushPendingWrites();
      const text = await file.text();
      let bundle: LorekitFullBackup;
      try {
        bundle = JSON.parse(text) as LorekitFullBackup;
      } catch {
        throw new Error('Arquivo inválido: não foi possível interpretar o JSON.');
      }

      this.validateBundle(bundle);

      const api = ElectronSafeAPI.electron;
      const [dbPath, imagesRoot] = await Promise.all([
        api.getDbPath(),
        api.getImagePath(),
      ]);

      // Restore DB binary
      const dbBinary = this.base64ToUint8(bundle.database);
      await api.writeFile(dbPath, dbBinary);

      // Restore image files
      for (const img of bundle.images) {
        if (!img?.relativePath || !img?.dataBase64) continue;
        const normalizedRelative = img.relativePath.replace(/\\/g, '/');
        const targetPath = `${imagesRoot}/${normalizedRelative}`;
        const binary = this.base64ToUint8(img.dataBase64);
        await api.writeFile(targetPath, binary);
      }

      // Fix absolute image paths in the restored DB using sql.js
      if (bundle.images.length > 0) {
        await this.fixImagePathsInDb(dbPath, imagesRoot, bundle);
      }

      this.status$.next({ state: 'success', message: 'Backup restaurado! Reiniciando...' });
      // Use IPC reload so Electron loads the root URL cleanly (no stale hash fragment)
      setTimeout(() => window?.electronAPI?.reloadApp?.(), 800);
    } catch (err: any) {
      this.status$.next({ state: 'error', message: err?.message ?? 'Erro ao restaurar backup.' });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async fixImagePathsInDb(dbPath: string, imagesRoot: string, bundle: LorekitFullBackup): Promise<void> {
    // Re-open the restored DB through the normal startup pathway (reuses already-loaded sql.js WASM)
    try {
      const db = await openDbAndEnsureSchema();

      for (const img of bundle.images) {
        if (!img?.id || !img?.relativePath) continue;
        const normalizedRelative = img.relativePath.replace(/\\/g, '/');
        const newPath = `${imagesRoot}/${normalizedRelative}`;
        db.run(`UPDATE "Image" SET "filePath" = ? WHERE "id" = ?`, [newPath, img.id]);
      }

      await persistDbToDisk(db);
      db.close();
    } catch (e) {
      console.error('Falha ao corrigir caminhos de imagem no backup restaurado:', e);
    }
  }

  private validateBundle(bundle: any): asserts bundle is LorekitFullBackup {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('Arquivo inválido.');
    }
    if (bundle.format !== 'lorekit-full-backup') {
      throw new Error('Formato não suportado. Selecione um arquivo de backup global do Lorekit.');
    }
    if (bundle.version !== 1) {
      throw new Error('Versão de backup não suportada.');
    }
    if (typeof bundle.database !== 'string' || !bundle.database) {
      throw new Error('Arquivo de backup corrompido: banco de dados ausente.');
    }
  }

  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\/$/, '');
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
