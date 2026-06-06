export default class TailwindBold {
  static get isInline() {
    return true;
  }

  static get shortcut() {
    return 'CMD+B';
  }

  static get title() {
    return 'Negrito';
  }

  get state() {
    return this._state;
  }

  set state(state: boolean) {
    this._state = state;

    if (state) {
      this.button.classList.add('ce-inline-tool--active');
    } else {
      this.button.classList.remove('ce-inline-tool--active');
    }
  }

  private api: any;
  private button: HTMLButtonElement;
  private _state: boolean;
  private tag: string = 'STRONG';
  private class: string = 'font-bold';

  constructor({ api }: { api: any }) {
    this.api = api;
    this._state = false;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.innerHTML = '<i class="fa-solid fa-bold"></i>';
    this.button.title = 'Negrito (Ctrl+B)';
    this.button.classList.add('ce-inline-tool');
  }

  render() {
    return this.button;
  }

  surround(range: Range) {
    if (this.state || this.selectionHasBold(range)) {
      this.unwrap(range);
      return;
    }

    this.wrap(range);
  }

  wrap(range: Range) {
    const selectedText = range.extractContents();
    const bold = document.createElement(this.tag);

    bold.classList.add(this.class);
    bold.appendChild(selectedText);
    range.insertNode(bold);

    this.api.selection.expandToTag(bold);
  }

  unwrap(range: Range) {
    const selected = range.extractContents();
    const selectedWithoutBold = this.stripBoldTags(selected);

    const marker = document.createTextNode('');
    range.insertNode(marker);

    const parentBold = this.closestBold(marker);
    if (parentBold) {
      this.splitBoldAtMarker(parentBold, marker, selectedWithoutBold);
      return;
    }

    marker.parentNode?.insertBefore(selectedWithoutBold, marker);
    marker.parentNode?.removeChild(marker);
  }

  checkState() {
    const bold = this.api.selection.findParentTag(this.tag, this.class);
    this.state = !!bold;
  }

  private selectionHasBold(range: Range): boolean {
    const fragment = range.cloneContents();
    const container = document.createElement('div');
    container.appendChild(fragment);

    if (container.querySelector(`${this.tag.toLowerCase()}.${this.class}`)) {
      return true;
    }

    return !!container.querySelector(this.tag.toLowerCase());
  }

  private stripBoldTags(fragment: DocumentFragment): DocumentFragment {
    const walk = (node: Node) => {
      const children = Array.from(node.childNodes);

      for (const child of children) {
        walk(child);

        if (child.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        const element = child as HTMLElement;
        if (element.tagName !== this.tag) {
          continue;
        }

        while (element.firstChild) {
          element.parentNode?.insertBefore(element.firstChild, element);
        }

        element.parentNode?.removeChild(element);
      }
    };

    walk(fragment);
    return fragment;
  }

  private closestBold(node: Node | null): HTMLElement | null {
    let current = node;

    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as HTMLElement;
        if (element.tagName === this.tag && element.classList.contains(this.class)) {
          return element;
        }
      }

      current = current.parentNode;
    }

    return null;
  }

  private splitBoldAtMarker(bold: HTMLElement, marker: Text, insertContent: DocumentFragment) {
    const rightBold = document.createElement(this.tag);
    rightBold.classList.add(this.class);

    while (marker.nextSibling) {
      rightBold.appendChild(marker.nextSibling);
    }

    const parent = bold.parentNode;
    if (!parent) {
      return;
    }

    marker.remove();

    if (rightBold.childNodes.length > 0) {
      parent.insertBefore(rightBold, bold.nextSibling);
      parent.insertBefore(insertContent, rightBold);
    } else {
      parent.insertBefore(insertContent, bold.nextSibling);
    }

    if (!bold.textContent?.length) {
      bold.remove();
    }
  }

  static get sanitize() {
    return {
      strong: {
        class: 'font-bold'
      }
    };
  }
}
