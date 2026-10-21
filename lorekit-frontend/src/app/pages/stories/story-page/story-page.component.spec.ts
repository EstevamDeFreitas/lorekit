import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { StoryPageComponent } from './story-page.component';
import { StoryClientService } from '../../../services/story-client.service';
import { StoryNotificationsService } from '../../../services/story-notifications.service';
import { StorySharingService } from '../../../services/story-sharing.service';
import { AuthService } from '../../../services/auth.service';
import { StoryNavigationService } from '../../../services/story-navigation.service';
import {
  WORKSPACE_TAB_CONTEXT,
  WorkspaceTabContext,
} from '../../../models/workspace-tab-context';
import type {
  StoryDetail,
  StoryMessage,
  StoryMessageInput,
} from '@lorekit/ironpaw';

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
      drafts: new Map(),
      heartbeat: jasmine.createSpy('heartbeat'),
      markRead: jasmine.createSpy('read'),
      send: jasmine.createSpy('send'),
      requireOnline: () => {
        if (!canWrite()) throw new Error('Conecte para enviar.');
      },
    };
  }
  let client: ReturnType<typeof mockClient>;
  let tab: WorkspaceTabContext;
  let user = signal({ id: account });
  beforeEach(async () => {
    client = mockClient();
    user = signal({ id: account });
    tab = new WorkspaceTabContext('story-tab');
    tab.setActive(true);
    await TestBed.configureTestingModule({
      imports: [StoryPageComponent],
      providers: [
        provideRouter([]),
        { provide: StoryNavigationService, useValue: { target: signal(null) } },
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
