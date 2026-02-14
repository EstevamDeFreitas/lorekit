export type MentionSuggestion = {
  entityTable: string;
  entityId: string;
  label: string;
  subtitle?: string;
  href: string;
};

type MentionContext = {
  textNode: Text;
  tokenStart: number;
  caretOffset: number;
  query: string;
};

type TailwindMentionPluginConfig = {
  holderId: string;
  minChars?: number;
  maxResults?: number;
  search: (term: string, limit: number) => Promise<MentionSuggestion[]> | MentionSuggestion[];
  onMentionClick?: (mention: MentionSuggestion) => void | Promise<void>;
};

export default class TailwindMentionPlugin {
  private readonly holderId: string;
  private readonly minChars: number;
  private readonly maxResults: number;
  private readonly search: TailwindMentionPluginConfig['search'];
  private readonly onMentionClick?: TailwindMentionPluginConfig['onMentionClick'];

  private holder: HTMLElement | null = null;
  private dropdown: HTMLDivElement | null = null;
  private activeContext: MentionContext | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onInputBound = this.onInput.bind(this);
  private readonly onClickBound = this.onClick.bind(this);
  private readonly onDocumentPointerDownBound = this.onDocumentPointerDown.bind(this);

  constructor(config: TailwindMentionPluginConfig) {
    this.holderId = config.holderId;
    this.minChars = config.minChars ?? 1;
    this.maxResults = config.maxResults ?? 8;
    this.search = config.search;
    this.onMentionClick = config.onMentionClick;
  }

  init() {
    this.holder = document.getElementById(this.holderId);
    if (!this.holder) return;

    this.hydratePersistedMentions();
    this.holder.addEventListener('input', this.onInputBound);
    this.holder.addEventListener('click', this.onClickBound);
    document.addEventListener('pointerdown', this.onDocumentPointerDownBound);
  }

  destroy() {
    if (this.holder) {
      this.holder.removeEventListener('input', this.onInputBound);
      this.holder.removeEventListener('click', this.onClickBound);
    }

    document.removeEventListener('pointerdown', this.onDocumentPointerDownBound);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }

