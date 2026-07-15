import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, output, ViewEncapsulation } from '@angular/core';

import EditorJS from '@editorjs/editorjs';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';
import TailwindColor from '../../plugins/tailwindcolor.plugin';
import TailwindMarker from '../../plugins/tailwindmarker.plugin';

import TailwindHeader from '../../plugins/tailwindheader.plugin';
import TailwindBold from '../../plugins/tailwindbold.plugin';
import TailwindItalic from '../../plugins/tailwinditalic.plugin';
import TailwindImage from '../../plugins/tailwindimage.plugin';
import TailwindMentionPlugin from '../../plugins/tailwindmention.plugin';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { GlobalParameterService } from '../../services/global-parameter.service';
import { ImageService } from '../../services/image.service';
import { EntityMentionService } from '../../services/entity-mention.service';

@Component({
  selector: 'app-editor',
  imports: [IconButtonComponent],
  template: `
    <div class="relative">
      <app-icon-button class="absolute right-0" (click)="exportContent()" buttonType="white" size="xs" icon="fa-solid fa-download" title="Exportar"></app-icon-button>
      <div [id]="editorId" class="rounded-lg p-4 dark-theme" spellcheck="false"></div>
    </div>
  `,
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated
})
export class EditorComponent implements AfterViewInit, OnDestroy{
  editor!: EditorJS;
  private lastSaveTime = 0;
  private mentionPlugin: TailwindMentionPlugin | null = null;

  document = input('');
  saveDocument = output<any>();
  entityTable = input.required<string>();
  entityId = input.required<string>();
  entityName = input.required<string>();
  docTitle = input<string>();

  globalParameterService = inject<GlobalParameterService>(GlobalParameterService);
  imageService = inject<ImageService>(ImageService);
  entityMentionService = inject<EntityMentionService>(EntityMentionService);

  exportFormat = computed(() => {
    const format = this.globalParameterService.getParameter('exportTextFormat');
    return format === 'md' || format === 'txt' ? format : 'txt';
  });

  editorId = 'editorjs' + Math.floor(Math.random() * 1000000);

  constructor() {
  }

  ngAfterViewInit() {
    this.editor = new EditorJS({
      holder: this.editorId,
      placeholder: 'Comece a escrever aqui, use "/" para comandos...',
      autofocus: true,
      inlineToolbar: ['bold', 'italic', 'color', 'marker'],
      onChange: () => {
        this.handleChange();
      },
      tools: {
        header: {
          class: TailwindHeader,
          config: {
            placeholder: 'Digite seu cabeçalho...',
            levels: [1, 2, 3],
            defaultLevel: 2
          }
        },
        list: {
          class: List,
          inlineToolbar: ['bold', 'italic', 'color', 'marker'],
        },
        quote: {
          class: Quote,
          inlineToolbar: ['bold', 'italic', 'color', 'marker'],
        },
        table: {
          class: Table as any,
          inlineToolbar: true,
          config: {
            withHeadings: true
          }
        },
        bold: {
          class: TailwindBold,
          shortcut: 'CMD+B',
        },
        italic: {
          class: TailwindItalic,
          shortcut: 'CMD+I',
        },
        color: {
          class: TailwindColor,
        },
        marker: {
          class: TailwindMarker,
        },
        image: {
          class: TailwindImage,
          config: {
            captionPlaceholder: 'Legenda da imagem...',
            uploader: async (file: File) => {
              try {
                const usageKey = `editor_${Date.now()}`;
                const image = await this.imageService.uploadImage(
                  file,
                  this.entityTable(),
                  this.entityId(),
                  usageKey
                );
                return {
                  success: 1,
                  file: {
                    url: image.filePath
                  }
                };
              } catch (error) {
                console.error('Erro ao fazer upload:', error);
                return {
                  success: 0
                };
              }
            }
          }
        }
      },
      data: this.parseDocument(this.document()),
    });

    this.editor.isReady
      .then(() => {
        this.disableSpellcheck();
        this.initMentionPlugin();
      })
      .catch((error) => {
        console.error('Erro ao iniciar editor:', error);
      });
  }

