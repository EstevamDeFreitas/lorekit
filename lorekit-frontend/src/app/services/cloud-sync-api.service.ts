import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../enviroments/environment';

export interface SyncCapabilities {
  contractVersion: number;
  entityTypes: string[];
  pushLimit: number;
  pullLimit: number;
  blobs: { maxBytes: number };
}

export interface SyncStatus {
  vaultId: string;
  recordCount: number;
  latestCursor: string;
  contractVersion: number;
}

export interface SyncPushOperation {
  operationId: string;
  entityType: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  baseVersion: string | null;
  schemaVersion: number;
  payload?: Record<string, unknown>;
}

export interface SyncPushResult {
  operationId: string;
  entityType: string;
  entityId: string;
  status: 'applied' | 'conflict';
  version: string;
  remotePayload?: Record<string, unknown> | null;
  remoteOperation?: 'upsert' | 'delete';
}

export interface RemoteSyncChange {
  sequence: string;
  entityType: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  version: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CloudSyncApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  capabilities(): Promise<SyncCapabilities> {
    return firstValueFrom(this.http.get<SyncCapabilities>(`${this.apiUrl}/sync/capabilities`));
  }

  status(vaultId: string): Promise<SyncStatus> {
    return firstValueFrom(
      this.http.get<SyncStatus>(`${this.apiUrl}/vaults/${vaultId}/sync/status`),
    );
  }

  push(vaultId: string, operations: SyncPushOperation[]): Promise<{ results: SyncPushResult[] }> {
    return firstValueFrom(
      this.http.post<{ results: SyncPushResult[] }>(
        `${this.apiUrl}/vaults/${vaultId}/sync/push`,
        { operations },
      ),
    );
  }

  uploadBlob(
    vaultId: string,
    blobId: string,
    bytes: ArrayBuffer | Uint8Array,
    mimeType: string,
    sha256: string,
    originalName: string,
  ): Promise<unknown> {
    const body = exactArrayBuffer(bytes);
    return firstValueFrom(this.http.put(
      `${this.apiUrl}/vaults/${vaultId}/blobs/${blobId}`,
      body,
      {
        headers: {
          'Content-Type': mimeType,
          'X-Content-Sha256': sha256,
          'X-Original-Name': encodeURIComponent(originalName),
        },
      },
    ));
  }

  deleteBlob(vaultId: string, blobId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiUrl}/vaults/${vaultId}/blobs/${blobId}`));
  }
  changes(
    vaultId: string,
    after: string,
    limit = 500,
  ): Promise<{ changes: RemoteSyncChange[]; cursor: string; hasMore: boolean }> {
    const params = new HttpParams().set('after', after).set('limit', limit);
    return firstValueFrom(
      this.http.get<{ changes: RemoteSyncChange[]; cursor: string; hasMore: boolean }>(
        `${this.apiUrl}/vaults/${vaultId}/sync/changes`,
        { params },
      ),
    );
  }
}

export function exactArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;

  // Angular serializes typed arrays as JSON objects. Copy the exact view into
  // an ArrayBuffer so the HTTP body contains the same bytes used by SHA-256.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
