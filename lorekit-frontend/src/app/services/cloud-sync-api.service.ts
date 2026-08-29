import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable, timeout as rxTimeout } from 'rxjs';
import { environment } from '../../enviroments/environment';

export type SyncOperation = 'upsert' | 'delete';

export interface SyncCapabilities {
  contractVersion: number;
  entityTypes: string[];
  pushLimit: number;
  pullLimit: number;
  serverTime: string;
  blobs: { maxBytes: number };
}

export interface SyncStatus {
  vaultId: string;
  recordCount: number;
  latestCursor: string;
  contractVersion: number;
  serverTime: string;
}

export interface SyncPushOperation {
  operationId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  baseVersion: string | null;
  schemaVersion: number;
  modifiedAt: string;
  changeId: string;
  payload?: Record<string, unknown>;
}

export interface SyncPushResult {
  operationId: string;
  entityType: string;
  entityId: string;
  status: 'applied' | 'conflict' | 'superseded' | 'rejected';
  version: string;
  errorCode?: 'SYNC_CLOCK_OUT_OF_RANGE';
  serverTime?: string;
  modifiedAt?: string;
  changeId?: string;
  remotePayload?: Record<string, unknown> | null;
  remoteOperation?: SyncOperation;
  remoteModifiedAt?: string;
  remoteChangeId?: string;
}

export interface RemoteSyncChange {
  sequence: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  version: string;
  payload: Record<string, unknown> | null;
  modifiedAt: string;
  changeId: string;
  actorDeviceId?: string | null;
  createdAt: string;
}

export interface SnapshotSyncRecord {
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  version: string;
  schemaVersion: number;
  payload: Record<string, unknown> | null;
  modifiedAt: string;
  changeId: string;
}

export interface SyncResolution {
  resolutionKey: string;
  entityType: string;
  entityId: string;
  winnerOperation: SyncOperation;
  winnerPayload: Record<string, unknown> | null;
  winnerModifiedAt: string;
  winnerChangeId: string;
  loserOperation: SyncOperation;
  loserPayload: Record<string, unknown> | null;
  loserModifiedAt: string;
  loserChangeId: string;
  createdAt?: string;
  expiresAt?: string;
}

interface ClockedResponse {
  serverTime: string;
}

@Injectable({ providedIn: 'root' })
export class CloudSyncApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  capabilities(timeoutMs?: number): Promise<SyncCapabilities> {
    return this.request(
      this.http.get<SyncCapabilities>(`${this.apiUrl}/sync/capabilities`),
      timeoutMs,
    );
  }

  status(vaultId: string, timeoutMs?: number): Promise<SyncStatus> {
    return this.request(
      this.http.get<SyncStatus>(`${this.apiUrl}/vaults/${vaultId}/sync/status`),
      timeoutMs,
    );
  }

  push(
    vaultId: string,
    operations: SyncPushOperation[],
    timeoutMs?: number,
  ): Promise<{ results: SyncPushResult[] } & ClockedResponse> {
    return this.request(
      this.http.post<{ results: SyncPushResult[] } & ClockedResponse>(
        `${this.apiUrl}/vaults/${vaultId}/sync/push`,
        { protocolVersion: 2, operations },
      ),
      timeoutMs,
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

  downloadBackup(vaultId: string): Promise<Blob> {
    return firstValueFrom(this.http.get(
      `${this.apiUrl}/vaults/${vaultId}/backup`,
      { responseType: 'blob' },
    ));
  }

  restoreBackup(vaultId: string, file: Blob): Promise<{ vaultId: string }> {
    return firstValueFrom(this.http.put<{ vaultId: string }>(
      `${this.apiUrl}/vaults/${vaultId}/backup`,
      file,
      { headers: { 'Content-Type': 'application/x-lorekit-cloud-backup' } },
    ));
  }

  changes(
    vaultId: string,
    after: string,
    limit = 500,
    timeoutMs?: number,
  ): Promise<{ changes: RemoteSyncChange[]; cursor: string; hasMore: boolean } & ClockedResponse> {
    const params = new HttpParams().set('after', after).set('limit', limit);
    return this.request(
      this.http.get<{ changes: RemoteSyncChange[]; cursor: string; hasMore: boolean } & ClockedResponse>(
        `${this.apiUrl}/vaults/${vaultId}/sync/changes`,
        { params },
      ),
      timeoutMs,
    );
  }

  snapshot(
    vaultId: string,
    cursor?: string,
    limit = 500,
    timeoutMs?: number,
  ): Promise<{
    records: SnapshotSyncRecord[];
    nextCursor: string | null;
    snapshotCursor: string;
  } & ClockedResponse> {
    let params = new HttpParams().set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    return this.request(
      this.http.get<{
        records: SnapshotSyncRecord[];
        nextCursor: string | null;
        snapshotCursor: string;
      } & ClockedResponse>(
        `${this.apiUrl}/vaults/${vaultId}/sync/snapshot`,
        { params },
      ),
      timeoutMs,
    );
  }

  reportResolutions(vaultId: string, resolutions: SyncResolution[]): Promise<ClockedResponse> {
    return firstValueFrom(this.http.post<ClockedResponse>(
      `${this.apiUrl}/vaults/${vaultId}/sync/resolutions`,
      { resolutions },
    ));
  }

  resolutions(
    vaultId: string,
    before?: string,
    limit = 50,
  ): Promise<{ resolutions: SyncResolution[]; nextCursor: string | null } & ClockedResponse> {
    let params = new HttpParams().set('limit', limit);
    if (before) params = params.set('before', before);
    return firstValueFrom(this.http.get<{
      resolutions: SyncResolution[];
      nextCursor: string | null;
    } & ClockedResponse>(
      `${this.apiUrl}/vaults/${vaultId}/sync/resolutions`,
      { params },
    ));
  }

  private request<T>(observable: Observable<T>, timeoutMs?: number): Promise<T> {
    const request = timeoutMs === undefined
      ? observable
      : observable.pipe(rxTimeout({ first: Math.max(1, timeoutMs) }));
    return firstValueFrom(request);
  }
}

export function exactArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
