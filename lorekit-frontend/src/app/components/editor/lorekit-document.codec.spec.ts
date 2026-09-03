import { EditorJsAdapter } from './editor-js.adapter';
import { LorekitDocumentCodec } from './lorekit-document.codec';

describe('LorekitDocumentCodec', () => {
  it('normalizes text and legacy Editor.js documents without persisting Editor.js metadata', () => {
    const plain = LorekitDocumentCodec.deserialize('Linha um\nLinha dois');
    expect(plain.format).toBe('lorekit-editor');
    expect(LorekitDocumentCodec.toPlainText(plain)).toContain('Linha dois');

    const legacy = LorekitDocumentCodec.deserialize(JSON.stringify({
      time: 123,
      version: '2.31.0',
      blocks: [{ type: 'header', data: { level: 3, text: '<strong>Crônicas</strong>' } }],
    }));
    expect(legacy.blocks[0]).toEqual(jasmine.objectContaining({ type: 'heading', level: 3 }));
    expect(LorekitDocumentCodec.serialize(legacy)).not.toContain('2.31.0');
  });

  it('preserves inline formatting, links and entity mentions from legacy HTML', () => {
    const document = LorekitDocumentCodec.deserialize(JSON.stringify({
      blocks: [{ type: 'paragraph', data: { text: '<strong>Forte</strong> <em>leve</em> <font color="#ff0000">rubra</font> <mark style="background: yellow">marcada</mark> <a href="https://example.com">link</a> <a href="lorekit://entity/Character/hero">@Herói</a>' } }],
    }));
    const block = document.blocks[0];
    expect(block.type).toBe('paragraph');
    if (block.type !== 'paragraph') {
      fail('Expected paragraph');
      return;
    }
    expect(block.content).toEqual(jasmine.arrayContaining([
      jasmine.objectContaining({ kind: 'text', text: 'Forte', bold: true }),
      jasmine.objectContaining({ kind: 'text', text: 'leve', italic: true }),
      jasmine.objectContaining({ kind: 'text', text: 'rubra', color: '#ff0000' }),
      jasmine.objectContaining({ kind: 'text', text: 'marcada', highlight: 'yellow' }),
      jasmine.objectContaining({ kind: 'text', text: 'link', link: 'https://example.com' }),
      jasmine.objectContaining({ kind: 'mention', entityTable: 'Character', entityId: 'hero', label: 'Herói' }),
    ]));
  });

  it('round-trips Editor.js blocks and preserves unsupported blocks explicitly', () => {
    const adapter = new EditorJsAdapter();
    const input = {
      blocks: [
        { type: 'list', data: { style: 'checklist', items: [{ content: 'Tarefa', meta: { checked: true }, items: [{ content: 'Filha' }] }] } },
        { type: 'image', data: { url: 'lorekit-asset://image-id', caption: 'Mapa', width: '50%', withBorder: true } },
        { type: 'custom-plugin', data: { value: 'preservar' } },
      ],
    };
    const canonical = adapter.fromEditor(input);
    expect(canonical.blocks[2]).toEqual(jasmine.objectContaining({ type: 'unsupported', originalType: 'custom-plugin' }));
    const output = adapter.toEditor(canonical);
    expect(output.blocks[0].data['style']).toBe('checklist');
    expect(output.blocks[2]).toEqual({ type: 'custom-plugin', data: { value: 'preservar' } });
  });

  it('projects canonical documents for previews and Markdown', () => {
    const document = LorekitDocumentCodec.deserialize(JSON.stringify({
      blocks: [
        { type: 'header', data: { level: 2, text: 'Atlas' } },
        { type: 'table', data: { content: [['Nome', 'Valor'], ['Lua', '1']] } },
        { type: 'image', data: { url: 'https://example.com/mapa.png', caption: 'Mapa' } },
      ],
    }));
    expect(LorekitDocumentCodec.toPreviewBlocks(document)).toEqual(jasmine.arrayContaining([
      jasmine.objectContaining({ type: 'heading', text: 'Atlas' }),
      jasmine.objectContaining({ type: 'table', rows: [['Nome', 'Valor'], ['Lua', '1']] }),
    ]));
    expect(LorekitDocumentCodec.toMarkdown(document)).toContain('![Mapa](https://example.com/mapa.png)');
  });
});
