import { TestBed } from '@angular/core/testing';
import { Component, signal, ViewChild, ViewContainerRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { StoryPageComponent } from './story-page.component';
import { StoryClientService } from '../../../services/story-client.service';
import { StoryNotificationsService } from '../../../services/story-notifications.service';
import { StorySharingService } from '../../../services/story-sharing.service';
import { AuthService } from '../../../services/auth.service';
import { StoryNavigationService } from '../../../services/story-navigation.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { FLUSH_PENDING_SAVES_EVENT } from '../../../utils/pending-save-event';
import { WorkspaceTabViewHostService } from '../../../services/workspace-tab-view-host.service';
import {
  WORKSPACE_TAB_CONTEXT,
  WorkspaceTabContext,
} from '../../../models/workspace-tab-context';
import type {
  StoryDetail,
  StoryMessage,
  StoryMessageInput,
} from '@lorekit/ironpaw';

@Component({ template: '<ng-container #outlet />' })
class StoryTabTestHost {
  @ViewChild('outlet', { read: ViewContainerRef }) outlet!: ViewContainerRef;
}

@Component({ template: 'Outra aba' })
class OtherTabTestComponent {}

describe('Story RP screen', () => {
  const storyId = crypto.randomUUID(),
    sceneId = crypto.randomUUID(),
    account = crypto.randomUUID();
  const revision = {
    id: crypto.randomUUID(),
    storyId,
    speakerId: crypto.randomUUID(),
    number: 1,
    name: 'Guarda',
    color: '#ffffff',
    portraitAssetId: null,
    mechanics: null,
    createdAt: '',
  };
  const detail: StoryDetail = {
    story: {
      version: 1,
      id: storyId,
      ownerUserId: account,
      title: 'Uma História',
      sequence: '0',
      createdAt: '',
      updatedAt: '',
    },
    member: {
      storyId,
      userId: account,
      role: 'owner',
      readCursor: '0',
      seen: [],
      sound: true,
      external: true,
    },
    scenes: [
      { id: sceneId, storyId, title: 'Uma cena', position: '1', createdAt: '' },
    ],
    speakers: [
      {
        id: revision.speakerId,
        storyId,
        sceneId,
        kind: 'incidental',
        publisherUserId: account,
        revision,
      },
    ],
  };
  function mockClient() {
    const canWrite = signal(false);
    const drafts = new Map();
    return {
      current: signal(detail),
      messages: signal([]),
      summaries: signal([]),
      canWrite,
      status: signal('offline'),
      viewingLatest: signal(true),
      scope: signal(null),
      error: signal(''),
      uncertain: signal([]),
      loading: signal(false),
      hasOlder: signal(false),
      cache: { warning: signal('') },
      drafts,
      saveDraft: (id: string, draft: unknown) => drafts.set(id, draft),
      deleteDraft: (id: string) => drafts.delete(id),
      flushDraftWrites: jasmine.createSpy('flushDraftWrites').and.resolveTo(),
      heartbeat: jasmine.createSpy('heartbeat'),
      markRead: jasmine.createSpy('read'),
      send: jasmine.createSpy('send'),
      initialize: jasmine.createSpy('initialize').and.resolveTo(),
      open: jasmine.createSpy('open').and.resolveTo(),
      requireOnline: () => {
        if (!canWrite()) throw new Error('Conecte para enviar.');
      },
    };
  }
  let client: ReturnType<typeof mockClient>;
  let tab: WorkspaceTabContext;
  let navigationTarget = signal<{ id: string | null; sceneId: string | null; assetId: string | null; token: string | null } | null>(null);
  let user = signal({ id: account });
  beforeEach(async () => {
    client = mockClient();
    user = signal({ id: account });
    navigationTarget.set(null);
    tab = new WorkspaceTabContext('story-tab');
    tab.setActive(true);
    await TestBed.configureTestingModule({
      imports: [StoryPageComponent, StoryTabTestHost, OtherTabTestComponent],
      providers: [
        provideRouter([]),
        { provide: StoryNavigationService, useValue: { target: navigationTarget } },
        { provide: TabManagerService, useValue: { openTab: jasmine.createSpy('openTab') } },
        { provide: WORKSPACE_TAB_CONTEXT, useValue: tab },
        { provide: StoryClientService, useValue: client },
        { provide: StorySharingService, useValue: {} },
        {
          provide: StoryNotificationsService,
          useValue: { soundReady: signal(false), pushState: signal('') },
        },
        { provide: AuthService, useValue: { user } },
      ],
    }).compileComponents();
  });
  it('renders cached scenes and blocks online mutations', async () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Somente consulta');
    expect(fixture.nativeElement.textContent).toContain('Uma cena');
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const createSceneButton = Array.from(buttons).find(button =>
      button.textContent?.includes('Nova cena'),
    );
    expect(createSceneButton).toBeDefined();
    expect(createSceneButton?.disabled).toBeTrue();
    fixture.componentInstance.sceneId.set(sceneId);
    fixture.componentInstance.speakerId.set(revision.speakerId);
    fixture.componentInstance.text.setValue('Rascunho');
    await fixture.componentInstance.send();
    expect(client.send).not.toHaveBeenCalled();
    expect(fixture.componentInstance.text.value).toBe('Rascunho');
    fixture.destroy();
  });
  it('opens story actions as dismissible dialogs and rolls as a compact non-modal panel', () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.panel.set('scene');
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.panel()).toBe('none');
    component.panel.set('roll');
    fixture.detectChanges();
    const roll = fixture.nativeElement.querySelector('#story-roll-panel') as HTMLElement;
    expect(roll.getAttribute('role')).toBe('region');
    expect(roll.getAttribute('aria-modal')).toBeNull();
    expect(roll.textContent).toContain('Rolagem tática');
    roll.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(component.panel()).toBe('none');
    fixture.destroy();
  });
  it('rolls for a sidebar character without changing the composer speaker', async () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    const component = fixture.componentInstance;
    client.canWrite.set(true);
    const mechanics = { kind: 'character' as const, actions: [{ id: 'perception', name: 'Percepção', attribute: 'PERCEPTION', description: '', skillLevel: 1, sourceLabel: 'Percepção', sourceValue: 2, impacts: [] }] };
    client.current.update(current => ({ ...current, speakers: [{ ...current.speakers[0], kind: 'character', revision: { ...revision, mechanics } }] }));
    fixture.detectChanges();
    component.sceneId.set(sceneId);
    component.speakerId.set('');
    component.openRoll(revision.speakerId, null);
    fixture.detectChanges();
    client.send.and.resolveTo({ id: 'result' } as StoryMessage);
    await component.send(true);
    expect(component.speakerId()).toBe('');
    expect(client.send).toHaveBeenCalledWith(jasmine.objectContaining({ speakerId: revision.speakerId, actionId: 'perception' }), true);
    fixture.destroy();
  });
  it('sends a named free formula without a selected speaker', async () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    client.canWrite.set(true);
    component.sceneId.set(sceneId);
    component.openRoll(null, null);
    component.freeRollForm.setValue({ name: 'Armadilha', formula: '2d6+3' });
    fixture.detectChanges();
    client.send.and.resolveTo({ id: 'result' } as StoryMessage);
    await component.send(true);
    expect(client.send).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'free', name: 'Armadilha', formula: '2d6+3' }), true);
    expect(component.speakerId()).toBe('');
    fixture.destroy();
  });
  it('keeps the draft and stops visibility receipts while another tab is selected', () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.text.setValue('Rascunho preservado');
    tab.setActive(false);
    fixture.detectChanges();
    expect(client.heartbeat).toHaveBeenCalledWith(false);
    tab.setActive(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.text.value).toBe('Rascunho preservado');
    fixture.destroy();
  });
  it('keeps queued lines and the current composer text when the story tab is inactive', () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.sceneId.set(sceneId);
    component.speakerId.set(revision.speakerId);
    component.text.setValue('Fala na fila');
    component.addComposerMessage();
    component.text.setValue('Texto ainda em edição');
    tab.setActive(false);
    fixture.detectChanges();
    tab.setActive(true);
    fixture.detectChanges();
    expect(component.queuedMessages().map(line => line.text)).toEqual(['Fala na fila']);
    expect(component.text.value).toBe('Texto ainda em edição');
    fixture.destroy();
  });
  it('preserves the actual story view and its unsent text across workspace tab switches', () => {
    const fixture = TestBed.createComponent(StoryTabTestHost);
    fixture.detectChanges();
    const host = TestBed.inject(WorkspaceTabViewHostService);
    const outlet = fixture.componentInstance.outlet;
    const storyTab = { id: 'story-real', title: 'Histórias', icon: '', entityType: 'view' as const, entityId: 'stories', paneId: 'pane', isDirty: false, resolvedComponent: StoryPageComponent };
    const otherTab = { ...storyTab, id: 'other', entityId: 'other', resolvedComponent: OtherTabTestComponent };
    host.activate(storyTab, outlet, true, {});
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Mensagem ainda não enviada';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    host.activate(otherTab, outlet, true, {});
    fixture.detectChanges();
    host.activate(storyTab, outlet, true, {});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('textarea')).toBe(textarea);
    expect(textarea.value).toBe('Mensagem ainda não enviada');
    host.invalidateAll();
    fixture.destroy();
  });
  it('restores unsent text and queued lines if the story view is recreated in the same session', () => {
    const first = TestBed.createComponent(StoryPageComponent);
    first.detectChanges();
    first.componentInstance.sceneId.set(sceneId);
    first.componentInstance.speakerId.set(revision.speakerId);
    first.componentInstance.text.setValue('Fala aguardando');
    first.componentInstance.addComposerMessage();
    first.componentInstance.text.setValue('Ainda escrevendo');
    first.destroy();

    const reopened = TestBed.createComponent(StoryPageComponent);
    reopened.detectChanges();
    expect(reopened.componentInstance.text.value).toBe('Ainda escrevendo');
    expect(reopened.componentInstance.queuedMessages().map(line => line.text)).toEqual(['Fala aguardando']);
    reopened.destroy();
  });
  it('keeps the saved draft when refreshing again while the story is loading', async () => {
    const draft = { accountId: account, text: 'Rascunho protegido', sceneId, speakerId: revision.speakerId, queuedMessages: [], attachments: [] };
    client.drafts.set(storyId, draft);
    let finishOpen!: () => void;
    client.open.and.returnValue(new Promise<void>(resolve => { finishOpen = resolve; }));
    navigationTarget.set({ id: storyId, sceneId: null, assetId: null, token: null });
    const first = TestBed.createComponent(StoryPageComponent);
    first.detectChanges();
    expect(first.componentInstance.text.value).toBe('Rascunho protegido');
    await Promise.resolve();
    first.destroy();
    expect(client.drafts.get(storyId)?.text).toBe('Rascunho protegido');
    const reopened = TestBed.createComponent(StoryPageComponent);
    reopened.detectChanges();
    expect(reopened.componentInstance.text.value).toBe('Rascunho protegido');
    finishOpen();
    await Promise.resolve();
    reopened.destroy();
  });
  it('waits for the draft write when the workspace flushes before a refresh', async () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.text.setValue('Texto antes de atualizar');
    let finish!: () => void;
    client.flushDraftWrites.and.returnValue(new Promise<void>(resolve => { finish = resolve; }));
    const detail = { tabId: 'story-tab', flushes: [] as Promise<unknown>[] };
    window.dispatchEvent(new CustomEvent(FLUSH_PENDING_SAVES_EVENT, { detail }));
    expect(client.drafts.get(storyId)?.text).toBe('Texto antes de atualizar');
    expect(detail.flushes.length).toBe(1);
    finish();
    await Promise.all(detail.flushes);
    fixture.destroy();
  });
  it('does not save a detached old-account draft into the next session when the tab closes', () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges(); fixture.componentInstance.text.setValue('Rascunho privado');
    client.drafts.clear(); user.set({ id: crypto.randomUUID() });
    fixture.destroy();
    expect(client.drafts.size).toBe(0);
  });
  it('allows every participant to select shared locutors and safely previews markup', () => {
    const fixture = TestBed.createComponent(StoryPageComponent),
      component = fixture.componentInstance;
    component.sceneId.set(sceneId);
    component.speakerId.set(revision.speakerId);
    expect(component.selectedSpeaker()?.revision.name).toBe('Guarda');
    expect(component.preview()).toBeNull();
    expect(
      component.renderText('<img src=x onerror=alert(1)> **texto**'),
    ).toContain('&lt;img');
    expect(component.renderText('**texto**')).toContain(
      '<strong>texto</strong>',
    );
    fixture.destroy();
  });
  it('rejects an empty composer before issuing a command', async () => {
    const fixture = TestBed.createComponent(StoryPageComponent),
      component = fixture.componentInstance;
    client.canWrite.set(true);
    component.sceneId.set(sceneId);
    component.speakerId.set(revision.speakerId);
    await component.send();
    expect(client.send).not.toHaveBeenCalled();
    expect(component.error()).toContain('Escreva uma fala');
    fixture.destroy();
  });
  it('applies a palette color to the selection and renders it safely in the preview', () => {
    const fixture = TestBed.createComponent(StoryPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.text.setValue('**fala** <img src=x onerror=alert(1)>');
    fixture.detectChanges();
    const composer: HTMLTextAreaElement = fixture.nativeElement.querySelector('#rp-message');
    composer.setSelectionRange(0, 8);
    component.chooseTextColor('#ef4444');
    fixture.detectChanges();
    const preview: HTMLElement = fixture.nativeElement.querySelector('.text-preview > div');
    const colored = preview.querySelector('span');
    expect(colored?.style.color).toBe('rgb(239, 68, 68)');
    expect(colored?.querySelector('strong')?.textContent).toBe('fala');
    expect(preview.querySelector('img')).toBeNull();
    fixture.destroy();
  });
  it('sends staged dialogue in order with the locutor chosen for each line', async () => {
    const fixture = TestBed.createComponent(StoryPageComponent),
      component = fixture.componentInstance,
      secondSpeakerId = crypto.randomUUID(),
      secondRevision = {
        ...revision,
        id: crypto.randomUUID(),
        speakerId: secondSpeakerId,
        name: 'Viajante',
        color: '#facc15',
      },
      secondSpeaker = {
        id: secondSpeakerId,
        storyId,
        sceneId,
        kind: 'incidental' as const,
        publisherUserId: account,
        revision: secondRevision,
      };
    client.canWrite.set(true);
    component.sceneId.set(sceneId);
    component.speakerId.set(revision.speakerId);
    component.text.setValue('A porta rangeu.');
    component.addComposerMessage();
    component.speakerId.set(secondSpeakerId);
    component.text.setValue('Quem está aí?');
    client.current.update((current) =>
      current ? { ...current, speakers: [...current.speakers, secondSpeaker] } : current,
    );
    client.send.and.returnValues(
      Promise.resolve({ id: 'message-1' } as StoryMessage),
      Promise.resolve({ id: 'message-2' } as StoryMessage),
    );

    await component.send();

    expect(client.send).toHaveBeenCalledTimes(2);
    const first = client.send.calls.argsFor(0)[0] as StoryMessageInput,
      second = client.send.calls.argsFor(1)[0] as StoryMessageInput;
    expect(first.text).toBe('A porta rangeu.');
    expect(first.speakerId).toBe(revision.speakerId);
    expect(second.text).toBe('Quem está aí?');
    expect(second.speakerId).toBe(secondSpeakerId);
    expect(component.queuedMessages().length).toBe(0);
    expect(component.text.value).toBe('');
    fixture.destroy();
  });
  it('edits a staged line in place without creating a duplicate', () => {
    const fixture = TestBed.createComponent(StoryPageComponent),
      component = fixture.componentInstance;
    client.canWrite.set(true);
    component.sceneId.set(sceneId);
    component.speakerId.set(revision.speakerId);
    component.text.setValue('Primeira versão.');
    component.addComposerMessage();
    const original = component.queuedMessages()[0]!;
    component.editQueuedMessage(original.id);
    expect(component.text.value).toBe('Primeira versão.');
    component.text.setValue('Versão revisada.');
    component.addComposerMessage();
    expect(component.queuedMessages()).toHaveSize(1);
    expect(component.queuedMessages()[0]?.id).toBe(original.id);
    expect(component.queuedMessages()[0]?.text).toBe('Versão revisada.');
    expect(component.editingDraftId()).toBeNull();
    fixture.destroy();
  });
});
