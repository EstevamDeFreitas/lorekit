export default class TailwindColor {
  static get isInline() {
    return true;
  }

  static get title() {
    return 'Cor do Texto';
  }

  private api: any;
  private button: HTMLButtonElement;
  private colorIndicator: HTMLDivElement;
  private dropdown: HTMLDivElement | null = null;
  private savedRange: Range | null = null;
  private _state: boolean = false;

  private readonly WRAP_TAG = 'FONT';

  private readonly colors = [
    { hex: '#FFFFFF', label: 'Branco' },
    { hex: '#FDC112', label: 'Amarelo' },
    { hex: '#22C55E', label: 'Verde' },
    { hex: '#38BDF8', label: 'Azul Claro' },
    { hex: '#60A5FA', label: 'Azul' },
    { hex: '#A78BFA', label: 'Roxo' },
    { hex: '#FB7185', label: 'Rosa' },
    { hex: '#F97316', label: 'Laranja' },
    { hex: '#EF4444', label: 'Vermelho' },
    { hex: '#A3E635', label: 'Lima' },
  ];

  constructor({ api }: { api: any }) {
    this.api = api;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('ce-inline-tool');

    const wrapper = document.createElement('span');
    wrapper.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:100%;pointer-events:none;';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-font';
    icon.style.cssText = 'font-size:12px;line-height:1;';

    this.colorIndicator = document.createElement('div');
    this.colorIndicator.style.cssText =
      'height:3px;width:14px;border-radius:2px;background:#FFFFFF;transition:background .15s;';

    wrapper.appendChild(icon);
    wrapper.appendChild(this.colorIndicator);
    this.button.appendChild(wrapper);
    this.button.title = 'Cor do Texto';

    this.button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.saveSelection();
      this.toggleDropdown();
    });
  }

  render() {
    return this.button;
  }

  surround(_range: Range) {
    // Selection is handled via the dropdown
  }

  checkState() {
    const fontTag = this.api.selection.findParentTag(this.WRAP_TAG) as HTMLElement | null;
    this._state = !!fontTag;
    this.button.classList.toggle('ce-inline-tool--active', this._state);
    if (fontTag) {
      const color = fontTag.getAttribute('color') || fontTag.style.color || '#FFFFFF';
      this.colorIndicator.style.background = color;
    } else {
      this.colorIndicator.style.background = '#FFFFFF';
    }
    return this._state;
  }

  private saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  private restoreSelection() {
    if (!this.savedRange) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
    }
  }

  private toggleDropdown() {
    if (this.dropdown) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown() {
    const dropdown = document.createElement('div');
    dropdown.style.cssText = [
      'position:fixed',
      'background:#1f1f1f',
      'border:1px solid #3f3f46',
      'border-radius:8px',
      'padding:8px',
      'display:flex',
      'flex-wrap:wrap',
      'gap:6px',
      'width:148px',
      'z-index:99999',
      'box-shadow:0 4px 16px rgba(0,0,0,.7)',
    ].join(';');

    const rect = this.button.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;

    this.colors.forEach(({ hex, label }) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.title = label;
      swatch.style.cssText = [
        `background-color:${hex}`,
        'width:20px',
        'height:20px',
        'border-radius:50%',
        hex === '#FFFFFF' ? 'border:2px solid #71717a' : 'border:2px solid #52525b',
        'cursor:pointer',
        'padding:0',
        'transition:transform .1s,border-color .1s',
      ].join(';');

      swatch.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.restoreSelection();
        this.applyColor(hex);
        this.closeDropdown();
      });
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.2)';
        swatch.style.borderColor = '#a1a1aa';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = '';
        swatch.style.borderColor = hex === '#FFFFFF' ? '#71717a' : '#52525b';
      });
      dropdown.appendChild(swatch);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.title = 'Remover cor';
    clearBtn.textContent = '✕';
    clearBtn.style.cssText = [
      'width:20px',
      'height:20px',
      'border-radius:50%',
      'background:#3f3f46',
      'border:2px solid #52525b',
      'color:#a1a1aa',
      'cursor:pointer',
      'padding:0',
      'font-size:9px',
      'line-height:1',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    clearBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.restoreSelection();
      this.clearColor();
      this.closeDropdown();
    });
    dropdown.appendChild(clearBtn);

    // Prevent any mousedown inside dropdown from bubbling and collapsing selection
    dropdown.addEventListener('mousedown', (e) => e.preventDefault());

    document.body.appendChild(dropdown);
    this.dropdown = dropdown;

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeDropdown();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    const closeOnOutside = (e: MouseEvent) => {
      if (this.dropdown && !this.dropdown.contains(e.target as Node)) {
        this.closeDropdown();
        document.removeEventListener('mousedown', closeOnOutside);
        document.removeEventListener('keydown', escHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);
  }

  private closeDropdown() {
    this.dropdown?.remove();
    this.dropdown = null;
  }

  private unwrapAllTags(root: DocumentFragment | Element, tagName: string) {
    // Reverse order so inner-most tags are unwrapped before outer ones
    const tags = Array.from(root.querySelectorAll(tagName)).reverse();
    tags.forEach(tag => {
      const frag = document.createDocumentFragment();
      while (tag.firstChild) frag.appendChild(tag.firstChild);
      tag.parentNode?.replaceChild(frag, tag);
    });
  }

  private applyColor(color: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const fragment = range.extractContents();

    // Remove every existing FONT tag inside the extracted fragment
    this.unwrapAllTags(fragment, this.WRAP_TAG);

    // Wrap the whole fragment in a single FONT with the chosen color
    const font = document.createElement(this.WRAP_TAG);
    font.setAttribute('color', color);
    font.style.color = color;
    font.appendChild(fragment);

    range.insertNode(font);
    this.api.selection.expandToTag(font);
    this.colorIndicator.style.background = color;
  }

  private clearColor() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const fragment = range.extractContents();

    // Strip every FONT tag inside the extracted fragment
    this.unwrapAllTags(fragment, this.WRAP_TAG);

    range.insertNode(fragment);
    this.colorIndicator.style.background = '#FFFFFF';
  }

  static get sanitize() {
    return {
      font: { color: true, style: true },
    };
  }
}
