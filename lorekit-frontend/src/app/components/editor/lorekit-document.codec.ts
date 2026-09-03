import {
  LOREKIT_DOCUMENT_FORMAT,
  LOREKIT_DOCUMENT_VERSION,
  LorekitBlock,
  LorekitDocument,
  LorekitImageLayout,
  LorekitInline,
  LorekitListItem,
  LorekitText,
} from '../../models/lorekit-document.model';

export type DocumentPreviewBlock = { type: string; text: string; level?: number; rows?: string[][] };

const DEFAULT_IMAGE_LAYOUT: LorekitImageLayout = { withBorder: false, withBackground: false, stretched: false, width: 'auto' };

export class LorekitDocumentCodec {
  static deserialize(value: string | null | undefined): LorekitDocument {
    if (!value?.trim()) return this.empty();
    try {
      const parsed: unknown = JSON.parse(value);
      if (this.isLorekitDocument(parsed)) return parsed;
      if (this.isRecord(parsed) && Array.isArray(parsed['blocks'])) return this.fromEditorJs(parsed);
    } catch {
      // Treat malformed serialized content as literal text.
    }
    return { ...this.empty(), blocks: [{ type: 'paragraph', content: this.htmlToInline(value.replace(/\n/g, '<br>')) }] };
  }

  static serialize(document: LorekitDocument): string {
    return JSON.stringify(this.normalize(document));
  }

  static empty(): LorekitDocument {
    return { format: LOREKIT_DOCUMENT_FORMAT, version: LOREKIT_DOCUMENT_VERSION, blocks: [] };
  }

  static isLorekitDocument(value: unknown): value is LorekitDocument {
    return this.isRecord(value)
      && value['format'] === LOREKIT_DOCUMENT_FORMAT
      && value['version'] === LOREKIT_DOCUMENT_VERSION
      && Array.isArray(value['blocks']);
  }

  static fromEditorJs(value: Record<string, unknown>): LorekitDocument {
    const blocks = Array.isArray(value['blocks']) ? value['blocks'] : [];
    return { ...this.empty(), blocks: blocks.flatMap(block => this.fromEditorBlock(block)) };
  }

