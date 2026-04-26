export default class TailwindMarker {
  static get isInline() {
    return true;
  }

  static get title() {
    return 'Marcador';
  }

  private api: any;
  private button: HTMLButtonElement;
  private dropdown: HTMLDivElement | null = null;
  private savedRange: Range | null = null;
  private _state: boolean = false;

  private readonly WRAP_TAG = 'MARK';
  private readonly TAG_CLASS = 'tw-marker';

  private readonly colors = [
    { hex: '#FDE047', label: 'Amarelo' },
    { hex: '#86EFAC', label: 'Verde' },
    { hex: '#7DD3FC', label: 'Azul' },
    { hex: '#D8B4FE', label: 'Roxo' },
    { hex: '#FDA4AF', label: 'Rosa' },
    { hex: '#FED7AA', label: 'Pêssego' },
  ];

  constructor({ api }: { api: any }) {
    this.api = api;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('ce-inline-tool');
    this.button.innerHTML = '<i class="fa-solid fa-highlighter" style="font-size:12px;pointer-events:none;"></i>';
    this.button.title = 'Marcador de Texto';

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
    const markTag = this.api.selection.findParentTag(this.WRAP_TAG, this.TAG_CLASS) as HTMLElement | null;
    this._state = !!markTag;
    this.button.classList.toggle('ce-inline-tool--active', this._state);
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
      'width:112px',
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
        'border-radius:4px',
        'border:2px solid #52525b',
        'cursor:pointer',
        'padding:0',
        'transition:transform .1s,border-color .1s',
      ].join(';');

      swatch.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.restoreSelection();
        this.applyMark(hex);
        this.closeDropdown();
      });
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.2)';
        swatch.style.borderColor = '#a1a1aa';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = '';
        swatch.style.borderColor = '#52525b';
      });
      dropdown.appendChild(swatch);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.title = 'Remover marcação';
    clearBtn.textContent = '✕';
    clearBtn.style.cssText = [
      'width:20px',
      'height:20px',
      'border-radius:4px',
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
      this.clearMark();
      this.closeDropdown();
    });
    dropdown.appendChild(clearBtn);

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

  private unwrapAllTags(root: DocumentFragment | Element, tagName: string, tagClass?: string) {
    const selector = tagClass ? `${tagName}.${tagClass}` : tagName;
    const tags = Array.from(root.querySelectorAll(selector)).reverse();
    tags.forEach(tag => {
      const frag = document.createDocumentFragment();
      while (tag.firstChild) frag.appendChild(tag.firstChild);
      tag.parentNode?.replaceChild(frag, tag);
    });
  }

  private applyMark(color: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const fragment = range.extractContents();

    // Remove every existing MARK tag inside the extracted fragment
    this.unwrapAllTags(fragment, this.WRAP_TAG, this.TAG_CLASS);

    // Wrap the whole fragment in a single MARK with the chosen color
    const mark = document.createElement(this.WRAP_TAG);
    mark.classList.add(this.TAG_CLASS);
    mark.style.backgroundColor = color;
    mark.style.color = 'inherit';
    mark.appendChild(fragment);

    range.insertNode(mark);
    this.api.selection.expandToTag(mark);
  }

  private clearMark() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const fragment = range.extractContents();

    // Strip every MARK tag inside the extracted fragment
    this.unwrapAllTags(fragment, this.WRAP_TAG, this.TAG_CLASS);

    range.insertNode(fragment);
  }

  static get sanitize() {
    return {
      mark: { style: true, class: true },
    };
  }
}