    this.hideDropdown();
    this.holder = null;
    this.activeContext = null;
  }

  private onInput() {
    const context = this.getMentionContext();

    if (!context || context.query.length < this.minChars) {
      this.activeContext = null;
      this.hideDropdown();
      return;
    }

    this.activeContext = context;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(async () => {
      if (!this.activeContext) return;
      const results = await this.search(this.activeContext.query, this.maxResults);

      if (!results.length) {
        this.hideDropdown();
        return;
      }

      this.renderDropdown(results);
    }, 120);
  }

  private onClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const mentionEl = target.closest('a') as HTMLAnchorElement | null;
    if (!mentionEl) return;

    const href = mentionEl.getAttribute('href') || '';
    const isMentionByHref = /^lorekit:\/\/entity\//i.test(href);
    const isMentionByAttr = mentionEl.getAttribute('data-mention') === 'true';

    if (!isMentionByHref && !isMentionByAttr) return;

    event.preventDefault();
    event.stopPropagation();

    const entityTable = mentionEl.getAttribute('data-entity-table') || '';
    const entityId = mentionEl.getAttribute('data-entity-id') || '';
    const label = (mentionEl.textContent || '').replace(/^@/, '');

    if (this.onMentionClick) {
      void this.onMentionClick({ entityTable, entityId, label, href });
    }
  }

  private hydratePersistedMentions() {
    if (!this.holder) return;

    const links = this.holder.querySelectorAll('a[href]');

    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!/^lorekit:\/\/entity\//i.test(href)) return;

      if (link.getAttribute('data-mention') !== 'true') {
        link.setAttribute('data-mention', 'true');
      }

      const match = href.match(/^lorekit:\/\/entity\/([^/]+)\/([^/?#]+)/i);
      if (match) {
        if (!link.getAttribute('data-entity-table')) {
          link.setAttribute('data-entity-table', decodeURIComponent(match[1]));
        }
        if (!link.getAttribute('data-entity-id')) {
          link.setAttribute('data-entity-id', decodeURIComponent(match[2]));
        }
      }

      if (!link.classList.contains('mention-entity')) {
        link.classList.add('mention-entity');
      }

      (link as HTMLElement).style.background = 'rgba(234, 179, 8, 0.2)';
      (link as HTMLElement).style.border = '1px solid rgba(234, 179, 8, 0.35)';
      (link as HTMLElement).style.color = '#fde047';
      (link as HTMLElement).style.padding = '1px 6px';
      (link as HTMLElement).style.borderRadius = '999px';
      (link as HTMLElement).style.textDecoration = 'none';
      (link as HTMLElement).style.cursor = 'pointer';
      link.setAttribute('contenteditable', 'false');
    });
  }

  private onDocumentPointerDown(event: PointerEvent) {
    if (!this.dropdown) return;

    const target = event.target as Node | null;
    if (!target) return;

    if (this.dropdown.contains(target)) return;
    if (this.holder?.contains(target)) return;

    this.hideDropdown();
  }

  private getMentionContext(): MentionContext | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    if (!selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;

    if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) return null;
    if (!this.holder?.contains(anchorNode)) return null;

    const editableParent = (anchorNode.parentElement?.closest('[contenteditable="true"]') as HTMLElement | null);
    if (!editableParent) return null;

    const textNode = anchorNode as Text;
    const text = textNode.data ?? '';
    const caretOffset = range.startOffset;

    if (caretOffset > text.length) return null;

    const prefix = text.slice(0, caretOffset);
    const tokenStart = prefix.lastIndexOf('@');

    if (tokenStart === -1) return null;
    if (tokenStart > 0 && /\S/.test(prefix[tokenStart - 1])) return null;

    const query = prefix.slice(tokenStart + 1);
    if (/\s/.test(query)) return null;

    return {
      textNode,
      tokenStart,
      caretOffset,
      query,
    };
  }

  private renderDropdown(results: MentionSuggestion[]) {
    if (!this.holder) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();

    const dropdown = this.ensureDropdown();
    dropdown.innerHTML = '';

    for (const item of results) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'mention-option';
      option.style.display = 'flex';
      option.style.width = '100%';
      option.style.alignItems = 'center';
      option.style.justifyContent = 'space-between';
      option.style.padding = '8px 10px';
      option.style.background = 'transparent';
      option.style.border = '0';
      option.style.color = '#f4f4f5';
      option.style.cursor = 'pointer';

      const left = document.createElement('span');
      left.textContent = `@${item.label}`;
      left.style.fontSize = '13px';
      left.style.fontWeight = '600';

      const right = document.createElement('span');
      right.textContent = item.subtitle || '';
      right.style.fontSize = '11px';
      right.style.color = '#a1a1aa';

      option.appendChild(left);
      option.appendChild(right);

      option.addEventListener('mouseenter', () => {
        option.style.background = '#27272a';
      });

      option.addEventListener('mouseleave', () => {
        option.style.background = 'transparent';
      });

      option.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.insertMention(item);
      });

      dropdown.appendChild(option);
    }

    dropdown.style.display = 'block';
    dropdown.style.position = 'fixed';
    dropdown.style.left = `${Math.max(8, rect.left)}px`;
    dropdown.style.top = `${Math.max(8, rect.bottom + 6)}px`;
  }

  private ensureDropdown(): HTMLDivElement {
    if (this.dropdown) return this.dropdown;

    const el = document.createElement('div');
    el.className = 'mention-dropdown';
    el.style.minWidth = '240px';
    el.style.maxWidth = '360px';
    el.style.maxHeight = '240px';
    el.style.overflowY = 'auto';
    el.style.zIndex = '2000';
    el.style.border = '1px solid #3f3f46';
    el.style.borderRadius = '10px';
    el.style.background = '#18181b';
    el.style.boxShadow = '0 10px 30px rgba(0, 0, 0, .35)';
    el.style.padding = '4px';
    el.style.display = 'none';

    document.body.appendChild(el);
    this.dropdown = el;
    return el;
  }

  private hideDropdown() {
    if (!this.dropdown) return;
    this.dropdown.style.display = 'none';
    this.dropdown.innerHTML = '';
  }

  private insertMention(item: MentionSuggestion) {
    const context = this.activeContext;
    if (!context) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.setStart(context.textNode, context.tokenStart);
    range.setEnd(context.textNode, context.caretOffset);

    const mentionEl = document.createElement('a');
    mentionEl.textContent = `@${item.label}`;
    mentionEl.setAttribute('href', item.href);
    mentionEl.setAttribute('data-mention', 'true');
    mentionEl.setAttribute('data-entity-table', item.entityTable);
    mentionEl.setAttribute('data-entity-id', item.entityId);
    mentionEl.className = 'mention-entity';
    mentionEl.style.background = 'rgba(234, 179, 8, 0.2)';
    mentionEl.style.border = '1px solid rgba(234, 179, 8, 0.35)';
    mentionEl.style.color = '#fde047';
    mentionEl.style.padding = '1px 6px';
    mentionEl.style.borderRadius = '999px';
    mentionEl.style.textDecoration = 'none';
    mentionEl.style.cursor = 'pointer';
    mentionEl.setAttribute('contenteditable', 'false');

    range.deleteContents();
    range.insertNode(mentionEl);

    const trailingSpace = document.createTextNode('\u00A0');
    mentionEl.after(trailingSpace);

    const newCaretRange = document.createRange();
    newCaretRange.setStart(trailingSpace, trailingSpace.length);
    newCaretRange.collapse(true);

    selection.removeAllRanges();
    selection.addRange(newCaretRange);

    this.activeContext = null;
    this.hideDropdown();
  }
}