  static toPlainText(document: LorekitDocument): string {
    const lines = this.normalize(document).blocks.flatMap(block => this.blockToText(block));
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  static toMarkdown(document: LorekitDocument): string {
    const lines: string[] = [];
    for (const block of this.normalize(document).blocks) {
      switch (block.type) {
        case 'heading': lines.push(`${'#'.repeat(block.level)} ${this.inlineToMarkdown(block.content)}`, ''); break;
        case 'paragraph': lines.push(this.inlineToMarkdown(block.content), ''); break;
        case 'list': lines.push(...this.listToMarkdown(block.items, block.style, 0, block.start), ''); break;
        case 'quote': {
          const text = this.inlineToMarkdown(block.content);
          if (text) text.split('\n').forEach(line => lines.push(`> ${line}`));
          const caption = this.inlineToMarkdown(block.caption);
          if (caption) lines.push(`> - ${caption}`);
          lines.push(''); break;
        }
        case 'table': {
          if (block.rows.length) {
            lines.push(`| ${block.rows[0].map(cell => this.escapePipes(this.inlineToText(cell))).join(' | ')} |`);
            lines.push(`| ${block.rows[0].map(() => '---').join(' | ')} |`);
            block.rows.slice(1).forEach(row => lines.push(`| ${row.map(cell => this.escapePipes(this.inlineToText(cell))).join(' | ')} |`));
            lines.push('');
          } break;
        }
        case 'image': lines.push(`![${this.inlineToText(block.caption)}](${block.url})`, ''); break;
        case 'unsupported': lines.push(`[Conteúdo não suportado: ${block.originalType}]`, ''); break;
      }
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  static toPreviewBlocks(document: LorekitDocument): DocumentPreviewBlock[] {
    return this.normalize(document).blocks.slice(0, 30).map(block => {
      if (block.type === 'table') return { type: 'table', text: '', rows: block.rows.map(row => row.map(this.inlineToText)) };
      if (block.type === 'heading') return { type: 'heading', level: block.level, text: this.inlineToText(block.content) };
      if (block.type === 'list') return { type: 'list', text: this.listToText(block.items).join('\n') };
      if (block.type === 'quote') return { type: 'quote', text: [this.inlineToText(block.content), this.inlineToText(block.caption)].filter(Boolean).join('\n') };
      if (block.type === 'image') return { type: 'image', text: this.inlineToText(block.caption) || block.url };
      if (block.type === 'unsupported') return { type: 'unsupported', text: `[${block.originalType}]` };
      return { type: 'paragraph', text: this.inlineToText(block.content) };
    });
  }

  static htmlToInline(html: string): LorekitInline[] {
    if (typeof DOMParser === 'undefined') return [{ kind: 'text', text: html.replace(/<[^>]*>/g, '') }];
    const root = new DOMParser().parseFromString(html || '', 'text/html').body;
    const output: LorekitInline[] = [];
    const visit = (node: Node, marks: Omit<LorekitText, 'kind' | 'text'>): void => {
      if (node.nodeType === Node.TEXT_NODE) { if (node.textContent) output.push({ kind: 'text', text: node.textContent.replace(/\u00a0/g, ' '), ...marks }); return; }
      if (!(node instanceof HTMLElement)) return;
      if (node.tagName === 'BR') { output.push({ kind: 'text', text: '\n', ...marks }); return; }
      const next = { ...marks };
      const tag = node.tagName.toLowerCase();
      if (tag === 'strong' || tag === 'b') next.bold = true;
      if (tag === 'em' || tag === 'i') next.italic = true;
      if (tag === 'font') next.color = node.getAttribute('color') || node.style.color || undefined;
      if (tag === 'mark') next.highlight = node.style.backgroundColor || node.style.background || 'marker';
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        const match = href.match(/^lorekit:\/\/entity\/([^/]+)\/([^/?#]+)/i);
        if (match) { output.push({ kind: 'mention', entityTable: decodeURIComponent(match[1]), entityId: decodeURIComponent(match[2]), label: (node.textContent || '').replace(/^@/, '') }); return; }
        if (/^(https?:|mailto:|#)/i.test(href)) next.link = href;
      }
      node.childNodes.forEach(child => visit(child, next));
    };
    root.childNodes.forEach(node => visit(node, {}));
    return output;
  }

  static inlineToHtml(content: LorekitInline[]): string {
    return content.map(part => {
      if (part.kind === 'mention') return `<a href="lorekit://entity/${encodeURIComponent(part.entityTable)}/${encodeURIComponent(part.entityId)}" data-mention="true" data-entity-table="${this.escapeAttr(part.entityTable)}" data-entity-id="${this.escapeAttr(part.entityId)}">@${this.escapeHtml(part.label)}</a>`;
      let html = this.escapeHtml(part.text).replace(/\n/g, '<br>');
      if (part.bold) html = `<strong>${html}</strong>`;
      if (part.italic) html = `<em>${html}</em>`;
      if (part.color) html = `<font color="${this.escapeAttr(part.color)}">${html}</font>`;
      if (part.highlight) html = `<mark style="background:${this.escapeAttr(part.highlight)}">${html}</mark>`;
      if (part.link) html = `<a href="${this.escapeAttr(part.link)}">${html}</a>`;
      return html;
    }).join('');
  }

  static inlineToText(content: LorekitInline[]): string { return content.map(part => part.kind === 'mention' ? `@${part.label}` : part.text).join('').replace(/\u00a0/g, ' ').trim(); }

  private static normalize(document: LorekitDocument): LorekitDocument {
    return { ...this.empty(), blocks: Array.isArray(document.blocks) ? document.blocks : [] };
  }

  private static fromEditorBlock(value: unknown): LorekitBlock[] {
    if (!this.isRecord(value)) return [];
    const type = this.string(value['type']) || 'paragraph';
    const data = this.isRecord(value['data']) ? value['data'] : {};
    if (type === 'header') return [{ type: 'heading', level: this.headingLevel(data['level']), content: this.htmlToInline(this.string(data['text'])) }];
    if (type === 'paragraph') return [{ type: 'paragraph', content: this.htmlToInline(this.string(data['text'])) }];
    if (type === 'list') return [{ type: 'list', style: this.listStyle(data['style']), start: this.positiveNumber(this.record(data['meta'])['start']), items: this.fromEditorList(data['items']) }];
    if (type === 'quote') return [{ type: 'quote', content: this.htmlToInline(this.string(data['text'])), caption: this.htmlToInline(this.string(data['caption'])) }];
    if (type === 'table') return [{ type: 'table', rows: this.tableRows(data['content']) }];
    if (type === 'image') return [{ type: 'image', url: this.string(data['url']) || this.string(this.record(data['file'])['url']), caption: this.htmlToInline(this.string(data['caption'])), layout: { withBorder: data['withBorder'] === true, withBackground: data['withBackground'] === true, stretched: data['stretched'] === true, width: this.string(data['width']) || 'auto' } }];
    return [{ type: 'unsupported', source: 'editorjs', originalType: type, data }];
  }

  private static fromEditorList(value: unknown): LorekitListItem[] {
    if (!Array.isArray(value)) return [];
    return value.map(item => {
      if (typeof item === 'string') return { content: this.htmlToInline(item), items: [] };
      const record = this.record(item); const meta = this.record(record['meta']);
      return { content: this.htmlToInline(this.string(record['content']) || this.string(record['text'])), checked: meta['checked'] === true || undefined, items: this.fromEditorList(record['items']) };
    });
  }

  private static tableRows(value: unknown): LorekitInline[][][] {
    return Array.isArray(value) ? value.filter(Array.isArray).map(row => (row as unknown[]).map(cell => this.htmlToInline(this.string(cell)))) : [];
  }
  private static blockToText(block: LorekitBlock): string[] {
    if (block.type === 'heading' || block.type === 'paragraph') return [this.inlineToText(block.content), ''];
    if (block.type === 'list') return [...this.listToText(block.items), ''];
    if (block.type === 'quote') return [this.inlineToText(block.content), this.inlineToText(block.caption), ''].filter(Boolean);
    if (block.type === 'table') return [...block.rows.map(row => row.map(this.inlineToText).join('\t')), ''];
    if (block.type === 'image') return [`[Imagem: ${this.inlineToText(block.caption) || block.url}]`, ''];
    return [`[Conteúdo não suportado: ${block.originalType}]`, ''];
  }
  private static listToText(items: LorekitListItem[], depth = 0): string[] { return items.flatMap(item => [`${'  '.repeat(depth)}- ${this.inlineToText(item.content)}`, ...this.listToText(item.items, depth + 1)]); }
  private static listToMarkdown(items: LorekitListItem[], style: 'ordered' | 'unordered' | 'checklist', depth: number, start: number): string[] { return items.flatMap((item, index) => { const prefix = style === 'ordered' ? `${start + index}.` : style === 'checklist' ? `- [${item.checked ? 'x' : ' '}]` : '-'; return [`${'  '.repeat(depth)}${prefix} ${this.inlineToMarkdown(item.content)}`, ...this.listToMarkdown(item.items, style, depth + 1, 1)]; }); }
  private static inlineToMarkdown(content: LorekitInline[]): string { return content.map(part => { if (part.kind === 'mention') return `[@${part.label}](lorekit://entity/${encodeURIComponent(part.entityTable)}/${encodeURIComponent(part.entityId)})`; let text = part.text; if (part.bold) text = `**${text}**`; if (part.italic) text = `*${text}*`; if (part.link) text = `[${text}](${part.link})`; return text; }).join(''); }
  private static headingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 { const level = Number(value); return Number.isInteger(level) && level >= 1 && level <= 6 ? level as 1 | 2 | 3 | 4 | 5 | 6 : 2; }
  private static listStyle(value: unknown): 'ordered' | 'unordered' | 'checklist' { return value === 'ordered' || value === 'checklist' ? value : 'unordered'; }
  private static positiveNumber(value: unknown): number { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 1; }
  private static record(value: unknown): Record<string, unknown> { return this.isRecord(value) ? value : {}; }
  private static isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
  private static string(value: unknown): string { return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''; }
  private static escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char); }
  private static escapeAttr(value: string): string { return this.escapeHtml(value); }
  private static escapePipes(value: string): string { return value.replace(/\|/g, '\\|'); }
}
