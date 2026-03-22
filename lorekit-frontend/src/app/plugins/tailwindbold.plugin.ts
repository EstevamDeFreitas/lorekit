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
  private class: string = '!font-bold';

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
    if (this.state) {
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
    const bold = this.api.selection.findParentTag(this.tag, this.class);
    const text = range.extractContents();

    bold.remove();
    range.insertNode(text);
  }

  checkState() {
    const bold = this.api.selection.findParentTag(this.tag, this.class);
    this.state = !!bold;
  }

  static get sanitize() {
    return {
      strong: {
        class: 'font-bold'
      }
    };
  }
}
