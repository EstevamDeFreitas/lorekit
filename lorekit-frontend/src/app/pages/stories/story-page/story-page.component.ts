import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StoryNavigationService } from '../../../services/story-navigation.service';
import { WORKSPACE_TAB_CONTEXT } from '../../../models/workspace-tab-context';
import { DatePipe } from '@angular/common';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  buildNpcRoll,
  buildRollFormula,
  buildRollPreview,
  npcRollActions,
  renderStoryText,
  type ConditionImpact,
  type StoryMessage,
  type StoryMessageInput,
  type StoryRollInput,
  type StoryRollKind,
} from '@lorekit/ironpaw';
import { StoryClientService } from '../../../services/story-client.service';
import { StoryNotificationsService } from '../../../services/story-notifications.service';
import {
  StorySharingService,
  type StorySharingPreview,
  type StorySharingSource,
} from '../../../services/story-sharing.service';
import { AuthService } from '../../../services/auth.service';
import { StoryImageComponent } from '../story-image/story-image.component';

interface Attachment {
  id: string;
  file: File;
  uploaded: boolean;
}
@Component({
  selector: 'app-story-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, StoryImageComponent],
  templateUrl: './story-page.component.html',
  styleUrl: './story-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryPageComponent implements AfterViewInit {
  readonly client = inject(StoryClientService);
  readonly notifications = inject(StoryNotificationsService);
  readonly auth = inject(AuthService);
  private readonly sharing = inject(StorySharingService);
  private readonly navigation = inject(StoryNavigationService);
  private readonly tab = inject(WORKSPACE_TAB_CONTEXT, { optional: true });
  readonly active = computed(() => this.tab?.active() ?? true);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private previousAccount = this.auth.user()?.id ?? null;
  private readonly timeline = viewChild<ElementRef<HTMLElement>>('timeline');
  private readonly composer =
    viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly sending = signal(false);
  readonly panel = signal<
    'none' | 'scene' | 'locutors' | 'share' | 'members' | 'preferences' | 'roll'
  >('none');
  readonly sidebar = signal(false);
  readonly newStory = signal(false);
  readonly sceneId = signal('');
  readonly speakerId = signal('');
  readonly assetRoute = signal<string | null>(null);
  readonly requestedStory = signal<string | null>(null);
  readonly inviteToken = signal<string | null>(null);
  readonly inviteLink = signal('');
  readonly members = signal<
    Array<{ userId: string; name: string | null; role: string }>
  >([]);
  readonly sources = signal<StorySharingSource[]>([]);
  readonly sharePreview = signal<StorySharingPreview | null>(null);
  readonly sharedActions = signal<Set<string>>(new Set());
  readonly sharePortrait = signal(true);
  readonly attachments = signal<Attachment[]>([]);
  readonly incidentalPortrait = signal<File | null>(null);
  readonly atEnd = signal(true);
  readonly rollRevision = signal(0);
  readonly text = new FormControl('', { nonNullable: true });
  readonly title = new FormControl('', { nonNullable: true });
  readonly sceneTitle = new FormControl('', { nonNullable: true });
  readonly speakerName = new FormControl('', { nonNullable: true });
  readonly speakerColor = new FormControl('#d4d4d8', { nonNullable: true });
  readonly sourceName = new FormControl('', { nonNullable: true });
  readonly sourceColor = new FormControl('#d4d4d8', { nonNullable: true });
  readonly existingSpeakerId = new FormControl('', { nonNullable: true });
  readonly rollForm = this.fb.group({
    kind: this.fb.control<StoryRollKind>('test'),
    actionId: '',
    manualModifier: 0,
    target: new FormControl<number | null>(null),
    competenceId: '',
    targetSpeakerId: '',
    relatedRollMessageId: '',
    conditionLabel: '',
    conditionType: this.fb.control<
      'none' | 'modifier' | 'minus-dice' | 'disadvantage'
    >('none'),
    conditionValue: 0,
  });
  readonly visibleSpeakers = computed(
    () =>
      this.client
        .current()
        ?.speakers.filter(
          (speaker) => !speaker.sceneId || speaker.sceneId === this.sceneId(),
        ) ?? [],
  );
  readonly selectedSpeaker = computed(
    () =>
      this.visibleSpeakers().find(
        (speaker) => speaker.id === this.speakerId(),
      ) ?? null,
  );
  readonly rollActions = computed(() => {
    const mechanics = this.selectedSpeaker()?.revision.mechanics;
    return mechanics?.kind === 'character'
      ? mechanics.actions
      : mechanics?.kind === 'npc'
        ? npcRollActions(mechanics.definition)
        : [];
  });
  readonly competencies = computed(() => {
    this.rollRevision();
    const mechanics = this.selectedSpeaker()?.revision.mechanics;
    if (mechanics?.kind !== 'npc') return [];
    const action = this.rollActions().find(
      (action) => action.id === this.rollForm.controls.actionId.value,
    );
    return mechanics.definition.tags.filter(
      (tag) =>
        tag.type === 'competence' &&
        (!tag.attribute || tag.attribute === action?.attribute),
    );
  });
  readonly preview = computed(() => {
    this.rollRevision();
    const mechanics = this.selectedSpeaker()?.revision.mechanics,
      input = this.rollForm.getRawValue();
    try {
      if (mechanics?.kind === 'npc')
        return buildNpcRoll(
          mechanics.definition,
          input.actionId,
          input.competenceId || null,
          this.conditionImpacts(),
          input.manualModifier,
        );
      if (mechanics?.kind !== 'character') return null;
      const action = mechanics.actions.find(
        (action) => action.id === input.actionId,
      );
      if (!action) return null;
      return buildRollPreview(
        Math.max(1, action.skillLevel),
        [
          {
            key: 'skill',
            label: 'Treino da perícia',
            value: action.skillLevel >= 1 ? 1 : 0,
            category: 'skill',
          },
          {
            key: 'source',
            label: action.sourceLabel,
            value: action.sourceValue,
            category: 'source',
          },
          {
            key: 'manual',
            label: 'Ajuste manual',
            value: input.manualModifier,
            category: 'manual',
          },
        ],
        [...action.impacts, ...this.conditionImpacts()],
      );
    } catch {
      return null;
    }
  });
  readonly groups = computed(() =>
    (this.client.current()?.scenes ?? []).map((scene) => ({
      scene,
      messages: this.client
        .messages()
        .filter((message) => message.sceneId === scene.id),
    })),
  );
  readonly previousRolls = computed(() =>
    this.client.messages().filter((message) => message.roll),
  );
  readonly renderText = renderStoryText;
  readonly formula = buildRollFormula;
  readonly statusLabels = {
    success: 'Sucesso',
    near: 'Por pouco',
    fail: 'Falha',
    neutral: 'Sem dificuldade definida',
  };
  private pending: {
    input: StoryMessageInput | StoryRollInput;
    roll: boolean;
  } | null = null;
  private readObserver: IntersectionObserver | null = null;
  private readonly seen = new Set<string>();
  private readTimer: ReturnType<typeof setTimeout> | null = null;
  private createOperation = crypto.randomUUID();

  constructor() {
    effect(() => {
      const account = this.auth.user()?.id ?? null;
      if (account === this.previousAccount) return;
      this.previousAccount = account;
      this.text.setValue('', { emitEvent: false });
      this.attachments.set([]);
      this.sceneId.set('');
      this.speakerId.set('');
      this.pending = null;
      this.requestedStory.set(null);
    });
    this.text.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((text) => this.rememberDraft(text));
    this.rollForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.rollRevision.update((value) => value + 1));
    effect(() => {
      const target = this.navigation.target();
      if (!target) {
        const id = this.client.current()?.story.id;
        if (id && !this.requestedStory()) {
          this.requestedStory.set(id);
          this.restoreDraft(id);
        }
        return;
      }
      this.assetRoute.set(target.assetId);
      this.inviteToken.set(target.token);
      if (this.requestedStory() !== target.id) {
        this.rememberDraft(this.text.value);
        this.requestedStory.set(target.id);
        if (target.id) void this.open(target.id);
      }
    });
    effect(() => {
      const actions = this.rollActions();
      if (
        !actions.some(
          (action) => action.id === this.rollForm.controls.actionId.value,
        )
      )
        this.rollForm.controls.actionId.setValue(actions[0]?.id ?? '');
    });
    effect(() => {
      this.client.messages();
      this.client.current();
      this.panel();
      if (!this.active()) {
        this.readObserver?.disconnect();
        this.client.heartbeat(false);
        return;
      }
      const follow =
        this.atEnd() && this.client.viewingLatest() && !this.client.scope();
      setTimeout(() => {
        this.observeMessages();
        if (follow) this.scrollToEnd();
      }, 0);
    });
    const heartbeat = setInterval(
      () =>
        this.client.heartbeat(
          this.active() &&
            Boolean(this.timeline()) &&
            document.visibilityState === 'visible' &&
            this.atEnd() &&
            this.client.viewingLatest(),
        ),
      5000,
    );
    this.destroy.onDestroy(() => {
      clearInterval(heartbeat);
      this.readObserver?.disconnect();
      if (this.readTimer) clearTimeout(this.readTimer);
      this.client.heartbeat(false);
      this.rememberDraft(this.text.value);
    });
  }
  ngAfterViewInit(): void {
    this.observeMessages();
  }
  private async open(id: string): Promise<void> {
    await this.client.open(id);
    if (this.requestedStory() !== id) return;
    this.restoreDraft(id);
    this.sidebar.set(false);
    this.pending = null;
    this.error.set('');
    setTimeout(() => this.scrollToEnd(), 0);
  }
  private restoreDraft(id: string): void {
    const draft = this.client.drafts.get(id),
      scenes = this.client.current()?.scenes ?? [];
    this.sceneId.set(draft?.sceneId || scenes.at(-1)?.id || '');
    this.speakerId.set(draft?.speakerId || '');
    this.text.setValue(draft?.text || '', { emitEvent: false });
  }
  private rememberDraft(text: string): void {
    const id = this.requestedStory();
    if (id && this.auth.user()?.id && this.auth.user()?.id === this.previousAccount)
      this.client.drafts.set(id, {
        text,
        sceneId: this.sceneId(),
        speakerId: this.speakerId(),
      });
  }
  async create(): Promise<void> {
    await this.act(async () => {
      this.client.requireOnline();
      const story = await this.client.api.create(
        this.title.value,
        this.createOperation,
      );
      this.createOperation = crypto.randomUUID();
      this.title.setValue('');
      this.newStory.set(false);
      await this.client.refreshList();
      await this.router.navigate(['/stories', story.id]);
    });
  }
  async acceptInvite(): Promise<void> {
    await this.act(async () => {
      const result = await this.client.api.post<{ storyId: string }>(
        'story-invites/accept',
        { token: this.inviteToken() },
      );
      this.inviteToken.set(null);
      await this.client.refreshList();
      await this.router.navigate(['/stories', result.storyId], {
        replaceUrl: true,
      });
    });
  }
  async addScene(rename = false): Promise<void> {
    await this.act(async () => {
      this.client.requireOnline();
      const id = this.client.current()!.story.id;
      const scene = rename
        ? await this.client.api.renameScene(
            id,
            this.sceneId(),
            this.sceneTitle.value,
            crypto.randomUUID(),
          )
        : await this.client.api.scene(
            id,
            this.sceneTitle.value,
            crypto.randomUUID(),
          );
      this.sceneId.set(scene.id);
      this.sceneTitle.setValue('');
      await this.client.refreshCurrent();
      this.panel.set('none');
    });
  }
  selectScene(id: string): void {
    this.sceneId.set(id);
    if (
      !this.visibleSpeakers().some((speaker) => speaker.id === this.speakerId())
    )
      this.speakerId.set('');
    this.rememberDraft(this.text.value);
  }
  async browseScene(id: string): Promise<void> {
    this.selectScene(id);
    await this.client.scene(id);
    this.sidebar.set(false);
  }
  async addSpeaker(): Promise<void> {
    await this.act(async () => {
      this.client.requireOnline();
      const portrait = this.incidentalPortrait();
      const portraitAssetId = portrait ? await this.uploadFile(portrait) : null;
      const speaker = await this.client.api.speaker(
        this.client.current()!.story.id,
        {
          version: 1,
          operationId: crypto.randomUUID(),
          sceneId: this.sceneId(),
          kind: 'incidental',
          name: this.speakerName.value,
          color: this.speakerColor.value,
          portraitAssetId,
          mechanics: null,
        },
      );
      await this.client.refreshCurrent();
      this.speakerId.set(speaker.id);
      this.speakerName.setValue('');
      this.notice.set('Locutor criado somente para esta cena.');
      this.incidentalPortrait.set(null);
    });
  }
  async library(): Promise<void> {
    await this.act(async () => {
      this.sources.set(await this.sharing.sources());
      this.panel.set('share');
    });
  }
  chooseSource(source: StorySharingSource): void {
    try {
      const preview = this.sharing.preview(source);
      this.sharePreview.set(preview);
      this.sourceName.setValue(source.name);
      this.sourceColor.setValue(preview.color);
      this.existingSpeakerId.setValue('');
      this.sharedActions.set(
        new Set(
          preview.mechanics?.kind === 'character'
            ? preview.mechanics.actions.map((action) => action.id)
            : [],
        ),
      );
    } catch (error) {
      this.fail(error);
    }
  }
  toggleAction(id: string, checked: boolean): void {
    this.sharedActions.update((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  async publish(): Promise<void> {
    const preview = this.sharePreview();
    if (!preview) return;
    await this.act(async () => {
      const speaker = await this.sharing.publish(
        preview,
        this.sourceName.value,
        this.sourceColor.value,
        this.sharePortrait(),
        [...this.sharedActions()],
        this.sceneId() || null,
        this.existingSpeakerId.value || undefined,
      );
      this.speakerId.set(speaker.id);
      this.panel.set('none');
      this.sharePreview.set(null);
      this.notice.set(
        'Locutor disponibilizado. A origem permanece independente.',
      );
    });
  }
  files(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (this.attachments().length + files.length > 4) {
      this.error.set('Anexe até quatro imagens por mensagem.');
      return;
    }
    if (
      files.some(
        (file) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      this.error.set('Use imagens PNG, JPEG ou WebP de até 10 MiB.');
      return;
    }
    this.attachments.update((previous) => [
      ...previous,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        uploaded: false,
      })),
    ]);
  }
  removeAttachment(id: string): void {
    this.attachments.update((files) => files.filter((file) => file.id !== id));
  }
  async send(roll = false, retry = false): Promise<void> {
    if (this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    try {
      this.client.requireOnline();
      const detail = this.client.current(),
        speaker = this.selectedSpeaker();
      if (!detail || !speaker || !this.sceneId())
        throw new Error('Escolha a cena e o locutor antes de enviar.');
      if (!retry) {
        if (roll) {
          const values = this.rollForm.getRawValue();
          this.pending = {
            roll: true,
            input: {
              version: 1,
              operationId: crypto.randomUUID(),
              sceneId: this.sceneId(),
              speakerId: speaker.id,
              revisionId: speaker.revision.id,
              kind: values.kind,
              actionId: values.actionId,
              manualModifier: values.manualModifier,
              target: values.target,
              competenceId: values.competenceId || null,
              targetSpeakerId: values.targetSpeakerId || null,
              relatedRollMessageId: values.relatedRollMessageId || null,
              conditionImpacts: this.conditionImpacts(),
            },
          };
        } else {
          if (!this.text.value.trim() && !this.attachments().length)
            throw new Error('Escreva uma mensagem ou anexe uma imagem.');
          const sceneId = this.sceneId(),
            text = this.text.value,
            attachments = [...this.attachments()],
            accountId = this.auth.user()?.id;
          for (const attachment of attachments) {
            if (attachment.uploaded) continue;
            const bytes = await attachment.file.arrayBuffer(),
              digest = await crypto.subtle.digest('SHA-256', bytes);
            const sha256 = [...new Uint8Array(digest)]
              .map((byte) => byte.toString(16).padStart(2, '0'))
              .join('');
            await this.client.api.reserve(detail.story.id, {
              id: attachment.id,
              name: attachment.file.name,
              mimeType: attachment.file.type,
              sizeBytes: attachment.file.size,
              sha256,
            });
            await this.client.api.upload(
              detail.story.id,
              attachment.id,
              bytes,
              attachment.file.type,
            );
            attachment.uploaded = true;
          }
          if (
            this.client.current()?.story.id !== detail.story.id ||
            this.auth.user()?.id !== accountId
          )
            throw new Error(
              'A História ou a conta mudou durante o upload. Revise o rascunho antes de enviar.',
            );
          this.pending = {
            roll: false,
            input: {
              version: 1,
              operationId: crypto.randomUUID(),
              sceneId,
              speakerId: speaker.id,
              revisionId: speaker.revision.id,
              text,
              assetIds: attachments.map((attachment) => attachment.id),
            },
          };
        }
      }
      if (!this.pending) return;
      const pending = this.pending;
      const message = await this.client.send(pending.input, pending.roll);
      if (
        this.client.current()?.story.id !== detail.story.id ||
        this.pending !== pending
      )
        return;
      if (!pending.roll) {
        this.text.setValue('');
        this.attachments.set([]);
        this.client.drafts.delete(detail.story.id);
      }
      this.pending = null;
      this.notice.set('');
      this.panel.set('none');
      this.scrollToMessage(message.id);
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        error.status >= 400 &&
        error.status < 500
      )
        this.pending = null;
      this.fail(error);
    } finally {
      this.sending.set(false);
    }
  }
  retryPending(): void {
    void this.send(false, true);
  }
  hasPending(): boolean {
    return Boolean(this.pending);
  }
  async checkPending(): Promise<void> {
    const pending = this.pending;
    await this.client.reconcile();
    if (
      !this.client.uncertain().includes(this.pending?.input.operationId ?? '')
    ) {
      if (
        pending &&
        !pending.roll &&
        this.client
          .messages()
          .some((message) => message.operationId === pending.input.operationId)
      ) {
        if (this.text.value === (pending.input as StoryMessageInput).text)
          this.text.setValue('');
        this.attachments.set([]);
      }
      this.pending = null;
    }
  }
  format(mark: string): void {
    const input = this.composer()?.nativeElement,
      start = input?.selectionStart ?? this.text.value.length,
      end = input?.selectionEnd ?? start;
    const selection = this.text.value.slice(start, end);
    this.text.setValue(
      this.text.value.slice(0, start) +
        (mark === '>'
          ? '> ' + selection.replaceAll('\n', '\n> ')
          : mark + selection + mark) +
        this.text.value.slice(end),
    );
    queueMicrotask(() => {
      input?.focus();
      input?.setSelectionRange(
        start + mark.length,
        start + mark.length + selection.length,
      );
    });
  }
  readValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  readChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
  portraitFile(event: Event): void {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = '';
    if (
      file &&
      ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) &&
      file.size <= 10 * 1024 * 1024
    )
      this.incidentalPortrait.set(file);
    else this.error.set('Use um retrato PNG, JPEG ou WebP de até 10 MiB.');
  }
  keyboardSend(event: Event): void {
    event.preventDefault();
    void this.send();
  }
  async download(): Promise<void> {
    await this.act(async () => {
      const blob = await this.client.export(),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `${
        this.client
          .current()
          ?.story.title.replace(/[^\p{L}\p{N} _-]/gu, '')
          .slice(0, 80) || 'historia'
      }.md`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  async participants(): Promise<void> {
    await this.act(async () => {
      this.members.set(
        await this.client.api.get(
          `stories/${this.client.current()!.story.id}/members`,
        ),
      );
      this.panel.set('members');
    });
  }
  async invite(): Promise<void> {
    await this.act(async () => {
      const result = await this.client.api.post<{ token: string }>(
        `stories/${this.client.current()!.story.id}/invites`,
        {},
      );
      const origin =
        location.protocol === 'lorekit:'
          ? 'https://app.lorekit.online/'
          : `${location.origin}${location.pathname}`;
      this.inviteLink.set(`${origin}#/stories/invite/${result.token}`);
      this.panel.set('members');
    });
  }
  async removeMember(userId: string): Promise<void> {
    await this.act(async () => {
      await this.client.api.remove(
        `stories/${this.client.current()!.story.id}/members/${userId}`,
      );
      await this.participants();
    });
  }
  async savePreferences(sound: boolean, external: boolean): Promise<void> {
    await this.act(async () => {
      await this.client.api.preferences(
        this.client.current()!.story.id,
        sound,
        external,
      );
      await this.client.refreshCurrent();
      await this.client.refreshList();
    });
  }
  onScroll(): void {
    const element = this.timeline()?.nativeElement;
    if (element) {
      this.atEnd.set(
        element.scrollHeight - element.scrollTop - element.clientHeight < 120,
      );
      this.client.heartbeat(
        this.atEnd() &&
          document.visibilityState === 'visible' &&
          this.client.viewingLatest(),
      );
    }
  }
  async latest(): Promise<void> {
    await this.client.latest();
    setTimeout(() => this.scrollToEnd(), 0);
  }
  nameColor(color: string): string {
    let channels = [1, 3, 5].map((index) =>
      parseInt(color.slice(index, index + 2), 16),
    );
    for (let attempt = 0; attempt < 8; attempt++) {
      const luminance = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      if (
        (0.2126 * luminance[0] +
          0.7152 * luminance[1] +
          0.0722 * luminance[2] +
          0.05) /
          0.053 >=
        4.5
      )
        break;
      channels = channels.map((channel) =>
        Math.round(channel + (255 - channel) * 0.25),
      );
    }
    return `rgb(${channels.join(',')})`;
  }
  private conditionImpacts(): ConditionImpact[] {
    const values = this.rollForm.getRawValue();
    if (values.conditionType === 'none') return [];
    return [
      {
        key: 'context',
        label: values.conditionLabel || 'Condição contextual',
        type: values.conditionType,
        value:
          values.conditionType === 'disadvantage' ? 0 : values.conditionValue,
        displayValue:
          values.conditionType === 'disadvantage'
            ? 'Desvantagem'
            : values.conditionType === 'minus-dice'
              ? `-${values.conditionValue}d10`
              : String(values.conditionValue),
      },
    ];
  }
  private async uploadFile(file: File): Promise<string> {
    const storyId = this.client.current()!.story.id,
      id = crypto.randomUUID(),
      bytes = await file.arrayBuffer();
    const sha256 = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    ]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    await this.client.api.reserve(storyId, {
      id,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256,
    });
    await this.client.api.upload(storyId, id, bytes, file.type);
    return id;
  }
  private observeMessages(): void {
    this.readObserver?.disconnect();
    const root = this.timeline()?.nativeElement;
    if (!root || !this.active()) return;
    this.readObserver = new IntersectionObserver(
      (entries) => {
        if (!this.active() || document.visibilityState !== 'visible') return;
        for (const entry of entries)
          if (entry.isIntersecting) {
            const seq = (entry.target as HTMLElement).dataset['sequence'];
            if (seq) this.seen.add(seq);
          }
        if (!this.readTimer && this.seen.size)
          this.readTimer = setTimeout(() => {
            const sequences = [...this.seen];
            this.seen.clear();
            this.readTimer = null;
            void this.client.markRead(sequences).catch(() => undefined);
          }, 1000);
      },
      { root, threshold: 0.01 },
    );
    root
      .querySelectorAll('[data-sequence]')
      .forEach((element) => this.readObserver!.observe(element));
  }
  private scrollToEnd(): void {
    const element = this.timeline()?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
      this.atEnd.set(true);
    }
  }
  private scrollToMessage(id: string): void {
    setTimeout(
      () =>
        this.timeline()
          ?.nativeElement.querySelector(`[data-message-id="${id}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      0,
    );
  }
  private async act(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }
  private fail(error: unknown): void {
    this.error.set(
      error instanceof HttpErrorResponse
        ? error.error?.message ||
            'Não foi possível concluir. Verifique a conexão.'
        : error instanceof Error
          ? error.message
          : 'Não foi possível concluir.',
    );
  }
}
