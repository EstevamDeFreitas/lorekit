import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import type {
  Story,
  StoryAsset,
  StoryDetail,
  StoryEvent,
  StoryHistoryWindow,
  StoryMessage,
  StoryMessageInput,
  StoryPage,
  StoryRollInput,
  StoryScene,
  StorySpeaker,
  StorySpeakerInput,
  StorySummary,
} from '@lorekit/ironpaw';
import { environment } from '../../enviroments/environment';

@Injectable({ providedIn: 'root' })
export class StoryApiService {
  private readonly http = inject(HttpClient);
  readonly base = environment.apiUrl;
  get<T>(path: string, params?: HttpParams): Promise<T> {
    return firstValueFrom(
      this.http
        .get<T>(`${this.base}/${path}`, { params })
        .pipe(timeout(15_000)),
    );
  }
  post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${this.base}/${path}`, body).pipe(timeout(20_000)),
    );
  }
  list() {
    return this.get<StorySummary[]>('stories');
  }
  capabilities() {
    return this.get<{
      version: number;
      enabled: boolean;
      push: boolean;
      vapidPublicKey: string | null;
    }>('stories/capabilities');
  }
  detail(id: string) {
    return this.get<StoryDetail>(`stories/${id}`);
  }
  create(title: string, operationId: string) {
    return this.post<Story>('stories', { version: 1, operationId, title });
  }
  messages(id: string, after = '0', through?: string) {
    let params = new HttpParams().set('after', after);
    if (through) params = params.set('through', through);
    return this.get<StoryPage<StoryMessage>>(`stories/${id}/messages`, params);
  }
  events(id: string, after = '0') {
    return this.get<StoryPage<StoryEvent>>(
      `stories/${id}/events`,
      new HttpParams().set('after', after),
    );
  }
  window(id: string, before?: string, through?: string, sceneId?: string) {
    let params = new HttpParams();
    if (before) params = params.set('before', before);
    if (through) params = params.set('through', through);
    if (sceneId) params = params.set('sceneId', sceneId);
    return this.get<StoryHistoryWindow>(`stories/${id}/window`, params);
  }
  scene(id: string, title: string, operationId: string) {
    return this.post<StoryScene>(`stories/${id}/scenes`, {
      version: 1,
      operationId,
      title,
    });
  }
  renameScene(id: string, sceneId: string, title: string, operationId: string) {
    return firstValueFrom(
      this.http
        .patch<StoryScene>(`${this.base}/stories/${id}/scenes/${sceneId}`, {
          version: 1,
          operationId,
          title,
        })
        .pipe(timeout(15_000)),
    );
  }
  speaker(id: string, input: StorySpeakerInput, speakerId?: string) {
    return speakerId
      ? firstValueFrom(
          this.http
            .patch<StorySpeaker>(
              `${this.base}/stories/${id}/speakers/${speakerId}`,
              input,
            )
            .pipe(timeout(15_000)),
        )
      : this.post<StorySpeaker>(`stories/${id}/speakers`, input);
  }
  send(id: string, input: StoryMessageInput) {
    return this.post<StoryMessage>(`stories/${id}/messages`, input);
  }
  roll(id: string, input: StoryRollInput) {
    return this.post<StoryMessage>(`stories/${id}/rolls`, input);
  }
  operation(id: string, operationId: string) {
    return this.get<{ result: StoryMessage }>(
      `stories/${id}/operations/${operationId}`,
    );
  }
  asset(id: string, assetId: string) {
    return firstValueFrom(
      this.http
        .get(`${this.base}/stories/${id}/assets/${assetId}`, {
          responseType: 'blob',
        })
        .pipe(timeout(20_000)),
    );
  }
  reserve(
    id: string,
    asset: {
      id: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
    },
  ) {
    return this.post<StoryAsset>(`stories/${id}/assets`, {
      version: 1,
      ...asset,
    });
  }
  upload(id: string, assetId: string, bytes: ArrayBuffer, mimeType: string) {
    return firstValueFrom(
      this.http
        .put<StoryAsset>(
          `${this.base}/stories/${id}/assets/${assetId}`,
          bytes,
          { headers: { 'Content-Type': mimeType } },
        )
        .pipe(timeout(30_000)),
    );
  }
  export(id: string) {
    return firstValueFrom(
      this.http
        .get(`${this.base}/stories/${id}/export.md`, { responseType: 'blob' })
        .pipe(timeout(120_000)),
    );
  }
  read(id: string, sequences: string[]) {
    return this.post<{ readCursor: string; seen: Array<[string, string]> }>(
      `stories/${id}/read-position`,
      { sequences },
    );
  }
  preferences(id: string, sound: boolean, external: boolean) {
    return firstValueFrom(
      this.http
        .put(`${this.base}/stories/${id}/notification-preferences`, {
          sound,
          external,
        })
        .pipe(timeout(15_000)),
    );
  }
  remove(path: string) {
    return firstValueFrom(
      this.http.delete(`${this.base}/${path}`).pipe(timeout(15_000)),
    );
  }
}
