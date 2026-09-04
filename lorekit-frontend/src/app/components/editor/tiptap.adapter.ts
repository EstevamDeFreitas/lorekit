import { JSONContent } from '@tiptap/core';
import {
  EditorCapabilities,
  LorekitBlock,
  LorekitDocument,
  LorekitInline,
  LorekitListItem,
  LorekitText,
  LorekitTextAlign,
  RichTextEditorAdapter,
} from '../../models/lorekit-document.model';

const blockTypes: LorekitBlock['type'][] = ['heading', 'paragraph', 'list', 'quote', 'table', 'image', 'unsupported'];

export class TiptapAdapter implements RichTextEditorAdapter<JSONContent> {
  readonly capabilities: EditorCapabilities = {
    blockTypes: new Set(blockTypes),
    inlineMarks: new Set(['bold', 'italic', 'underline', 'strike', 'color', 'highlight', 'fontSize', 'link', 'mention']),
  };

  toEditor(document: LorekitDocument): JSONContent {
    return { type: 'doc', content: document.blocks.map(block => this.toBlock(block)) };
  }

  fromEditor(document: JSONContent): LorekitDocument {
    return {
      format: 'lorekit-editor',
      version: 1,
      blocks: (document.content ?? []).flatMap(block => this.fromBlock(block)),
    };
  }

  private toBlock(block: LorekitBlock): JSONContent {
    switch (block.type) {
      case 'heading': return { type: 'heading', attrs: { level: block.level, textAlign: block.alignment ?? 'left', textIndent: block.indent ?? 0 }, content: this.toInline(block.content) };
      case 'paragraph': return { type: 'paragraph', attrs: { textAlign: block.alignment ?? 'left', textIndent: block.indent ?? 0 }, content: this.toInline(block.content) };
      case 'list': return {
        type: block.style === 'checklist' ? 'taskList' : block.style === 'ordered' ? 'orderedList' : 'bulletList',
        attrs: block.style === 'ordered' ? { start: block.start } : undefined,
        content: block.items.map(item => this.toListItem(item, block.style)),
      };
      case 'quote': return {
        type: 'lorekitQuote',
        attrs: { caption: block.caption },
        content: [{ type: 'paragraph', attrs: { textAlign: block.alignment ?? 'left' }, content: this.toInline(block.content) }],
      };
      case 'table': return {
        type: 'table',
        content: block.rows.map(row => ({
          type: 'tableRow',
          content: row.map(cell => ({ type: 'tableCell', content: [{ type: 'paragraph', content: this.toInline(cell) }] })),
        })),
      };
      case 'image': return { type: 'lorekitImage', attrs: { url: block.url, caption: block.caption, layout: block.layout } };
      case 'unsupported': return { type: 'lorekitUnsupported', attrs: { source: block.source, originalType: block.originalType, data: block.data } };
    }
  }

  private toListItem(item: LorekitListItem, style: 'ordered' | 'unordered' | 'checklist'): JSONContent {
    const nestedStyle = style === 'checklist' ? 'taskList' : style === 'ordered' ? 'orderedList' : 'bulletList';
    return {
      type: style === 'checklist' ? 'taskItem' : 'listItem',
      attrs: style === 'checklist' ? { checked: item.checked === true } : undefined,
      content: [
        { type: 'paragraph', content: this.toInline(item.content) },
        ...(item.items.length ? [{ type: nestedStyle, content: item.items.map(child => this.toListItem(child, style)) }] : []),
      ],
    };
  }

  private toInline(content: LorekitInline[]): JSONContent[] {
    return content.map(part => {
      if (part.kind === 'mention') {
        return { type: 'mention', attrs: { id: part.entityId, entityId: part.entityId, entityTable: part.entityTable, label: part.label } };
      }
      const marks: JSONContent['marks'] = [];
      if (part.bold) marks.push({ type: 'bold' });
      if (part.italic) marks.push({ type: 'italic' });
      const textStyle = { ...(part.color ? { color: part.color } : {}), ...(part.highlight ? { backgroundColor: part.highlight } : {}), ...(part.fontSize ? { fontSize: part.fontSize } : {}) };
      if (Object.keys(textStyle).length) marks.push({ type: 'textStyle', attrs: textStyle });
      if (part.underline) marks.push({ type: 'underline' });
      if (part.strike) marks.push({ type: 'strike' });
      if (part.link) marks.push({ type: 'link', attrs: { href: part.link } });
      return { type: 'text', text: part.text, marks: marks.length ? marks : undefined };
    });
  }

  private fromBlock(node: JSONContent): LorekitBlock[] {
    switch (node.type) {
      case 'heading': return [{ type: 'heading', level: this.headingLevel(node.attrs?.['level']), content: this.fromInline(node.content), alignment: this.textAlign(node.attrs?.['textAlign']), indent: this.textIndent(node.attrs?.['textIndent']) }];
      case 'paragraph': return [{ type: 'paragraph', content: this.fromInline(node.content), alignment: this.textAlign(node.attrs?.['textAlign']), indent: this.textIndent(node.attrs?.['textIndent']) }];
      case 'bulletList': return [{ type: 'list', style: 'unordered', start: 1, items: this.fromList(node.content, 'unordered') }];
      case 'orderedList': return [{ type: 'list', style: 'ordered', start: this.positiveNumber(node.attrs?.['start']), items: this.fromList(node.content, 'ordered') }];
      case 'taskList': return [{ type: 'list', style: 'checklist', start: 1, items: this.fromList(node.content, 'checklist') }];
      case 'blockquote': return [{ type: 'quote', content: this.fromInlineFromBlocks(node.content), caption: [], alignment: this.firstBlockAlignment(node.content) }];
      case 'lorekitQuote': return [{ type: 'quote', content: this.fromInlineFromBlocks(node.content), caption: this.inlineAttr(node.attrs?.['caption']), alignment: this.firstBlockAlignment(node.content) }];
      case 'table': return [{ type: 'table', rows: this.fromTable(node.content) }];
      case 'image': return [{ type: 'image', url: this.string(node.attrs?.['src']), caption: [], layout: this.defaultLayout() }];
      case 'lorekitImage': return [{ type: 'image', url: this.string(node.attrs?.['url']), caption: this.inlineAttr(node.attrs?.['caption']), layout: this.imageLayout(node.attrs?.['layout']) }];
      case 'lorekitUnsupported': return [{ type: 'unsupported', source: this.string(node.attrs?.['source']) || 'tiptap', originalType: this.string(node.attrs?.['originalType']) || 'unknown', data: this.record(node.attrs?.['data']) }];
      default: return [{ type: 'unsupported', source: 'tiptap', originalType: node.type || 'unknown', data: { attrs: this.record(node.attrs), content: node.content ?? [] } }];
    }
  }

