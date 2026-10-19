import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { io, type Socket } from 'socket.io-client';
import {
  messageMarkdown,
  escapeMarkdown,
  type StoryDetail,
  type StoryEvent,
  type StoryHistoryWindow,
  type StoryMessage,
  type StoryMessageInput,
  type StoryRollInput,
  type StorySummary,
} from '@lorekit/ironpaw';
import { AuthService } from './auth.service';
import { StoryApiService } from './story-api.service';
import { StoryCacheService } from './story-cache.service';

@Injectable({ providedIn: 'root' })
export class StoryClientService {
  readonly api = inject(StoryApiService);
  readonly cache = inject(StoryCacheService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly summaries = signal<StorySummary[]>([]);
  readonly current = signal<StoryDetail | null>(null);
  readonly messages = signal<StoryMessage[]>([]);
  readonly status = signal<'connecting' | 'online' | 'degraded' | 'offline'>(
    'offline',
  );
  readonly error = signal('');
  readonly hasOlder = signal(false);
  readonly viewingLatest = signal(true);
  readonly scope = signal<string | null>(null);
  readonly loading = signal(false);
  readonly uncertain = signal<string[]>([]);
  readonly canWrite = computed(
    () =>
      Boolean(this.auth.user()) &&
      (this.status() === 'online' || this.status() === 'degraded'),
  );
  readonly installationId = this.installation();
  private socket: Socket | null = null;
  private account: string | null = null;
  private initialization: Promise<void> | null = null;
  private connecting: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private eventTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private readonly urls = new Map<string, string>();
  private readonly imageReaders = new Map<string, number>();
  private readonly imageLoads = new Map<string, Promise<string | null>>();
  onAlert:
    | ((value: {
        eventId: string;
        storyId: string;
        accountId: string;
        sequence: string;
      }) => void)
    | null = null;
  onMessage: ((event: StoryEvent) => void) | null = null;
  onSound:
    | ((value: {
        eventId: string;
        storyId: string;
        accountId: string;
        createdAt: string;
      }) => void)
    | null = null;
  private requestedId: string | null = null;
  private readonly storyEpoch = new Map<string, number>();
  private readonly revokedStories = new Set<string>();
  readonly drafts = new Map<
    string,
    { text: string; sceneId: string; speakerId: string }
  >();

  constructor() {
    const removeCleanup = this.auth.onSessionCleanup(async (previous, next) => {
      if (next && this.account === next) return;
      this.stop();
      this.account = null;
      this.initialization = null;
      this.revokeUrls();
      this.drafts.clear();
      this.revokedStories.clear();
      this.requestedId = null;
      this.current.set(null);
      this.messages.set([]);
      this.summaries.set([]);
      this.status.set('offline');
      await this.cache.transition(previous, next);
    });
    effect(() => {
      const userId = this.auth.user()?.id ?? this.cache.knownAccount();
      if (!userId) return;
      void this.initialize(userId)
        .then(() => {
          if (!this.destroy.destroyed && this.auth.user()?.id === userId)
            void this.connect();
        })
        .catch((error) => this.fail(error));
    });
    const online = () => {
      void this.connect();
    };
    const offline = () => {
      this.status.set('offline');
      this.socket?.disconnect();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    this.destroy.onDestroy(() => {
      this.account = null;
      this.stop();
      this.revokeUrls();
      removeCleanup();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    });
  }

  async initialize(
    userId = this.auth.user()?.id ?? this.cache.knownAccount(),
  ): Promise<void> {
    if (!userId) return;
    if (this.account === userId) {
      if (this.initialization) await this.initialization;
      return;
    }
    this.account = userId;
    this.initialization = this.cache.open(userId).then(() => {
      if (this.account === userId) this.summaries.set(this.cache.summaries());
    });
    try {
      await this.initialization;
    } finally {
      this.initialization = null;
    }
  }

  async connect(): Promise<void> {
    if (this.destroy.destroyed) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.connectNow().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }
  private async connectNow(): Promise<void> {
    if (!navigator.onLine) {
      this.status.set('offline');
      return;
    }
    this.status.set('connecting');
    let httpReady = false;
    try {
      if (!this.auth.user()) await this.auth.refreshAccessToken();
      const userId = this.auth.user()?.id;
      if (!userId) throw new Error('Conecte sua conta para enviar mensagens.');
      await this.initialize(userId);
      const capabilities = await this.api.capabilities();
      if (!capabilities.enabled)
        throw new Error(
          'Histórias ainda não estão habilitadas neste servidor.',
        );
      await this.refreshList();
      if (this.auth.user()?.id !== userId) return;
      this.status.set('degraded');
      httpReady = true;
      if (!this.fallbackTimer)
        this.fallbackTimer = setInterval(() => {
          if (
            this.status() !== 'online' &&
            navigator.onLine &&
            this.auth.user()
          )
            void this.refreshList()
              .then(() => this.refreshCurrent())
              .then(() => {
                if (this.status() !== 'online') this.status.set('degraded');
              })
              .catch(() => this.status.set('offline'));
        }, 15_000);
      this.error.set('');
      const ticket = await this.api.post<{ ticket: string }>(
        'stories/realtime-ticket',
        { installationId: this.installationId },
      );
      if (this.account !== userId || this.auth.user()?.id !== userId) return;
      this.socket?.removeAllListeners();
      this.socket?.disconnect();
      const socket = io(`${this.api.base}/stories`, {
        path: '/story-realtime',
        transports: ['websocket'],
        reconnection: false,
        autoConnect: false,
        auth: { ticket: ticket.ticket },
      });
      this.socket = socket;
      socket.on('connect', () => {
        if (this.account !== userId) {
          socket.disconnect();
          return;
        }
        this.status.set('online');
        this.retry = 0;
        for (const story of this.summaries())
          socket.emit('story.join', story.id);
        if (this.current()) void this.refreshCurrent();
      });
      socket.on('story.event', (event: StoryEvent) => {
        if (this.account !== userId || event.version !== 1) return;
        this.onMessage?.(event);
        if (this.eventTimer) return;
        this.eventTimer = setTimeout(() => {
          this.eventTimer = null;
          void this.refreshList()
            .then(() => this.refreshCurrent())
            .catch((error) => this.fail(error));
        }, 350);
      });
      socket.on('story.alert', (value) => {
        if (this.account === userId) this.onAlert?.(value);
      });
      socket.on('story.sound', (value) => {
        if (this.account === userId) this.onSound?.(value);
      });
      socket.on('story.revoked', (value: { storyId: string }) => {
        void this.revoked(value.storyId);
      });
      const reconnect = () => {
        if (this.account === userId) {
          this.status.set(navigator.onLine ? 'degraded' : 'offline');
          this.scheduleReconnect();
        }
      };
      socket.on('disconnect', reconnect);
      socket.on('connect_error', reconnect);
      socket.connect();
    } catch (error) {
      this.status.set(httpReady && navigator.onLine ? 'degraded' : 'offline');
      this.fail(error);
      this.scheduleReconnect();
    }
  }

  async refreshList(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const summaries = await this.api.list();
    if (this.account !== userId) return;
    const missing = this.summaries().filter(
      (old) => !summaries.some((story) => story.id === old.id),
    );
    for (const story of missing) await this.revoked(story.id);
    this.summaries.set(summaries);
    await this.cached(() => this.cache.saveSummaries(summaries));
    for (const story of summaries) this.socket?.emit('story.join', story.id);
  }

  async open(storyId: string): Promise<void> {
    this.requestedId = storyId;
    await this.initialize();
    if (this.requestedId !== storyId) return;
    this.loading.set(true);
    this.scope.set(null);
    this.viewingLatest.set(true);
    this.current.set(
      this.revokedStories.has(storyId) ? null : this.cache.detail(storyId),
    );
    this.messages.set(
      this.revokedStories.has(storyId) ? [] : this.cache.messages(storyId),
    );
    this.hasOlder.set(
      this.cache.messages(storyId, 201).length > 200 ||
        !this.cache.complete(storyId, this.current()?.story.sequence ?? '0'),
    );
    this.uncertain.set(this.cache.pending(storyId));
    try {
      if (this.auth.user() && navigator.onLine)
        await this.refreshStory(storyId);
      else if (!this.current())
        this.error.set(
          'Esta História ainda não foi baixada. Conecte para abri-la.',
        );
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        [403, 404].includes(error.status)
      )
        await this.revoked(storyId);
      else {
        this.status.set('offline');
        this.fail(error);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async refreshCurrent(): Promise<void> {
    const id = this.current()?.story.id;
    if (!id || this.refreshing) return;
    this.refreshing = this.refreshStory(id)
      .catch(async (error) => {
        if (
          error instanceof HttpErrorResponse &&
          [403, 404].includes(error.status)
        )
          await this.revoked(id);
        else this.fail(error);
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }
  private async refreshStory(id: string): Promise<void> {
    const user = this.account;
    const generation = this.storyEpoch.get(id) ?? 0;
    const detail = await this.api.detail(id);
    const page = await this.api.window(id, undefined, detail.story.sequence);
    if (user !== this.account || generation !== (this.storyEpoch.get(id) ?? 0))
      return;
    this.revokedStories.delete(id);
    await this.cached(() => this.cache.saveDetail(detail));
    await this.cached(() => this.saveWindow(id, page));
    await this.cached(() => this.cache.saveCursor(id, detail.story.sequence));
    if (this.requestedId !== id) return;
    this.current.set(detail);
    if (this.viewingLatest() && !this.scope()) {
      const stored = this.cache.messages(id);
      this.messages.set(this.merge(stored, page.items).slice(-200));
      this.hasOlder.set(page.hasOlder || stored.length > page.items.length);
    }
    this.error.set('');
    await this.reconcile(id);
  }

  async older(): Promise<void> {
    const detail = this.current(),
      before = this.messages()[0]?.sequence;
    if (!detail || !before || this.loading()) return;
    this.loading.set(true);
    this.viewingLatest.set(false);
    try {
      let items = this.cache.messages(
        detail.story.id,
        100,
        before,
        this.scope() ?? undefined,
      );
      if (this.canWrite()) {
        const page = await this.api.window(
          detail.story.id,
          before,
          undefined,
          this.scope() ?? undefined,
        );
        await this.cached(() =>
          this.scope()
            ? this.cache.saveItems(page.items)
            : this.saveWindow(detail.story.id, page),
        );
        items = this.merge(items, page.items);
        this.hasOlder.set(page.hasOlder);
      } else this.hasOlder.set(items.length >= 100);
      if (!items.length && !this.canWrite())
        this.error.set(
          'As mensagens anteriores não estão disponíveis offline.',
        );
      this.messages.set(this.merge(items, this.messages()).slice(0, 200));
    } finally {
      this.loading.set(false);
    }
  }

  async scene(sceneId: string): Promise<void> {
    const detail = this.current();
    if (!detail) return;
    this.scope.set(sceneId);
    this.viewingLatest.set(false);
    this.loading.set(true);
    try {
      let messages = this.cache.messages(
        detail.story.id,
        200,
        undefined,
        sceneId,
      );
      if (this.canWrite()) {
        const page = await this.api.window(
          detail.story.id,
          undefined,
          undefined,
          sceneId,
        );
        await this.cached(() => this.cache.saveItems(page.items));
        messages = this.merge(messages, page.items).slice(-200);
        this.hasOlder.set(page.hasOlder);
      } else this.hasOlder.set(messages.length >= 100);
      this.messages.set(messages);
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
    }
  }
  async latest(): Promise<void> {
    this.scope.set(null);
    this.viewingLatest.set(true);
    if (this.canWrite()) await this.refreshCurrent();
    else if (this.current())
      this.messages.set(this.cache.messages(this.current()!.story.id));
  }

  async send(
    input: StoryMessageInput | StoryRollInput,
    roll = false,
  ): Promise<StoryMessage> {
    this.requireOnline();
    const detail = this.current();
    if (!detail) throw new Error('Abra uma História.');
    const account = this.account;
    await this.cached(() =>
      this.cache.rememberPending(detail.story.id, input.operationId),
    );
    this.uncertain.update((ids) => [...new Set([...ids, input.operationId])]);
    let message: StoryMessage;
    try {
      message = roll
        ? await this.api.roll(detail.story.id, input as StoryRollInput)
        : await this.api.send(detail.story.id, input as StoryMessageInput);
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        error.status >= 400 &&
        error.status < 500
      ) {
        await this.cached(() =>
          this.cache.forgetPending(detail.story.id, input.operationId),
        );
        this.uncertain.update((ids) =>
          ids.filter((id) => id !== input.operationId),
        );
      }
      throw error;
    }
    if (account !== this.account)
      throw new Error('A conta mudou durante o envio.');
    await this.cached(() => this.cache.saveMessage(message));
    await this.cached(() =>
      this.cache.forgetPending(detail.story.id, input.operationId),
    );
    this.uncertain.update((ids) =>
      ids.filter((id) => id !== input.operationId),
    );
    if (this.current()?.story.id === detail.story.id)
      this.messages.set(this.merge(this.messages(), [message]).slice(-200));
    return message;
  }
  async reconcile(storyId = this.current()?.story.id): Promise<void> {
    if (!storyId || !this.canWrite()) return;
    for (const operationId of this.cache.pending(storyId)) {
      try {
        const { result } = await this.api.operation(storyId, operationId);
        if (this.current()?.story.id !== storyId) return;
        await this.cached(() => this.cache.saveMessage(result));
        await this.cached(() => this.cache.forgetPending(storyId, operationId));
        this.uncertain.update((ids) => ids.filter((id) => id !== operationId));
        if (this.viewingLatest())
          this.messages.set(this.merge(this.messages(), [result]).slice(-200));
      } catch {
        /* Query only: never replay an unconfirmed command on reconnect. */
      }
    }
  }
  requireOnline(): void {
    if (!this.canWrite() || !navigator.onLine)
      throw new Error(
        'Conecte ao servidor para enviar mensagens e realizar rolagens.',
      );
  }
  heartbeat(active: boolean): void {
    this.socket?.emit(
      'story.visible',
      active ? (this.current()?.story.id ?? null) : null,
    );
  }
  async markRead(sequences: string[]): Promise<void> {
    const detail = this.current();
    if (!detail || !this.canWrite() || !sequences.length) return;
    const result = await this.api.read(detail.story.id, sequences);
    if (this.current()?.story.id === detail.story.id)
      this.current.update((current) =>
        current
          ? { ...current, member: { ...current.member, ...result } }
          : current,
      );
  }

  retainImage(storyId: string, assetId: string): () => void {
    const key = `${this.account}:${storyId}:${assetId}`;
    this.imageReaders.set(key, (this.imageReaders.get(key) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.imageReaders.get(key) ?? 1) - 1;
      if (remaining > 0) this.imageReaders.set(key, remaining);
      else {
        this.imageReaders.delete(key);
        const url = this.urls.get(key);
        if (url) URL.revokeObjectURL(url);
        this.urls.delete(key);
      }
    };
  }

  async imageUrl(
    storyId: string,
    assetId: string,
    sha256 = '',
  ): Promise<string | null> {
    if (this.revokedStories.has(storyId)) return null;
    const key = `${this.account}:${storyId}:${assetId}`;
    if (this.urls.has(key)) return this.urls.get(key)!;
    if (this.imageLoads.has(key)) return this.imageLoads.get(key)!;
    const account = this.account;
    const generation = this.storyEpoch.get(storyId) ?? 0;
    const promise = (async () => {
      let blob = await this.cache.asset(assetId, storyId).catch(() => null);
      if (!blob && this.canWrite()) {
        blob = await this.api.asset(storyId, assetId);
        if (
          account !== this.account ||
          generation !== (this.storyEpoch.get(storyId) ?? 0)
        )
          return null;
        await this.cached(() =>
          this.cache.saveAsset(storyId, assetId, blob!, sha256, account),
        );
      }
      if (
        !blob ||
        !this.imageReaders.has(key) ||
        account !== this.account ||
        generation !== (this.storyEpoch.get(storyId) ?? 0)
      )
        return null;
      const url = URL.createObjectURL(blob);
      this.urls.set(key, url);
      return url;
    })()
      .catch(() => null)
      .finally(() => this.imageLoads.delete(key));
    this.imageLoads.set(key, promise);
    return promise;
  }

  async export(): Promise<Blob> {
    const detail = this.current();
    if (!detail) throw new Error('Abra uma História.');
    if (this.canWrite()) return this.api.export(detail.story.id);
    if (!this.cache.complete(detail.story.id, detail.story.sequence))
      throw new Error(
        'Conecte para baixar o histórico completo antes de exportar.',
      );
    const messages = this.cache.allMessages(detail.story.id);
    let markdown = `# ${escapeMarkdown(detail.story.title)}\n\nÚltimo recorte baixado: ${detail.story.sequence}\n\nAs imagens exigem conexão e acesso à História no Lorekit.\n\n`;
    for (const scene of detail.scenes) {
      markdown += `## ${escapeMarkdown(scene.title)}\n\n`;
      for (const message of messages.filter(
        (message) => message.sceneId === scene.id,
      ))
        markdown += messageMarkdown(
          message,
          (id) =>
            `https://app.lorekit.online/#/stories/${detail.story.id}/assets/${id}`,
        );
    }
    return new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  }

  private async revoked(id: string): Promise<void> {
    this.storyEpoch.set(id, (this.storyEpoch.get(id) ?? 0) + 1);
    this.revokedStories.add(id);
    this.revokeUrls(id);
    this.drafts.delete(id);
    this.summaries.update((stories) =>
      stories.filter((story) => story.id !== id),
    );
    if (this.current()?.story.id === id) {
      this.requestedId = null;
      this.current.set(null);
      this.messages.set([]);
      this.error.set('O acesso a esta História foi removido.');
    }
    try {
      await this.cache.removeStory(id);
    } catch {
      try {
        await this.cache.transition(this.account);
        if (this.account) await this.cache.open(this.account);
      } catch {
        this.error.set(
          'Acesso removido. Não foi possível limpar o armazenamento local deste dispositivo.',
        );
      }
    }
  }
  private saveWindow(id: string, page: StoryHistoryWindow): Promise<void> {
    return this.cache.savePage(id, page.from, {
      version: 1,
      items: page.items,
      cursor: page.through,
      highWater: page.through,
      complete: !page.hasOlder,
    });
  }
  private merge(first: StoryMessage[], second: StoryMessage[]): StoryMessage[] {
    return [
      ...new Map(
        [...first, ...second].map((message) => [message.id, message]),
      ).values(),
    ].sort((a, b) => (BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1));
  }
  private async cached(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      /* Online data remains usable; the cache exposes a persistent warning. */
    }
  }
  private scheduleReconnect(): void {
    if (this.reconnectTimer || !navigator.onLine || !this.auth.user()) return;
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = null;
        void this.connect();
      },
      Math.min(30_000, 1000 * 2 ** this.retry++),
    );
  }
  private stop(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    if (this.eventTimer) clearTimeout(this.eventTimer);
    this.reconnectTimer = null;
    this.fallbackTimer = null;
    this.eventTimer = null;
  }
  private revokeUrls(storyId?: string): void {
    for (const [key, url] of this.urls)
      if (!storyId || key.includes(`:${storyId}:`)) {
        URL.revokeObjectURL(url);
        this.urls.delete(key);
      }
    if (!storyId) this.imageLoads.clear();
  }
  private fail(error: unknown): void {
    this.error.set(
      error instanceof HttpErrorResponse
        ? error.error?.message || 'Não foi possível alcançar o servidor.'
        : error instanceof Error
          ? error.message
          : 'Não foi possível carregar a História.',
    );
  }
  private installation(): string {
    const key = 'lorekit.stories.installation';
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const id = crypto.randomUUID();
      localStorage.setItem(key, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }
}
