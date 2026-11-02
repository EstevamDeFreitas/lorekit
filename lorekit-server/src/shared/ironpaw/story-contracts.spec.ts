import {
  assertStoryScope,
  contractSequence,
  parseCreateStoryInput,
  parseStoryMessageInput,
  parseStoryRollInput,
  parseStorySpeakerInput,
} from './story-contracts';

const id = '3a8ea667-ed8d-4a71-9957-42e0a0bc797f';
const message = {
  version: 1,
  operationId: id,
  sceneId: id,
  speakerId: id,
  revisionId: id,
  text: '**Olá**',
  assetIds: [],
};
describe('Story versioned contracts', () => {
  it('accepts a character revision with sheet vitals and rejects unknown fields', () => {
    const vitals = { current: 3.5, maximum: 6, temporary: 1, conditions: ['Ferido · Leve'] };
    const input = {
      version: 1, operationId: id, sceneId: null, kind: 'character',
      name: 'Herói', color: '#ffffff', portraitAssetId: null,
      mechanics: { kind: 'character', actions: [], vitals },
    };
    expect(parseStorySpeakerInput(input).mechanics).toEqual(input.mechanics);
    expect(() => parseStorySpeakerInput({ ...input, mechanics: {
      ...input.mechanics, vitals: { ...vitals, secret: true },
    } })).toThrow('Campo não permitido.');
  });
  it('validates locutor scope and refuses private character fields', () => {
    const speaker = {
      version: 1,
      operationId: id,
      sceneId: id,
      kind: 'incidental',
      name: 'Guarda',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics: null,
    };
    expect(parseStorySpeakerInput(speaker).name).toBe('Guarda');
    expect(() =>
      parseStorySpeakerInput({ ...speaker, sceneId: null }),
    ).toThrow();
    expect(() =>
      parseStorySpeakerInput({ ...speaker, biography: 'private' }),
    ).toThrow();
    expect(() =>
      parseStorySpeakerInput({
        ...speaker,
        kind: 'character',
        mechanics: { kind: 'character', actions: [], wallet: 'private' },
      }),
    ).toThrow();
  });
  it('accepts a complete message and rejects empty/oversized/forged fields', () => {
    expect(parseStoryMessageInput(message).text).toBe('**Olá**');
    for (const change of [
      { text: ' ' },
      { text: 'x'.repeat(20_001) },
      { authorUserId: id },
      { version: 2 },
      { assetIds: [id, id] },
    ]) {
      expect(() => parseStoryMessageInput({ ...message, ...change })).toThrow();
    }
  });
  it('accepts image-only messages and normalized story creation', () => {
    expect(
      parseStoryMessageInput({ ...message, text: '', assetIds: [id] }).assetIds,
    ).toEqual([id]);
    expect(
      parseCreateStoryInput({
        version: 1,
        operationId: id,
        title: ' História ',
      }).title,
    ).toBe('História');
  });
  it('refuses references across stories and invalid cursors', () => {
    expect(() =>
      assertStoryScope(id, [{ storyId: 'another-story' }]),
    ).toThrow();
    expect(() => assertStoryScope(id, [{ storyId: id }])).not.toThrow();
    for (const cursor of ['-1', '01', '9223372036854775808', 1])
      expect(() => contractSequence(cursor)).toThrow();
    expect(contractSequence('9223372036854775807')).toBe('9223372036854775807');
  });
  it('does not accept client dice results or unsafe roll parameters', () => {
    const request = { ...message, text: undefined, assetIds: undefined };
    delete request.text;
    delete request.assetIds;
    const roll = {
      ...request,
      kind: 'attack',
      actionId: 'claw',
      manualModifier: 0,
      competenceId: null,
      target: null,
      targetSpeakerId: null,
      relatedRollMessageId: null,
    };
    expect(parseStoryRollInput(roll).kind).toBe('attack');
    expect(() => parseStoryRollInput({ ...roll, results: [10] })).toThrow();
    expect(() =>
      parseStoryRollInput({ ...roll, manualModifier: 0.5 }),
    ).toThrow();
  });
});
