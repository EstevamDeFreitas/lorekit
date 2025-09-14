import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, ViewEncapsulation } from '@angular/core';

import EditorJS from '@editorjs/editorjs';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';

import TailwindHeader from '../../plugins/tailwindheader.plugin';
import TailwindItalic from '../../plugins/tailwinditalic.plugin';

@Component({
  selector: 'app-document-editor',
  imports: [],
  template: `<div id="editorjs" class="rounded-lg p-4 dark-theme"></div>`,
  styleUrl: './document-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated
})
export class DocumentEditorComponent implements AfterViewInit, OnDestroy{
  editor!: EditorJS;

  ngAfterViewInit() {
    this.applyEditorStyles();
    this.editor = new EditorJS({
      holder: 'editorjs',
      placeholder: 'Comece a escrever aqui, use "/" para comandos...',
      autofocus: true,

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
      }
    });
  }

  private applyEditorStyles() {

  }

  ngOnDestroy() {
    this.editor.destroy();
  }

}
