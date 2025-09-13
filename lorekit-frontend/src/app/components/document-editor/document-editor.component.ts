import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, ViewEncapsulation } from '@angular/core';

import EditorJS from '@editorjs/editorjs';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';

import TailwindHeader from '../../plugins/tailwindheader.plugin';

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
      }
    });
  }

  private applyEditorStyles() {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      /* Remover borda em cabeçalhos selecionados */
      .ce-header-no-border.ce-block--selected {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
        background-color: rgba(255, 255, 255, 0.08) !important;
        border-radius: 4px !important;
      }

      /* Botões de configuração de cabeçalho */
      .ce-header-settings {
        display: flex;
        gap: 8px;
        padding: 6px;
      }

      .header-level-btn {
        padding: 4px 10px !important;
        border-radius: 4px !important;
        background-color: #333 !important;
        color: white !important;
        border: 1px solid #444 !important;
      }

      .header-level-btn:hover {
        background-color: #444 !important;
      }

      .header-level-btn.ce-settings__button--active {
        background-color: #0d6efd !important;
        border-color: #0d6efd !important;
      }

      /* Tema escuro para botões e menus */
      .ce-toolbar__plus {
        color: white !important;
        background-color: #2a2a2a !important;
      }
      .ce-toolbar__plus:hover {
        background-color: #3a3a3a !important;
      }
      .ce-toolbar__plus svg {
        fill: white !important;
      }

      /* Botão de configurações */
      .ce-toolbar__settings-btn {
        color: white !important;
        background-color: #2a2a2a !important;
      }
      .ce-toolbar__settings-btn:hover {
        background-color: #3a3a3a !important;
      }
      .ce-toolbar__settings-btn svg {
        fill: white !important;
      }

      /* Popups e toolbars */
      .ce-inline-toolbar,
      .ce-conversion-toolbar,
      .ce-popover,
      .ce-settings {
        background-color: #2a2a2a !important;
        color: white !important;
        border-color: #444 !important;
      }

      .ce-settings .ce-settings__button {
        color: white !important;
      }

      /* Garantir que o popover e toolbar estão visíveis */
      .ce-popover {
        z-index: 1000 !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  ngOnDestroy() {
    this.editor.destroy();
  }

}
