import { AfterViewInit, ChangeDetectionStrategy, Component, effect, input, OnDestroy, output, ViewEncapsulation } from '@angular/core';

import EditorJS from '@editorjs/editorjs';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';

import TailwindHeader from '../../plugins/tailwindheader.plugin';
import TailwindItalic from '../../plugins/tailwinditalic.plugin';

@Component({
  selector: 'app-editor',
  imports: [],
  template: `<div [id]="editorId" class="rounded-lg p-4 dark-theme"></div>`,
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

}
