import {
  Directive,
  ElementRef,
  HostListener,
  input,
  Input,
  OnDestroy,
  Renderer2
} from '@angular/core';

import {ContextMenuOption} from '../models/context-menu-option.interface';
import { ContextMenuRegistryService } from '../services/context-menu-registry.service';

@Directive({
  selector: '[appContextMenu]',
})
export class ContextMenuDirective implements OnDestroy {

  options = input.required<ContextMenuOption[]>();
  contextId = input<string>('');

  private menuElement?: HTMLElement;
  private removeDocumentClickListener?: () => void;

  constructor(private el: ElementRef, private renderer: Renderer2, private registry: ContextMenuRegistryService) {}

  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent) {
    event.preventDefault();

    this.registry.closeAll();

    this.closeMenu();
    this.createMenu(event.clientX, event.clientY);

    this.registry.setCurrent(
      this.closeMenu.bind(this)
    );
  }

  private createMenu(
    x: number,
    y: number
  ): void {

    this.menuElement = this.renderer.createElement('div');

    this.renderer.addClass(
      this.menuElement,
      'context-menu'
    );

    this.renderer.setStyle(
      this.menuElement,
      'position',
      'fixed'
    );

    this.renderer.setStyle(
      this.menuElement,
      'left',
      `${x}px`
    );

    this.renderer.setStyle(
      this.menuElement,
      'top',
      `${y}px`
    );

    this.renderer.setStyle(
      this.menuElement,
      'z-index',
      '9999'
    );

    for (const option of this.options()) {

      const item =
        this.renderer.createElement('button');

      const child = this.renderer.createElement('span');

      const text = this.renderer.createElement('p');

      this.renderer.appendChild(
        text,
        this.renderer.createText(option.label)
      );

      if(option.customIcon){

        const icon = this.renderer.createElement('i');

        this.renderer.addClass(
          icon,
          "fa-solid"
        );

        this.renderer.addClass(
          icon,
          option.customIcon
        );

        this.renderer.appendChild(
          child,
          icon
        );
      }

      this.renderer.appendChild(
        child,
        text
      );

      this.renderer.appendChild(
        item,
        child
      );

      this.renderer.addClass(
        item,
        'context-menu-item'
      );

      if(option.customClass){
        this.renderer.addClass(
          item,
          option.customClass
        );
      }

      if (option.disabled) {

        this.renderer.setProperty(
          item,
          'disabled',
          true
        );

      } else {

        this.renderer.listen(
          item,
          'click',
          () => {

            option.action(this.contextId());

            this.closeMenu();
          }
        );
      }

      this.renderer.appendChild(
        this.menuElement,
        item
      );
    }

    this.renderer.appendChild(
      document.body,
      this.menuElement
    );

    setTimeout(() => {

      this.removeDocumentClickListener =
        this.renderer.listen(
          'document',
          'click',
          () => this.closeMenu()
        );

    });
  }

  private closeMenu() {
    if (this.menuElement) {

      this.renderer.removeChild(
        document.body,
        this.menuElement
      );

      this.menuElement = undefined;
    }

    if (this.removeDocumentClickListener) {

      this.removeDocumentClickListener();

      this.removeDocumentClickListener =
        undefined;
    }
  }

  ngOnDestroy(): void {
    this.closeMenu();
  }

}
