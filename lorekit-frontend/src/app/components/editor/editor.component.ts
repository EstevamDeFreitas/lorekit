import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, output, signal, ViewEncapsulation } from '@angular/core';

import EditorJS from '@editorjs/editorjs';
import { Editor } from '@tiptap/core';
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
import { LorekitDocument, LorekitTextAlign } from '../../models/lorekit-document.model';
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
import { TiptapAdapter } from './tiptap.adapter';
import { createTiptapExtensions } from './tiptap.extensions';
import { MOODBOARD_ACCENT_PALETTE, MOODBOARD_FILL_PALETTE } from '../../theme/moodboard-color-palette';

type TextStyleSnapshot = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string | null;
  backgroundColor: string | null;
  fontSize: string | null;
};

@Component({
  selector: 'app-editor',
  imports: [IconButtonComponent],
  template: `
    <div class="relative">
      <app-icon-button class="absolute right-0" (click)="exportContent()" buttonType="white" size="xs" icon="fa-solid fa-download" title="Exportar"></app-icon-button>
       @if (isTiptap) {
          <div class="tiptap-shell scrollbar-dark">
          <div [id]="tiptapToolbarId" class="tiptap-toolbar" [class.tiptap-toolbar--expanded]="toolbarExpanded()" role="toolbar" aria-label="Ferramentas de texto">
           <div class="tiptap-toolbar-group">
             <select class="tiptap-toolbar-select" aria-label="Estilo do parágrafo" (change)="changeTextStyle($event)">
               <option value="paragraph">Texto normal</option><option value="1">Título 1</option><option value="2">Título 2</option><option value="3">Título 3</option>
             </select>
           </div>
           <div class="tiptap-toolbar-divider"></div>
           <div class="tiptap-toolbar-group">
             <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('bold')" (click)="toggleBold()" title="Negrito"><i class="fa-solid fa-bold"></i></button>
             <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('italic')" (click)="toggleItalic()" title="Itálico"><i class="fa-solid fa-italic"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('underline')" (click)="toggleUnderline()" title="Sublinhado"><i class="fa-solid fa-underline"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('strike')" (click)="toggleStrike()" title="Riscado"><i class="fa-solid fa-strikethrough"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="styleToPaste()" (click)="copyTextStyle()" [title]="styleToPaste() ? 'Clique no texto para colar o estilo' : 'Copiar estilo'"><i class="fa-solid fa-paintbrush"></i></button>
            </div>
            <button type="button" class="tiptap-toolbar-button tiptap-toolbar-more" [class.tiptap-toolbar-button--active]="toolbarExpanded()" (click)="toggleToolbarExpanded()" [title]="toolbarExpanded() ? 'Recolher ferramentas' : 'Mais ferramentas'"><i class="fa-solid fa-ellipsis"></i></button>
           <div class="tiptap-toolbar-divider tiptap-toolbar-optional"></div>
           <div class="tiptap-toolbar-group tiptap-toolbar-optional tiptap-color-control">
             <button type="button" class="tiptap-toolbar-button tiptap-toolbar-color-button" [class.tiptap-toolbar-button--active]="colorPickerOpen()" (click)="toggleColorPicker($event)" title="Cor do texto">
               <i class="fa-solid fa-font"></i><span [style.background-color]="textColor()"></span>
             </button>
             @if (colorPickerOpen()) {
               <div class="tiptap-color-picker" (click)="$event.stopPropagation()">
                 <div class="tiptap-color-picker-section"><span>Tons</span><div class="tiptap-color-grid">@for (color of moodboardFillPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === textColor()" [attr.aria-label]="'Cor ' + color" (click)="setColor(color)"></button> }</div></div>
                 <div class="tiptap-color-picker-section"><span>Cores</span><div class="tiptap-color-grid"><button type="button" class="tiptap-color-swatch" style="background-color: #ffffff" [class.tiptap-color-swatch--selected]="textColor() === '#ffffff'" aria-label="Texto branco" (click)="setColor('#ffffff')"></button>@for (color of moodboardAccentPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === textColor()" [attr.aria-label]="'Cor ' + color" (click)="setColor(color)"></button> }</div></div>
                 <label class="tiptap-custom-color"><span>Cor personalizada</span><input #customTextColor type="color" [value]="textColor()" (change)="setColor(customTextColor.value)"></label>
                  <button type="button" class="tiptap-color-clear" (click)="clearTextColor()">Limpar cor do texto</button>
                </div>
             }
             <button type="button" class="tiptap-toolbar-button tiptap-toolbar-color-button" [class.tiptap-toolbar-button--active]="backgroundPickerOpen()" (click)="toggleBackgroundPicker($event)" title="Cor de fundo"><i class="fa-solid fa-fill-drip"></i><span [style.background-color]="backgroundColor()"></span></button>
             @if (backgroundPickerOpen()) { <div class="tiptap-color-picker" (click)="$event.stopPropagation()"><div class="tiptap-color-picker-section"><span>Tons</span><div class="tiptap-color-grid">@for (color of moodboardFillPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === backgroundColor()" [attr.aria-label]="'Cor de fundo ' + color" (click)="setBackgroundColor(color)"></button> }</div></div><div class="tiptap-color-picker-section"><span>Cores</span><div class="tiptap-color-grid">@for (color of moodboardAccentPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === backgroundColor()" [attr.aria-label]="'Cor de fundo ' + color" (click)="setBackgroundColor(color)"></button> }</div></div><label class="tiptap-custom-color"><span>Cor personalizada</span><input #customBackgroundColor type="color" [value]="backgroundColor()" (change)="setBackgroundColor(customBackgroundColor.value)"></label><button type="button" class="tiptap-color-clear" (click)="clearBackgroundColor()">Limpar cor de fundo</button></div> }
             <button type="button" class="tiptap-toolbar-button" (click)="clearBackgroundColor()" title="Limpar cor de fundo"><i class="fa-solid fa-eraser"></i></button>
             <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('link')" (click)="setLink()" title="Link"><i class="fa-solid fa-link"></i></button>
           </div>
           <div class="tiptap-toolbar-divider tiptap-toolbar-optional"></div>
            <div class="tiptap-toolbar-group tiptap-toolbar-optional">
            <div class="tiptap-toolbar-group">
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isTextAligned('left')" (click)="setTextAlignment('left')" title="Alinhar à esquerda"><i class="fa-solid fa-align-left"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isTextAligned('center')" (click)="setTextAlignment('center')" title="Centralizar"><i class="fa-solid fa-align-center"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isTextAligned('right')" (click)="setTextAlignment('right')" title="Alinhar à direita"><i class="fa-solid fa-align-right"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isTextAligned('justify')" (click)="setTextAlignment('justify')" title="Justificar"><i class="fa-solid fa-align-justify"></i></button>
            </div>
            <div class="tiptap-toolbar-divider"></div>
            <label class="tiptap-font-size" title="Tamanho da fonte"><i class="fa-solid fa-text-height"></i><input type="number" min="8" max="96" step="1" [value]="fontSize()" (change)="setFontSize($event)"><span>px</span></label>
            <button type="button" class="tiptap-toolbar-button" (click)="decreaseIndent()" title="Diminuir recuo"><i class="fa-solid fa-outdent"></i></button>
            <button type="button" class="tiptap-toolbar-button" (click)="increaseIndent()" title="Aumentar recuo"><i class="fa-solid fa-indent"></i></button>
            <div class="tiptap-toolbar-divider"></div>
             <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('bulletList')" (click)="toggleBulletList()" title="Lista com marcadores"><i class="fa-solid fa-list-ul"></i></button>
             <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('orderedList')" (click)="toggleOrderedList()" title="Lista numerada"><i class="fa-solid fa-list-ol"></i></button>
             <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('taskList')" (click)="toggleTaskList()" title="Checklist"><i class="fa-solid fa-list-check"></i></button>
           </div>
           <div class="tiptap-toolbar-divider tiptap-toolbar-optional"></div>
           <div class="tiptap-toolbar-group tiptap-toolbar-optional">
             <button type="button" class="tiptap-toolbar-button" (click)="insertQuote()" title="Citação"><i class="fa-solid fa-quote-left"></i></button>
             <button type="button" class="tiptap-toolbar-button" (click)="insertTable()" title="Tabela"><i class="fa-solid fa-table"></i></button>
             <label class="tiptap-toolbar-button tiptap-upload" title="Inserir imagem"><i class="fa-solid fa-image"></i><input type="file" accept="image/*" (change)="addImage($event)"></label>
           </div>
         </div>
         <div [id]="tiptapId" class="tiptap-editor rounded-lg p-4 dark-theme" spellcheck="false" (click)="handleTiptapClick($event)"></div>
          </div>
          @if (selectionTooltip()) {
            <div class="tiptap-selection-tooltip" [style.left.px]="selectionTooltip()?.left" [style.top.px]="selectionTooltip()?.top" role="toolbar" aria-label="Formatação da seleção">
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('bold')" (mousedown)="preserveSelection($event)" (click)="toggleBold()" title="Negrito"><i class="fa-solid fa-bold"></i></button>
              <button type="button" class="tiptap-toolbar-button" [class.tiptap-toolbar-button--active]="isActive('italic')" (mousedown)="preserveSelection($event)" (click)="toggleItalic()" title="Itálico"><i class="fa-solid fa-italic"></i></button>
              <div class="tiptap-selection-color-control">
                <button type="button" class="tiptap-selection-color" [class.tiptap-toolbar-button--active]="selectionTextColorPickerOpen()" (mousedown)="preserveSelection($event)" (click)="toggleSelectionTextColorPicker($event)" title="Cor do texto"><i class="fa-solid fa-font"></i></button>
                @if (selectionTextColorPickerOpen()) {
                  <div class="tiptap-color-picker tiptap-selection-color-picker" (click)="$event.stopPropagation()">
                    <div class="tiptap-color-picker-section"><span>Tons</span><div class="tiptap-color-grid">@for (color of moodboardFillPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === textColor()" [attr.aria-label]="'Cor ' + color" (mousedown)="preserveSelection($event)" (click)="setColor(color)"></button> }</div></div>
                    <div class="tiptap-color-picker-section"><span>Cores</span><div class="tiptap-color-grid"><button type="button" class="tiptap-color-swatch" style="background-color: #ffffff" [class.tiptap-color-swatch--selected]="textColor() === '#ffffff'" aria-label="Texto branco" (mousedown)="preserveSelection($event)" (click)="setColor('#ffffff')"></button>@for (color of moodboardAccentPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === textColor()" [attr.aria-label]="'Cor ' + color" (mousedown)="preserveSelection($event)" (click)="setColor(color)"></button> }</div></div>
                    <label class="tiptap-custom-color"><span>Cor personalizada</span><input #contextTextColor type="color" [value]="textColor()" (change)="setColor(contextTextColor.value)"></label>
                    <button type="button" class="tiptap-color-clear" (mousedown)="preserveSelection($event)" (click)="clearTextColor()">Limpar cor do texto</button>
                  </div>
                }
              </div>
              <div class="tiptap-selection-color-control">
                <button type="button" class="tiptap-selection-color" [class.tiptap-toolbar-button--active]="selectionBackgroundPickerOpen()" (mousedown)="preserveSelection($event)" (click)="toggleSelectionBackgroundPicker($event)" title="Cor do fundo"><i class="fa-solid fa-fill-drip"></i></button>
                @if (selectionBackgroundPickerOpen()) {
                  <div class="tiptap-color-picker tiptap-selection-color-picker" (click)="$event.stopPropagation()">
                    <div class="tiptap-color-picker-section"><span>Tons</span><div class="tiptap-color-grid">@for (color of moodboardFillPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === backgroundColor()" [attr.aria-label]="'Cor de fundo ' + color" (mousedown)="preserveSelection($event)" (click)="setBackgroundColor(color)"></button> }</div></div>
                    <div class="tiptap-color-picker-section"><span>Cores</span><div class="tiptap-color-grid">@for (color of moodboardAccentPalette; track color) { <button type="button" class="tiptap-color-swatch" [style.background-color]="color" [class.tiptap-color-swatch--selected]="color === backgroundColor()" [attr.aria-label]="'Cor de fundo ' + color" (mousedown)="preserveSelection($event)" (click)="setBackgroundColor(color)"></button> }</div></div>
                    <label class="tiptap-custom-color"><span>Cor personalizada</span><input #contextBackgroundColor type="color" [value]="backgroundColor()" (change)="setBackgroundColor(contextBackgroundColor.value)"></label>
                    <button type="button" class="tiptap-color-clear" (mousedown)="preserveSelection($event)" (click)="clearBackgroundColor()">Limpar cor de fundo</button>
                  </div>
                }
              </div>
              <span class="tiptap-toolbar-divider"></span>
              <button type="button" class="tiptap-toolbar-button" (mousedown)="preserveSelection($event)" (click)="setTextAlignment('left')" title="Alinhar à esquerda"><i class="fa-solid fa-align-left"></i></button>
              <button type="button" class="tiptap-toolbar-button" (mousedown)="preserveSelection($event)" (click)="setTextAlignment('center')" title="Centralizar"><i class="fa-solid fa-align-center"></i></button>
              <button type="button" class="tiptap-toolbar-button" (mousedown)="preserveSelection($event)" (click)="setTextAlignment('right')" title="Alinhar à direita"><i class="fa-solid fa-align-right"></i></button>
              <button type="button" class="tiptap-toolbar-button" (mousedown)="preserveSelection($event)" (click)="setTextAlignment('justify')" title="Justificar"><i class="fa-solid fa-align-justify"></i></button>
              <label class="tiptap-font-size" title="Tamanho da fonte"><i class="fa-solid fa-text-height"></i><input type="number" min="8" max="96" step="1" [value]="fontSize()" (change)="setFontSize($event)"><span>px</span></label>
              <span class="tiptap-toolbar-divider"></span>
              <button type="button" class="tiptap-toolbar-button" (mousedown)="preserveSelection($event)" (click)="insertQuote()" title="Inserir citação"><i class="fa-solid fa-quote-left"></i></button>
              <button type="button" class="tiptap-toolbar-button" (mousedown)="preserveSelection($event)" (click)="insertTable()" title="Inserir tabela"><i class="fa-solid fa-table"></i></button>
              <label class="tiptap-toolbar-button tiptap-upload" title="Inserir imagem"><i class="fa-solid fa-image"></i><input type="file" accept="image/*" (change)="addImage($event)"></label>
            </div>
       }
        }
      @else {
        <div [id]="editorId" class="rounded-lg p-4 dark-theme" spellcheck="false"></div>
      }
    </div>
  `,
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated
})
export class EditorComponent implements AfterViewInit, OnDestroy{
  editor!: EditorJS;
  private lastSaveTime = 0;
  tiptap: Editor | null = null;
  private changeRevision = 0;
  private savedRevision = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDelayMs = 600;
  private discardPendingSaveOnDestroy = false;
  private mentionPlugin: TailwindMentionPlugin | null = null;
  private readonly onFlushPendingSaves = (event: Event): void => {
    const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
    if (detail && this.isTiptap && this.tiptap && this.hasPendingChanges()) {
      detail.flushes.push(this.saveContent());
      return;
    }
    if (detail && !this.isTiptap && this.editor && this.hasPendingChanges()) {
      detail.flushes.push(this.saveContent());
    }
  };
  private readonly onDiscardPendingSaves = (): void => {
    this.discardPendingSaveOnDestroy = true;
    this.cancelScheduledSave();
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
  tiptapId = 'tiptap' + Math.floor(Math.random() * 1000000);
  tiptapToolbarId = 'tiptap-toolbar' + Math.floor(Math.random() * 1000000);
  readonly isTiptap = this.globalParameterService.getParameter('textEditorEngine') === 'tiptap';
  private readonly tiptapAdapter = new TiptapAdapter();
  readonly backgroundPickerOpen = signal(false);
  readonly backgroundColor = signal('#ffffff');
  readonly fontSize = signal(16);
  readonly toolbarExpanded = signal(false);
  readonly styleToPaste = signal<TextStyleSnapshot | null>(null);
  readonly moodboardFillPalette = MOODBOARD_FILL_PALETTE;
  readonly moodboardAccentPalette = MOODBOARD_ACCENT_PALETTE;
  readonly colorPickerOpen = signal(false);
  readonly textColor = signal('#fde047');
  readonly selectionTooltip = signal<{ left: number; top: number } | null>(null);
  readonly selectionTextColorPickerOpen = signal(false);
  readonly selectionBackgroundPickerOpen = signal(false);

  editorId = 'editorjs' + Math.floor(Math.random() * 1000000);
  private readonly editorAdapter = new EditorJsAdapter();
  private toolbarResizeObserver: ResizeObserver | null = null;
  private toolbarLayoutFrame = 0;

  constructor() {
  }

  ngAfterViewInit() {
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
    window.addEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);
    if (this.isTiptap) {
      this.initTiptap();
      return;
    }
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

  private handleChange(): void {
    this.changeRevision++;
    this.scheduleSave();
  }

  private scheduleSave(): void {
    this.cancelScheduledSave();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.hasPendingChanges()) {
        void this.saveContent();
      }
    }, this.saveDelayMs);
  }

  private cancelScheduledSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
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
    this.cancelScheduledSave();
    const revision = this.changeRevision;
    if (this.isTiptap && this.tiptap) {
      const revision = this.changeRevision;
      try {
        this.lastSaveTime = Date.now();
        this.saveDocument.emit(this.tiptapAdapter.fromEditor(this.tiptap.getJSON()));
        this.savedRevision = Math.max(this.savedRevision, revision);
      } catch {
        this.lastSaveTime = 0;
      }
      return;
    }

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
    this.cancelScheduledSave();

    this.toolbarResizeObserver?.disconnect();
    cancelAnimationFrame(this.toolbarLayoutFrame);
    if (this.tiptap) {
      if (!this.discardPendingSaveOnDestroy && this.hasPendingChanges()) {
        await this.saveContent();
      }
      this.tiptap.destroy();
      return;
    }
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
    if (this.isTiptap && this.tiptap) {
      const document = this.tiptapAdapter.fromEditor(this.tiptap.getJSON());
      const format = this.exportFormat;
      const text = format() === 'md' ? LorekitDocumentCodec.toMarkdown(document) : LorekitDocumentCodec.toPlainText(document);
      const fileNameBase = (`${this.entityTable()}_${this.entityName()}_${this.docTitle() ?? ''}`).replace(/[\\/:*?"<>|]+/g, '_');
      const ext = format();
      this.downloadFile(`${fileNameBase}.${ext}`, text, format() === 'md' ? 'text/markdown' : 'text/plain');
      return;
    }

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

  private initTiptap(): void {
    const holder = document.getElementById(this.tiptapId);
    if (!holder) return;
    this.tiptap = new Editor({
      element: holder,
      extensions: createTiptapExtensions(this.entityMentionService),
      content: this.tiptapAdapter.toEditor(LorekitDocumentCodec.deserialize(this.document())),
      editorProps: {
        attributes: { class: 'tiptap-prosemirror', spellcheck: 'false' },
        handleKeyDown: (_view, event) => this.handleTiptapKeydown(event),
      },
      onUpdate: () => { this.syncToolbarFromSelection(); void this.handleChange(); },
      onSelectionUpdate: () => this.syncToolbarFromSelection(),
    });
    this.syncToolbarFromSelection();
    this.setupToolbarLayout();
  }

  private setupToolbarLayout(): void {
    const toolbar = document.getElementById(this.tiptapToolbarId);
    if (!toolbar || typeof ResizeObserver === 'undefined') return;
    this.toolbarResizeObserver = new ResizeObserver(() => this.queueToolbarLayout());
    this.toolbarResizeObserver.observe(toolbar);
    this.queueToolbarLayout();
  }

  private queueToolbarLayout(): void {
    cancelAnimationFrame(this.toolbarLayoutFrame);
    this.toolbarLayoutFrame = requestAnimationFrame(() => this.layoutToolbar());
  }

  private layoutToolbar(): void {
    const toolbar = document.getElementById(this.tiptapToolbarId);
    if (!toolbar) return;
    const optional = [...toolbar.querySelectorAll<HTMLElement>('.tiptap-toolbar-optional')];
    const more = toolbar.querySelector<HTMLElement>('.tiptap-toolbar-more');
    optional.forEach(element => element.style.display = '');
    if (more) more.style.display = 'none';
    toolbar.style.flexWrap = 'nowrap';
    if (this.toolbarExpanded()) {
      toolbar.style.flexWrap = 'wrap';
      if (more) more.style.display = 'inline-flex';
      return;
    }
    while (toolbar.scrollWidth > toolbar.clientWidth && optional.some(element => element.style.display !== 'none')) {
      const candidate = optional.slice().reverse().find(element => element.style.display !== 'none');
      if (!candidate) break;
      candidate.style.display = 'none';
    }
    if (optional.some(element => element.style.display === 'none') && more) {
      more.style.display = 'inline-flex';
    }
    while (toolbar.scrollWidth > toolbar.clientWidth && optional.some(element => element.style.display !== 'none')) {
      const candidate = optional.slice().reverse().find(element => element.style.display !== 'none');
      if (!candidate) break;
      candidate.style.display = 'none';
    }
  }

  private run(command: (editor: Editor) => void): void { if (this.tiptap) command(this.tiptap); }
  isActive(name: string): boolean { return this.tiptap?.isActive(name) ?? false; }
  changeTextStyle(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.run(editor => {
      const chain = editor.chain().focus();
      if (value === 'paragraph') chain.setParagraph().run();
      else chain.setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
    });
  }
  toggleUnderline(): void { this.run(editor => { editor.chain().focus().toggleUnderline().run(); }); }
  toggleStrike(): void { this.run(editor => { editor.chain().focus().toggleStrike().run(); }); }
  toggleHeading(level: 1 | 2 | 3): void { this.run(editor => { editor.chain().focus().toggleHeading({ level }).run(); }); }
  toggleBold(): void { this.run(editor => { editor.chain().focus().toggleBold().run(); }); }
  toggleItalic(): void { this.run(editor => { editor.chain().focus().toggleItalic().run(); }); }
  toggleBulletList(): void { this.run(editor => { editor.chain().focus().toggleBulletList().run(); }); }
  toggleOrderedList(): void { this.run(editor => { editor.chain().focus().toggleOrderedList().run(); }); }
  toggleToolbarExpanded(): void {
    this.toolbarExpanded.update(expanded => !expanded);
    this.queueToolbarLayout();
  }
  toggleTaskList(): void { this.run(editor => { editor.chain().focus().toggleTaskList().run(); }); }
  insertTable(): void { this.run(editor => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run(); }); }
  insertQuote(): void { this.run(editor => { editor.chain().focus().insertContent({ type: 'lorekitQuote', attrs: { caption: [] }, content: [{ type: 'paragraph' }] }).run(); }); }
  toggleColorPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.colorPickerOpen.update(open => !open);
    this.backgroundPickerOpen.set(false);
  }
  toggleSelectionTextColorPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.selectionTextColorPickerOpen.update(open => !open);
    this.selectionBackgroundPickerOpen.set(false);
  }

  toggleSelectionBackgroundPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.selectionBackgroundPickerOpen.update(open => !open);
    this.selectionTextColorPickerOpen.set(false);
  }
  setColor(color: string): void {
    this.textColor.set(color);
    this.run(editor => { editor.chain().focus().setColor(color).run(); });
    this.colorPickerOpen.set(false);
    this.selectionTextColorPickerOpen.set(false);
  }
  clearTextColor(): void {
    this.run(editor => { editor.chain().focus().unsetColor().run(); });
    this.textColor.set('#ffffff');
    this.selectionTextColorPickerOpen.set(false);
  }
  toggleBackgroundPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.backgroundPickerOpen.update(open => !open);
    this.colorPickerOpen.set(false);
  }
  setBackgroundColor(color: string): void {
    this.backgroundColor.set(color);
    this.run(editor => { editor.chain().focus().setBackgroundColor(color).run(); });
    this.backgroundPickerOpen.set(false);
    this.selectionBackgroundPickerOpen.set(false);
  }
  clearBackgroundColor(): void {
    this.run(editor => { editor.chain().focus().unsetBackgroundColor().run(); });
    this.backgroundColor.set('#ffffff');
    this.backgroundPickerOpen.set(false);
    this.selectionBackgroundPickerOpen.set(false);
  }
  isTextAligned(alignment: LorekitTextAlign): boolean {
    return this.tiptap?.isActive('heading', { textAlign: alignment }) === true
      || this.tiptap?.isActive('paragraph', { textAlign: alignment }) === true;
  }
  setTextAlignment(alignment: LorekitTextAlign): void {
    this.run(editor => {
      const nodeType = editor.isActive('heading') ? 'heading' : 'paragraph';
      editor.chain().focus().updateAttributes(nodeType, { textAlign: alignment }).run();
    });
  }
  increaseIndent(): void { this.adjustIndent(1); }
  decreaseIndent(): void { this.adjustIndent(-1); }
  private handleTiptapKeydown(event: KeyboardEvent): boolean {
    if (event.key !== 'Tab') return false;
    this.adjustIndent(event.shiftKey ? -1 : 1);
    event.preventDefault();
    return true;
  }
  private adjustIndent(delta: 1 | -1): boolean {
    if (!this.tiptap) return false;
    const listItemType = this.tiptap.isActive('taskItem') ? 'taskItem' : this.tiptap.isActive('listItem') ? 'listItem' : null;
    if (listItemType) {
      return delta > 0
        ? this.tiptap.chain().focus().sinkListItem(listItemType).run()
        : this.tiptap.chain().focus().liftListItem(listItemType).run();
    }
    const nodeType = this.tiptap.isActive('heading') ? 'heading' : 'paragraph';
    const currentIndent = Number(this.tiptap.getAttributes(nodeType)['textIndent']) || 0;
    const nextIndent = Math.max(0, Math.min(currentIndent + delta, 8));
    if (nextIndent === currentIndent) return false;
    return this.tiptap.chain().focus().updateAttributes(nodeType, { textIndent: nextIndent }).run();
  }
  setFontSize(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 8 || value > 96) return;
    this.fontSize.set(value);
    this.run(editor => { editor.chain().focus().setFontSize(`${value}px`).run(); });
  }
  copyTextStyle(): void {
    if (!this.tiptap) return;
    const attributes = this.textStyleAttributes();
    this.styleToPaste.set({
      bold: this.tiptap.isActive('bold'),
      italic: this.tiptap.isActive('italic'),
      underline: this.tiptap.isActive('underline'),
      strike: this.tiptap.isActive('strike'),
      color: this.attributeColor(attributes['color']),
      backgroundColor: this.attributeColor(attributes['backgroundColor']),
      fontSize: this.attributeValue(attributes['fontSize']),
    });
  }

  private applyCopiedTextStyle(style: TextStyleSnapshot): void {
    this.run(editor => {
      const chain = editor.chain().focus();
      style.bold ? chain.setBold() : chain.unsetBold();
      style.italic ? chain.setItalic() : chain.unsetItalic();
      style.underline ? chain.setUnderline() : chain.unsetUnderline();
      style.strike ? chain.setStrike() : chain.unsetStrike();
      style.color ? chain.setColor(style.color) : chain.unsetColor();
      style.backgroundColor ? chain.setBackgroundColor(style.backgroundColor) : chain.unsetBackgroundColor();
      style.fontSize ? chain.setFontSize(style.fontSize) : chain.unsetFontSize();
      chain.run();
    });
  }

  private syncToolbarFromSelection(): void {
    const attributes = this.textStyleAttributes();
    this.textColor.set(this.attributeColor(attributes['color']) ?? '#ffffff');
    this.backgroundColor.set(this.attributeColor(attributes['backgroundColor']) ?? '#ffffff');
    const fontSize = Number.parseFloat(this.attributeValue(attributes['fontSize']) ?? '');
    if (Number.isFinite(fontSize)) this.fontSize.set(fontSize);
    this.syncSelectionTooltip();
  }

  private textStyleAttributes(): Record<string, unknown> {
    return this.tiptap?.getAttributes('textStyle') as Record<string, unknown> ?? {};
  }

  preserveSelection(event: MouseEvent): void {
    event.preventDefault();
  }

  private syncSelectionTooltip(): void {
    if (!this.tiptap) {
      this.selectionTooltip.set(null);
      return;
    }
    const { from, to } = this.tiptap.state.selection;
    const holder = document.getElementById(this.tiptapId);
    if (from === to || !holder) {
      this.selectionTooltip.set(null);
      return;
    }
    const start = this.tiptap.view.coordsAtPos(from);
    const end = this.tiptap.view.coordsAtPos(to);
    const center = (start.left + end.right) / 2;
    this.selectionTooltip.set({ left: Math.max(12, Math.min(center, window.innerWidth - 12)), top: Math.max(12, start.top - 8) });
  }

  private attributeColor(value: unknown): string | null {
    return typeof value === 'string' && value.length ? value : null;
  }

  private attributeValue(value: unknown): string | null {
    return typeof value === 'string' && value.length ? value : null;
  }

  setLink(): void {
    const href = window.prompt('Informe o endereço do link:')?.trim();
    if (href) this.run(editor => { editor.chain().focus().setLink({ href }).run(); });
  }

  async addImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.tiptap) return;
    try {
      const image = await this.imageService.uploadImage(file, this.entityTable(), this.entityId(), `editor_${Date.now()}`);
      this.tiptap.chain().focus().insertContent({
        type: 'lorekitImage',
        attrs: { url: this.imageService.referenceFor(image), caption: [], layout: { withBorder: false, withBackground: false, stretched: false, width: 'auto' } },
      }).run();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    }
  }

  async handleTiptapClick(event: MouseEvent): Promise<void> {
    const anchor = (event.target as HTMLElement | null)?.closest('a[data-mention="true"]') as HTMLAnchorElement | null;
    if (anchor) {
      event.preventDefault();
      const parsed = this.entityMentionService.parseMentionHref(anchor.href);
      if (parsed) await this.entityMentionService.openMentionEditor({ entityTable: parsed.table, entityId: parsed.id });
      return;
    }
    const style = this.styleToPaste();
    if (!style) return;
    this.applyCopiedTextStyle(style);
    this.styleToPaste.set(null);
  }

}
