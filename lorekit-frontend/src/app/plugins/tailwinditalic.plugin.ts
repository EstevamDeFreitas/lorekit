export default class TailwindItalic {
  static get isInline() {
    return true;
  }

  static get shortcut() {
    return 'CMD+I';
  }

  static get title() {
    return 'Itálico';
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
  private tag: string = 'EM';
  private class: string = '!italic';

  constructor({ api }: { api: any }) {
    this.api = api;
    this._state = false;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.innerHTML = '<i class="fa-solid fa-italic"></i>';
    this.button.title = 'Itálico (Ctrl+I)';
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
    const italic = document.createElement(this.tag);

    // Usando classe Tailwind para itálico
    italic.classList.add(this.class);
    italic.appendChild(selectedText);
    range.insertNode(italic);

    this.api.selection.expandToTag(italic);
  }

  unwrap(range: Range) {
    const italic = this.api.selection.findParentTag(this.tag, this.class);
    const text = range.extractContents();

    italic.remove();
    range.insertNode(text);
  }

  checkState() {
    const italic = this.api.selection.findParentTag(this.tag, this.class);
    this.state = !!italic;
  }

  static get sanitize() {
    return {
      em: {
        class: 'italic'
      }
    };
  }
}
