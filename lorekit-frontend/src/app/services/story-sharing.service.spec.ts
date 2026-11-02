import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { createNpcDefinition } from '@lorekit/ironpaw';
import { StorySharingService } from './story-sharing.service';
import { DbProvider } from '../database/db-provider.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';
import { StoryClientService } from './story-client.service';
import { IrpwNpcCatalogService } from './irpw-npc-catalog.service';
import { CharacterService } from './character.service';
import { IrpwCharacterSheetService } from './irpw-character-sheet.service';
import { ImageService } from './image.service';

describe('Explicit story projections', () => {
  it('publishes the sheet vitals along with the selected actions', async () => {
    const api = { speaker: jasmine.createSpy().and.resolveTo({ id: 'speaker' }) };
    const client = { api, requireOnline: () => {}, current: () => ({ story: { id: 'story' } }), refreshCurrent: async () => {} };
    TestBed.configureTestingModule({ providers: [
      StorySharingService,
      { provide: DbProvider, useValue: { ready: signal(true), readOnly: signal(false) } },
      { provide: WorkspaceRuntimeService, useValue: {} },
      { provide: StoryClientService, useValue: client },
    ] });
    const vitals = { current: 3, maximum: 6, temporary: 1, conditions: ['Ferido · Leve'] };
    await TestBed.inject(StorySharingService).publish({
      source: { id: 'hero', kind: 'character', name: 'Herói' }, color: '#ffffff', portrait: null,
      mechanics: { kind: 'character', actions: [], vitals },
    }, 'Herói', '#ffffff', false, [], null);
    expect(api.speaker.calls.mostRecent().args[1].mechanics.vitals).toEqual(vitals);
    localStorage.removeItem('story-sheet:story:speaker');
  });
  it('omits private character fields and NPC notes without opening another workspace', () => {
    const definition = createNpcDefinition();
    definition.notes = 'PRIVATE NPC NOTES';
    const workspace = jasmine.createSpyObj('workspace', [
      'initializeAuthenticatedWeb',
    ]);
    const character = {
      id: 'character',
      name: 'Hero',
      biography: 'PRIVATE BIOGRAPHY',
      wallet: 'PRIVATE WALLET',
      Images: [],
      Personalizations: [],
    };
    TestBed.configureTestingModule({
      providers: [
        StorySharingService,
        {
          provide: DbProvider,
          useValue: { ready: signal(true), readOnly: signal(false) },
        },
        { provide: WorkspaceRuntimeService, useValue: workspace },
        { provide: StoryClientService, useValue: {} },
        {
          provide: IrpwNpcCatalogService,
          useValue: { get: () => ({ color: '#ffffff', definition }) },
        },
        {
          provide: CharacterService,
          useValue: { getCharacter: () => character },
        },
        {
          provide: IrpwCharacterSheetService,
          useValue: { getSheet: () => null },
        },
        { provide: ImageService, useValue: { getImage: () => null } },
      ],
    });
    const sharing = TestBed.inject(StorySharingService);
    const npc = sharing.preview({ id: 'npc', kind: 'npc', name: 'Guarda' });
    expect(JSON.stringify(npc)).not.toContain('PRIVATE');
    expect(definition.notes).toBe('PRIVATE NPC NOTES');
    const hero = sharing.preview({
      id: 'character',
      kind: 'character',
      name: 'Hero',
    });
    expect(JSON.stringify(hero)).not.toContain('PRIVATE');
    expect(hero.mechanics).toBeNull();
    expect(workspace.initializeAuthenticatedWeb).not.toHaveBeenCalled();
  });
});