  private fromList(nodes: JSONContent[] | undefined, style: 'ordered' | 'unordered' | 'checklist'): LorekitListItem[] {
    return (nodes ?? []).filter(node => node.type === 'listItem' || node.type === 'taskItem').map(node => {
      const children = node.content ?? [];
      const paragraph = children.find(child => child.type === 'paragraph');
      const nested = children.find(child => child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList');
      return {
        content: this.fromInline(paragraph?.content),
        checked: style === 'checklist' && node.attrs?.['checked'] === true ? true : undefined,
        items: nested ? this.fromList(nested.content, nested.type === 'taskList' ? 'checklist' : nested.type === 'orderedList' ? 'ordered' : 'unordered') : [],
      };
    });
  }

  private fromTable(rows: JSONContent[] | undefined): LorekitInline[][][] {
    return (rows ?? []).filter(row => row.type === 'tableRow').map(row =>
      (row.content ?? []).filter(cell => cell.type === 'tableCell' || cell.type === 'tableHeader').map(cell => this.fromInlineFromBlocks(cell.content)),
    );
  }

  private fromInlineFromBlocks(nodes: JSONContent[] | undefined): LorekitInline[] {
    return (nodes ?? []).flatMap(node => node.type === 'paragraph' ? this.fromInline(node.content) : this.fromInlineFromBlocks(node.content));
  }

  private fromInline(nodes: JSONContent[] | undefined): LorekitInline[] {
    return (nodes ?? []).flatMap<LorekitInline>(node => {
      if (node.type === 'mention') {
        const entityId = this.string(node.attrs?.['entityId']) || this.string(node.attrs?.['id']);
        const entityTable = this.string(node.attrs?.['entityTable']);
        const label = this.string(node.attrs?.['label']) || entityId;
        return entityId && entityTable ? [{ kind: 'mention', entityId, entityTable, label }] : [];
      }
      if (node.type === 'hardBreak') return [{ kind: 'text', text: '\n' }];
      if (node.type !== 'text') return [];
      const marks = node.marks ?? [];
      const text: LorekitText = { kind: 'text', text: node.text ?? '' };
      for (const mark of marks) {
        if (mark.type === 'bold') text.bold = true;
        if (mark.type === 'italic') text.italic = true;
        if (mark.type === 'underline') text.underline = true;
        if (mark.type === 'strike') text.strike = true;
        if (mark.type === 'link') text.link = this.string(mark.attrs?.['href']) || undefined;
        if (mark.type === 'highlight') text.highlight = this.string(mark.attrs?.['color']) || 'marker';
        if (mark.type === 'textStyle') {
          text.color = this.string(mark.attrs?.['color']) || undefined;
          text.highlight = this.string(mark.attrs?.['backgroundColor']) || text.highlight;
          text.fontSize = this.string(mark.attrs?.['fontSize']) || undefined;
        }
      }
      return [text];
    });
  }

  private inlineAttr(value: unknown): LorekitInline[] {
    return Array.isArray(value) ? value.filter(this.isInline) : [];
  }

  private isInline = (value: unknown): value is LorekitInline => {
    if (!this.isRecord(value)) return false;
    return value['kind'] === 'mention'
      ? typeof value['entityTable'] === 'string' && typeof value['entityId'] === 'string' && typeof value['label'] === 'string'
      : value['kind'] === 'text' && typeof value['text'] === 'string';
  };

  private imageLayout(value: unknown) {
    const layout = this.record(value);
    return {
      withBorder: layout['withBorder'] === true,
      withBackground: layout['withBackground'] === true,
      stretched: layout['stretched'] === true,
      width: this.string(layout['width']) || 'auto',
    };
  }

  private defaultLayout() { return { withBorder: false, withBackground: false, stretched: false, width: 'auto' }; }
  private textAlign(value: unknown): LorekitTextAlign { return value === 'center' || value === 'right' || value === 'justify' ? value : 'left'; }
  private textIndent(value: unknown): number { const indent = Number(value); return Number.isInteger(indent) && indent > 0 ? Math.min(indent, 8) : 0; }
  private firstBlockAlignment(nodes: JSONContent[] | undefined): LorekitTextAlign { return this.textAlign((nodes ?? []).find(node => node.type === 'paragraph')?.attrs?.['textAlign']); }
  private headingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 { const level = Number(value); return Number.isInteger(level) && level >= 1 && level <= 6 ? level as 1 | 2 | 3 | 4 | 5 | 6 : 2; }
  private positiveNumber(value: unknown): number { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 1; }
  private string(value: unknown): string { return typeof value === 'string' ? value : ''; }
  private record(value: unknown): Record<string, unknown> { return this.isRecord(value) ? value : {}; }
  private isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
}
