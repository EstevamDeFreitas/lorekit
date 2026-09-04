import { TiptapAdapter } from './tiptap.adapter';
import { EditorJsAdapter } from './editor-js.adapter';
import { LorekitDocumentCodec } from './lorekit-document.codec';

describe('TiptapAdapter', () => {
  const adapter = new TiptapAdapter();

  it('round-trips canonical formatting, mentions and rich blocks', () => {
    const canonical = LorekitDocumentCodec.deserialize(JSON.stringify({
      format: 'lorekit-editor', version: 1, blocks: [
        { type: 'heading', level: 2, alignment: 'center', content: [{ kind: 'text', text: 'Atlas', bold: true }] },
        { type: 'paragraph', alignment: 'justify', indent: 2, content: [
          { kind: 'text', text: 'Veja ', italic: true, underline: true, strike: true, color: '#ef4444', highlight: '#fef08a', fontSize: '18px', link: 'https://example.com' },
          { kind: 'mention', entityTable: 'characters', entityId: 'hero', label: 'Herói' },
        ] },
        { type: 'list', style: 'checklist', start: 1, items: [{ content: [{ kind: 'text', text: 'Tarefa' }], checked: true, items: [] }] },
        { type: 'quote', content: [{ kind: 'text', text: 'Citação' }], caption: [{ kind: 'text', text: 'Fonte' }] },
        { type: 'table', rows: [[[{ kind: 'text', text: 'A' }], [{ kind: 'text', text: 'B' }]]] },
        { type: 'image', url: 'lorekit-asset://map', caption: [{ kind: 'text', text: 'Mapa' }], layout: { withBorder: true, withBackground: false, stretched: false, width: '50%' } },
      ],
    }));

    const result = adapter.fromEditor(adapter.toEditor(canonical));

    expect(result.blocks).toEqual(jasmine.arrayContaining([
      jasmine.objectContaining({ type: 'heading', level: 2, alignment: 'center' }),
      jasmine.objectContaining({ type: 'list', style: 'checklist' }),
      jasmine.objectContaining({ type: 'quote', caption: [{ kind: 'text', text: 'Fonte' }] }),
      jasmine.objectContaining({ type: 'image', url: 'lorekit-asset://map' }),
    ]));
    const paragraph = result.blocks[1];
    expect(paragraph).toEqual(jasmine.objectContaining({ type: 'paragraph', indent: 2 }));
    if (paragraph.type === 'paragraph') {
      expect(paragraph.content).toEqual(jasmine.arrayContaining([
        jasmine.objectContaining({ kind: 'text', italic: true, underline: true, strike: true, color: '#ef4444', highlight: '#fef08a', fontSize: '18px', link: 'https://example.com' }),
        jasmine.objectContaining({ kind: 'mention', entityTable: 'characters', entityId: 'hero', label: 'Herói' }),
      ]));
    }
  });

  it('preserves unknown Tiptap nodes explicitly and accepts legacy Editor.js input through the codec', () => {
    const legacy = LorekitDocumentCodec.deserialize(JSON.stringify({
      blocks: [{ type: 'paragraph', data: { text: '<strong>Legado</strong>' } }],
    }));
    const plain = LorekitDocumentCodec.deserialize('Texto simples');
    expect(adapter.fromEditor(adapter.toEditor(plain)).blocks[0]).toEqual(jasmine.objectContaining({ type: 'paragraph' }));
    const editorJsOutput = new EditorJsAdapter().toEditor(adapter.fromEditor(adapter.toEditor(legacy)));
    expect(editorJsOutput.blocks[0]).toEqual(jasmine.objectContaining({ type: 'paragraph' }));

    const result = adapter.fromEditor({ type: 'doc', content: [
      ...(adapter.toEditor(legacy).content ?? []),
      { type: 'futureExtension', attrs: { value: 'preservar' } },
    ] });

    expect(result.blocks[0]).toEqual(jasmine.objectContaining({ type: 'paragraph' }));
    expect(result.blocks[1]).toEqual(jasmine.objectContaining({
      type: 'unsupported', source: 'tiptap', originalType: 'futureExtension', data: jasmine.objectContaining({ attrs: { value: 'preservar' } }),
    }));
  });
});