  private initMentionPlugin() {
    this.mentionPlugin = new TailwindMentionPlugin({
      holderId: this.editorId,
      minChars: 1,
      maxResults: 8,
      search: async (term, limit) => {
        return this.entityMentionService.search(term, limit);
      },
      onMentionClick: async (mention) => {
        const parsed = this.entityMentionService.parseMentionHref(mention.href);
        if (parsed) {
          await this.entityMentionService.openMentionEditor({
            entityTable: parsed.table,
            entityId: parsed.id,
          });
        }
      }
    });

    this.mentionPlugin.init();
  }

  private disableSpellcheck() {
    const holder = document.getElementById(this.editorId);
    if (!holder) return;

    holder.setAttribute('spellcheck', 'false');
    holder.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      el.setAttribute('spellcheck', 'false');
    });
  }

  private async handleChange() {
    await this.saveContent();
  }

  private parseDocument(document: string) {
    try {
      return document ? JSON.parse(document) : {};
    } catch {
      if (document && document.trim().length > 0) {
        return {
          blocks: [
            {
              type: 'paragraph',
              data: {
                text: document.replace(/\n/g, '<br>')
              }
            }
          ]
        };
      }
      return {};
    }
  }

  private async loadDocument(documentContent: string) {
    if (!this.editor) return;

    try {
      await this.editor.isReady;
      await this.editor.render(this.parseDocument(documentContent));
    } catch (error) {
      console.error('Erro ao carregar documento no editor:', error);
    }
  }

  private async saveContent() {
    try {
      const savedData = await this.editor.save();
      this.lastSaveTime = Date.now();
      this.saveDocument.emit(savedData);
    } catch (error) {
      this.lastSaveTime = 0;
    }
  }

  async ngOnDestroy() {
    if (this.mentionPlugin) {
      this.mentionPlugin.destroy();
      this.mentionPlugin = null;
    }

    if (this.editor) {
      await this.saveContent();
      this.editor.destroy();
    }
  }

  async exportContent() {
    if (!this.editor) return;
    const data = await this.editor.save();

    const format = this.exportFormat;
    const text = format() === 'md'
      ? this.blocksToMarkdown(data.blocks || [])
      : this.blocksToPlainText(data.blocks || []);

    const fileNameBase = (`${this.entityTable()}_${this.entityName()}_${this.docTitle() ?? ''}`).replace(/[\\/:*?"<>|]+/g, '_');
    const ext = format();
    this.downloadFile(`${fileNameBase}.${ext}`, text, format() === 'md' ? 'text/markdown' : 'text/plain');
  }

  private downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private htmlToText(html: string): string {
    const el = document.createElement('div');
    el.innerHTML = html ?? '';
    el.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
    el.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote').forEach(node => {
      if (node.nextSibling) {
        node.after(document.createTextNode('\n'));
      }
    });
    return (el.textContent || el.innerText || '').replace(/\u00A0/g, ' ').trim();
  }

  private htmlInlineToMarkdown(html: string): string {
    if (!html) return '';
    let s = html;

    s = s.replace(/<br\s*\/?>/gi, '  \n');
    s = s.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (m, href, text) => {
      return `[${this.htmlToText(text)}](${href})`;
    });
    s = s.replace(/<(strong|b)>(.*?)<\/\1>/gi, (m, _tag, inner) => `**${this.htmlToText(inner)}**`);
    s = s.replace(/<(em|i)>(.*?)<\/\1>/gi, (m, _tag, inner) => `*${this.htmlToText(inner)}*`);
    s = s.replace(/<code>(.*?)<\/code>/gi, (m, inner) => `\`${this.htmlToText(inner)}\``);
    s = this.htmlToText(s);

    return s;
  }

  private escapeMdPipes(text: string): string {
    return text.replace(/\|/g, '\\|');
  }

  private stringifyEditorValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const url = record['url'];
      if (typeof url === 'string') return url;
    }

    return '';
  }

  private getBlockData(block: any): Record<string, unknown> {
    return block?.data && typeof block.data === 'object' ? block.data : {};
  }

  private getFirstTextField(data: Record<string, unknown>, fields: string[]): string {
    for (const field of fields) {
      const text = this.stringifyEditorValue(data[field]);
      if (text.trim()) return text;
    }

    return '';
  }

  private getImageUrl(data: Record<string, unknown>): string {
    const directUrl = this.stringifyEditorValue(data['url']);
    if (directUrl.trim()) return directUrl;

    const file = data['file'];
    if (file && typeof file === 'object') {
      return this.stringifyEditorValue((file as Record<string, unknown>)['url']);
    }

    return '';
  }

  private getTableRows(data: Record<string, unknown>): unknown[][] {
    const content = data['content'];
    if (!Array.isArray(content)) return [];

    return content
      .filter((row): row is unknown[] => Array.isArray(row))
      .map(row => row);
  }

  private getListContent(item: unknown): string {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return '';

    const record = item as Record<string, unknown>;
    return this.getFirstTextField(record, ['content', 'text', 'caption']);
  }

  private getListChildren(item: unknown): unknown[] {
    if (!item || typeof item !== 'object') return [];
    const children = (item as Record<string, unknown>)['items'];
    return Array.isArray(children) ? children : [];
  }

  private isCheckedListItem(item: unknown): boolean {
    if (!item || typeof item !== 'object') return false;

    const meta = (item as Record<string, unknown>)['meta'];
    if (!meta || typeof meta !== 'object') return false;

    return (meta as Record<string, unknown>)['checked'] === true;
  }

  private getListStart(data: Record<string, unknown>): number {
    const meta = data['meta'];
    if (!meta || typeof meta !== 'object') return 1;

    const start = Number((meta as Record<string, unknown>)['start']);
    return Number.isFinite(start) && start > 0 ? start : 1;
  }

  private listItemsToMarkdown(items: unknown, style: string, depth = 0, start = 1): string[] {
    if (!Array.isArray(items)) return [];

    const lines: string[] = [];
    let orderedIndex = start;

    for (const item of items) {
      const content = this.htmlInlineToMarkdown(this.getListContent(item));
      const indent = '  '.repeat(depth);

      if (content) {
        if (style === 'ordered') {
          lines.push(`${indent}${orderedIndex}. ${content}`);
        } else if (style === 'checklist') {
          lines.push(`${indent}- [${this.isCheckedListItem(item) ? 'x' : ' '}] ${content}`);
        } else {
          lines.push(`${indent}- ${content}`);
        }
      }

      lines.push(...this.listItemsToMarkdown(this.getListChildren(item), style, depth + 1));
      orderedIndex++;
    }

    return lines;
  }

  private listItemsToPlainText(items: unknown, style: string, depth = 0, start = 1): string[] {
    if (!Array.isArray(items)) return [];

    const lines: string[] = [];
    let orderedIndex = start;

    for (const item of items) {
      const content = this.htmlToText(this.getListContent(item));
      const indent = '  '.repeat(depth);

      if (content) {
        if (style === 'ordered') {
          lines.push(`${indent}${orderedIndex}. ${content}`);
        } else if (style === 'checklist') {
          lines.push(`${indent}[${this.isCheckedListItem(item) ? 'x' : ' '}] ${content}`);
        } else {
          lines.push(`${indent}- ${content}`);
        }
      }

      lines.push(...this.listItemsToPlainText(this.getListChildren(item), style, depth + 1));
      orderedIndex++;
    }

    return lines;
  }

  private getPlainTextFromData(data: Record<string, unknown>): string {
    return this.htmlToText(this.getFirstTextField(data, ['text', 'content', 'caption', 'title', 'name', 'message']));
  }

  private getMarkdownFromData(data: Record<string, unknown>): string {
    return this.htmlInlineToMarkdown(this.getFirstTextField(data, ['text', 'content', 'caption', 'title', 'name', 'message']));
  }

  private blocksToMarkdown(blocks: any[]): string {
    const out: string[] = [];

    for (const b of blocks) {
      const data = this.getBlockData(b);

      switch (b.type) {
        case 'header': {
          const level = Math.min(Math.max(Number(data['level'] ?? 2), 1), 6);
          const t = this.getMarkdownFromData(data);
          if (t) out.push(`${'#'.repeat(level)} ${t}`, '');
          break;
        }
        case 'paragraph': {
          const t = this.getMarkdownFromData(data);
          if (t) out.push(t, '');
          break;
        }
        case 'list': {
          const style = String(data['style'] ?? 'unordered');
          const lines = this.listItemsToMarkdown(data['items'], style, 0, this.getListStart(data));
          if (lines.length) out.push(...lines, '');
          break;
        }
        case 'quote': {
          const t = this.htmlInlineToMarkdown(this.stringifyEditorValue(data['text']));
          if (t) {
            t.split('\n').forEach(line => out.push(`> ${line}`));
          }
          const caption = this.htmlInlineToMarkdown(this.stringifyEditorValue(data['caption']));
          if (caption) {
            out.push(`> - ${caption}`);
          }
          if (t || caption) out.push('');
          break;
        }
        case 'table': {
          const rows = this.getTableRows(data);
          if (rows.length) {
            const header = rows[0].map(c => this.escapeMdPipes(this.htmlToText(this.stringifyEditorValue(c)))).join(' | ');
            out.push(`| ${header} |`);
            const sep = rows[0].map(() => '---').join(' | ');
            out.push(`| ${sep} |`);
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r].map(c => this.escapeMdPipes(this.htmlToText(this.stringifyEditorValue(c)))).join(' | ');
              out.push(`| ${row} |`);
            }
            out.push('');
          }
          break;
        }
        case 'image': {
          const url = this.getImageUrl(data);
          const caption = this.htmlToText(this.stringifyEditorValue(data['caption']));
          if (url) {
            out.push(`![${caption}](${url})`, '');
          } else if (caption) {
            out.push(caption, '');
          }
          break;
        }
        default: {
          const raw = this.getMarkdownFromData(data);
          if (raw) out.push(raw, '');
          break;
        }
      }
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  private blocksToPlainText(blocks: any[]): string {
    const lines: string[] = [];

    for (const b of blocks) {
      const data = this.getBlockData(b);

      switch (b.type) {
        case 'header': {
          const t = this.getPlainTextFromData(data);
          if (t) lines.push(t, '');
          break;
        }
        case 'paragraph': {
          const t = this.getPlainTextFromData(data);
          if (t) lines.push(t, '');
          break;
        }
        case 'list': {
          const style = String(data['style'] ?? 'unordered');
          const listLines = this.listItemsToPlainText(data['items'], style, 0, this.getListStart(data));
          if (listLines.length) lines.push(...listLines, '');
          break;
        }
        case 'quote': {
          const t = this.htmlToText(this.stringifyEditorValue(data['text']));
          if (t) {
            t.split('\n').forEach(line => lines.push(`> ${line}`));
          }
          const caption = this.htmlToText(this.stringifyEditorValue(data['caption']));
          if (caption) {
            lines.push(`- ${caption}`);
          }
          if (t || caption) lines.push('');
          break;
        }
        case 'table': {
          const rows = this.getTableRows(data);
          rows.forEach((row: unknown[]) => {
            const cols = row.map(cell => this.htmlToText(this.stringifyEditorValue(cell)));
            lines.push(cols.join('\t'));
          });
          if (rows.length) lines.push('');
          break;
        }
        case 'image': {
          const caption = this.htmlToText(this.stringifyEditorValue(data['caption']));
          const url = this.getImageUrl(data);
          if (caption) {
            lines.push(`[Imagem: ${caption}]`);
          } else if (url) {
            lines.push(`[Imagem: ${url}]`);
          }
          lines.push('');
          break;
        }
        default: {
          const raw = this.getPlainTextFromData(data);
          if (raw) lines.push(raw, '');
          break;
        }
      }
    }

    return lines.join('\n').replace(/\s+$/g, '').trimEnd() + '\n';
  }
}
