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
import { LorekitDocument } from '../../models/lorekit-document.model';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { GlobalParameterService } from '../../services/global-parameter.service';
import { ImageService } from '../../services/image.service';
import { EntityMentionService } from '../../services/entity-mention.service';
import {
  DISCARD_PENDING_SAVES_EVENT,
  FLUSH_PENDING_SAVES_EVENT,
  PendingSaveEventDetail,
} from '../../utils/pending-save-event';
import { EditorJsAdapter, EditorJsOutputData } from './editor-js.adapter';
import { LorekitDocumentCodec } from './lorekit-document.codec';

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
  private changeRevision = 0;
  private savedRevision = 0;
  private discardPendingSaveOnDestroy = false;
  private mentionPlugin: TailwindMentionPlugin | null = null;
  private readonly onFlushPendingSaves = (event: Event): void => {
    const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
    if (detail && this.editor && this.hasPendingChanges()) {
      detail.flushes.push(this.saveContent());
    }
  };
  private readonly onDiscardPendingSaves = (): void => {
    this.discardPendingSaveOnDestroy = true;
  };
  private destroyed = false;

  document = input('');
  saveDocument = output<LorekitDocument>();
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
  private readonly editorAdapter = new EditorJsAdapter();

  constructor() {
  }

  ngAfterViewInit() {
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
    window.addEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);
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
                    url: this.imageService.referenceFor(image)
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
      data: this.parseDocument(this.document()) as never,
    });

    this.editor.isReady
      .then(() => {
        if (this.destroyed) return;
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
    this.changeRevision++;
    await this.saveContent();
  }

  private parseDocument(document: string): EditorJsOutputData {
    return this.editorAdapter.toEditor(LorekitDocumentCodec.deserialize(document));
  }

  private async loadDocument(documentContent: string) {
    if (!this.editor) return;

    try {
      await this.editor.isReady;
      await this.editor.render(this.parseDocument(documentContent) as never);
    } catch (error) {
      console.error('Erro ao carregar documento no editor:', error);
    }
  }

  private async saveContent() {
    const revision = this.changeRevision;
    try {
      const savedData = await this.editor.save();
      this.lastSaveTime = Date.now();
      this.saveDocument.emit(this.editorAdapter.fromEditor(savedData as unknown as EditorJsOutputData));
      this.savedRevision = Math.max(this.savedRevision, revision);
    } catch (error) {
      this.lastSaveTime = 0;
    }
  }

  private hasPendingChanges(): boolean {
    return this.changeRevision > this.savedRevision;
  }

  async ngOnDestroy() {
    this.destroyed = true;
    window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
    window.removeEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);

    if (this.mentionPlugin) {
      this.mentionPlugin.destroy();
      this.mentionPlugin = null;
    }

    if (this.editor) {
      if (!this.discardPendingSaveOnDestroy && this.hasPendingChanges()) {
        await this.saveContent();
      }
      this.editor.destroy();
    }
  }

  async exportContent() {
    if (!this.editor) return;
    const data = await this.editor.save();
    const document = this.editorAdapter.fromEditor(data as unknown as EditorJsOutputData);

    const format = this.exportFormat;
    const text = format() === 'md'
      ? LorekitDocumentCodec.toMarkdown(document)
      : LorekitDocumentCodec.toPlainText(document);

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

}
