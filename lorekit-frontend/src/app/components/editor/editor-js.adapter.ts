import { EditorCapabilities, LorekitBlock, LorekitDocument, LorekitListItem, RichTextEditorAdapter } from '../../models/lorekit-document.model';
import { LorekitDocumentCodec } from './lorekit-document.codec';

export type EditorJsBlock = { type: string; data: Record<string, unknown> };
export type EditorJsOutputData = { blocks: EditorJsBlock[]; time?: number; version?: string };

const supportedBlockTypes: LorekitBlock['type'][] = ['heading', 'paragraph', 'list', 'quote', 'table', 'image', 'unsupported'];

export class EditorJsAdapter implements RichTextEditorAdapter<EditorJsOutputData> {
  readonly capabilities: EditorCapabilities = { blockTypes: new Set(supportedBlockTypes), inlineMarks: new Set(['bold', 'italic', 'underline', 'strike', 'color', 'highlight', 'fontSize', 'link', 'mention']) };

  toEditor(document: LorekitDocument): EditorJsOutputData {
    return { blocks: document.blocks.map(block => this.toBlock(block)) };
  }
  fromEditor(document: EditorJsOutputData): LorekitDocument { return LorekitDocumentCodec.fromEditorJs(document); }

  private toBlock(block: LorekitBlock): EditorJsBlock {
    switch (block.type) {
      case 'heading': return { type: 'header', data: { level: block.level, text: LorekitDocumentCodec.inlineToHtml(block.content), alignment: block.alignment ?? 'left', indent: block.indent ?? 0 } };
      case 'paragraph': return { type: 'paragraph', data: { text: LorekitDocumentCodec.inlineToHtml(block.content), alignment: block.alignment ?? 'left', indent: block.indent ?? 0 } };
      case 'list': return { type: 'list', data: { style: block.style, meta: { start: block.start }, items: block.items.map(item => this.toListItem(item)) } };
      case 'quote': return { type: 'quote', data: { text: LorekitDocumentCodec.inlineToHtml(block.content), caption: LorekitDocumentCodec.inlineToHtml(block.caption), alignment: block.alignment ?? 'left' } };
      case 'table': return { type: 'table', data: { content: block.rows.map(row => row.map(cell => LorekitDocumentCodec.inlineToHtml(cell))) } };
      case 'image': return { type: 'image', data: { url: block.url, caption: LorekitDocumentCodec.inlineToHtml(block.caption), ...block.layout } };
      case 'unsupported': return { type: block.originalType, data: block.data };
    }
  }
  private toListItem(item: LorekitListItem): Record<string, unknown> { return { content: LorekitDocumentCodec.inlineToHtml(item.content), meta: item.checked ? { checked: true } : {}, items: item.items.map(child => this.toListItem(child)) }; }
}
