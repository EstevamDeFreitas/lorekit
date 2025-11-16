import { AfterViewInit, ChangeDetectionStrategy, Component, effect, input, OnDestroy, output, ViewEncapsulation } from '@angular/core';

import EditorJS from '@editorjs/editorjs';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';

import TailwindHeader from '../../plugins/tailwindheader.plugin';
import TailwindItalic from '../../plugins/tailwinditalic.plugin';
import { IconButtonComponent } from '../icon-button/icon-button.component';

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
  private readonly SAVE_DELAY = 5000;

  document = input('');
  saveDocument = output<any>();
  entityTable = input.required<string>();
  entityName = input.required<string>();
  docTitle = input<string>();

  exportFormat = 'text';

  editorId = 'editorjs' + Math.floor(Math.random() * 1000000);

  constructor() {
  }

  ngAfterViewInit() {
    this.editor = new EditorJS({
      holder: this.editorId,
      placeholder: 'Comece a escrever aqui, use "/" para comandos...',
      autofocus: true,
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
        list: List,
        quote: Quote,
        table: {
          class: Table as any,
          inlineToolbar: true,
          config: {
            withHeadings: true
          }
        },
        italic: {
          class: TailwindItalic,
          shortcut: 'CMD+I',
        },
      },
      data: this.parseDocument(this.document()),
    });
    this.disableSpellcheck();
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
    const now = Date.now();

    await this.saveContent();
  }

  private parseDocument(document: string) {
    try {
      return document ? JSON.parse(document) : {};
    } catch {
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
    if (this.editor) {
      await this.saveContent();
      this.editor.destroy();
    }
  }

  async exportContent() {
    if (!this.editor) return;
    const data = await this.editor.save();

    const format = this.exportFormat;
    const text = format === 'md'
      ? this.blocksToMarkdown(data.blocks || [])
      : this.blocksToPlainText(data.blocks || []);

    const fileNameBase = (`${this.entityTable()}_${this.entityName()}_${this.docTitle() ?? ''}`).replace(/[\\/:*?"<>|]+/g, '_');
    const ext = format === 'md' ? 'md' : 'txt';
    this.downloadFile(`${fileNameBase}.${ext}`, text, format === 'md' ? 'text/markdown' : 'text/plain');
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
    el.querySelectorAll('br').forEach(br => (br.outerHTML = '\n'));
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

  private blocksToMarkdown(blocks: any[]): string {
    const out: string[] = [];

    const mdFromHtmlInline = (html: string) => this.htmlInlineToMarkdown(html);

    for (const b of blocks) {
      switch (b.type) {
        case 'header': {
          const level = Math.min(Math.max(b.data?.level ?? 2, 1), 6);
          const t = mdFromHtmlInline(b.data?.text ?? '');
          out.push(`${'#'.repeat(level)} ${t}`, '');
          break;
        }
        case 'paragraph': {
          const t = mdFromHtmlInline(b.data?.text ?? '');
          if (t) out.push(t, '');
          break;
        }
        case 'list': {
          const ordered = b.data?.style === 'ordered';
          const items: string[] = b.data?.items ?? [];
          items.forEach((item: string, idx: number) => {
            const t = mdFromHtmlInline(item);
            out.push(ordered ? `${idx + 1}. ${t}` : `- ${t}`);
          });
          out.push('');
          break;
        }
        case 'quote': {
          const t = mdFromHtmlInline(b.data?.text ?? '');
          t.split('\n').forEach(line => out.push(`> ${line}`));
          if (b.data?.caption) {
            out.push(`> — ${mdFromHtmlInline(b.data.caption)}`);
          }
          out.push('');
          break;
        }
        case 'table': {
          const rows: string[][] = b.data?.content ?? [];
          if (rows.length) {
            const header = rows[0].map(c => this.escapeMdPipes(this.htmlToText(c))).join(' | ');
            out.push(`| ${header} |`);
            const sep = rows[0].map(() => '---').join(' | ');
            out.push(`| ${sep} |`);
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r].map(c => this.escapeMdPipes(this.htmlToText(c))).join(' | ');
              out.push(`| ${row} |`);
            }
            out.push('');
          }
          break;
        }
        default: {
          const raw = mdFromHtmlInline(b.data?.text ?? '');
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
      switch (b.type) {
        case 'header': {
          const t = this.htmlToText(b.data?.text ?? '');
          lines.push(t);
          lines.push(''); // linha em branco após header
          break;
        }
        case 'paragraph': {
          const t = this.htmlToText(b.data?.text ?? '');
          if (t) lines.push(t);
          lines.push('');
          break;
        }
        case 'list': {
          const style = b.data?.style; // 'ordered' | 'unordered'
          const items: string[] = b.data?.items ?? [];
          items.forEach((item: string, idx: number) => {
            const t = this.htmlToText(item);
            if (style === 'ordered') {
              lines.push(`${idx + 1}. ${t}`);
            } else {
              lines.push(`- ${t}`);
            }
          });
          lines.push('');
          break;
        }
        case 'quote': {
          const t = this.htmlToText(b.data?.text ?? '');
          t.split('\n').forEach(line => lines.push(`> ${line}`));
          if (b.data?.caption) {
            lines.push(`— ${this.htmlToText(b.data.caption)}`);
          }
          lines.push('');
          break;
        }
        case 'table': {
          const rows: string[][] = b.data?.content ?? [];
          rows.forEach((row: string[]) => {
            const cols = row.map(cell => this.htmlToText(cell));
            lines.push(cols.join('\t'));
          });
          lines.push('');
          break;
        }
        default: {
          // fallback genérico
          const raw = b.data?.text ? this.htmlToText(b.data.text) : '';
          if (raw) lines.push(raw, '');
          break;
        }
      }
    }

    // remove espaços extras no final
    return lines.join('\n').replace(/\s+$/g, '').trimEnd() + '\n';
  }

}
