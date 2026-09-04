import { Extension, mergeAttributes, Node, type Extensions, type NodeViewRendererProps } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import { TableKit } from '@tiptap/extension-table';
import { BackgroundColor, FontSize, TextStyle } from '@tiptap/extension-text-style';
import BulletList from '@tiptap/extension-bullet-list';
import Color from '@tiptap/extension-color';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import ListItem from '@tiptap/extension-list-item';
import Mention from '@tiptap/extension-mention';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import TaskItem from '@tiptap/extension-task-item';
import Strike from '@tiptap/extension-strike';
import TaskList from '@tiptap/extension-task-list';
import Text from '@tiptap/extension-text';
import type { SuggestionProps } from '@tiptap/suggestion';
import Underline from '@tiptap/extension-underline';
import { buildImageUrl } from '../../models/image.model';
import type { LorekitInline } from '../../models/lorekit-document.model';
import type { MentionEntity, EntityMentionService } from '../../services/entity-mention.service';

type LorekitImageLayout = { withBorder: boolean; withBackground: boolean; stretched: boolean; width: string };

const defaultImageLayout: LorekitImageLayout = { withBorder: false, withBackground: false, stretched: false, width: 'auto' };
const TextAlignment = Extension.create({
  name: 'lorekitTextAlignment',
  addGlobalAttributes() {
    return [{
      types: ['heading', 'paragraph'],
      attributes: {
        textAlign: {
          default: 'left',
          parseHTML: element => element.style.textAlign || 'left',
          renderHTML: attributes => attributes['textAlign'] && attributes['textAlign'] !== 'left'
            ? { style: `text-align: ${attributes['textAlign']}` }
            : {},
        },
      },
    }];
  },
});


const TextIndentation = Extension.create({
  name: 'lorekitTextIndentation',
  addGlobalAttributes() {
    return [{
      types: ['heading', 'paragraph'],
      attributes: {
        textIndent: {
          default: 0,
          parseHTML: element => {
            const indent = Number(element.getAttribute('data-lorekit-indent'));
            return Number.isInteger(indent) && indent > 0 ? Math.min(indent, 8) : 0;
          },
          renderHTML: attributes => {
            const indent = Number(attributes['textIndent']);
            return Number.isInteger(indent) && indent > 0
              ? { 'data-lorekit-indent': String(Math.min(indent, 8)), style: `margin-left: ${Math.min(indent, 8) * 2}rem` }
              : {};
          },
        },
      },
    }];
  },
});

export function createTiptapExtensions(mentionService: EntityMentionService): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    Heading.configure({ levels: [1, 2, 3] }),
    Bold,
    Italic,
    Underline,
    Strike,
    BulletList,
    OrderedList,
    ListItem,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Link.configure({ openOnClick: false, autolink: true }),
    TextStyle,
    Color,
    BackgroundColor,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlignment,
    TextIndentation,
    createLorekitMention(mentionService),
    createLorekitImage(),
    createLorekitQuote(),
    createUnsupportedBlock(),
  ];
}

function createLorekitMention(mentionService: EntityMentionService) {
  return Mention.extend({
    addAttributes() {
      return {
        ...(this.parent?.() ?? {}),
        entityId: { default: null },
        entityTable: { default: null },
      };
    },
  }).configure({
    HTMLAttributes: { class: 'mention-entity', 'data-mention': 'true' },
    renderText: ({ node }) => `@${String(node.attrs['label'] ?? node.attrs['id'] ?? '')}`,
    renderHTML: ({ node }) => {
      const HTMLAttributes = { class: 'mention-entity' };
      const entityId = String(node.attrs['entityId'] ?? node.attrs['id'] ?? '');
      const entityTable = String(node.attrs['entityTable'] ?? '');
      const href = entityId && entityTable ? mentionService.buildMentionHref(entityTable as MentionEntity['entityTable'], entityId) : '#';
      return ['a', mergeAttributes(HTMLAttributes, {
        href,
        'data-mention': 'true',
        'data-entity-id': entityId,
        'data-entity-table': entityTable,
      }), `@${String(node.attrs['label'] ?? entityId)}`];
    },
    suggestion: createMentionSuggestion(mentionService) as never,
  });
}

function createMentionSuggestion(mentionService: EntityMentionService) {
  return {
    char: '@',
    minQueryLength: 1,
    debounce: 120,
    items: ({ query }: { query: string }) => mentionService.search(query, 8),
    command: ({ editor, range, props }: { editor: SuggestionProps<MentionEntity, MentionEntity>['editor']; range: SuggestionProps<MentionEntity, MentionEntity>['range']; props: MentionEntity }) => {
      editor.chain().focus().insertContentAt(range, [
        { type: 'mention', attrs: { id: props.entityId, entityId: props.entityId, entityTable: props.entityTable, label: props.label } },
        { type: 'text', text: ' ' },
      ]).run();
    },
    render: () => createMentionMenu(),
  };
}

function createMentionMenu() {
  let popup: HTMLDivElement | null = null;
  let unmount: (() => void) | null = null;
  let activeIndex = 0;
  let current: SuggestionProps<MentionEntity, MentionEntity> | null = null;

  const render = (props: SuggestionProps<MentionEntity, MentionEntity>) => {
    current = props;
    if (!popup) return;
    activeIndex = Math.min(activeIndex, Math.max(props.items.length - 1, 0));
    popup.replaceChildren(...props.items.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mention-option${index === activeIndex ? ' mention-option--active' : ''}`;
      button.textContent = `@${item.label} - ${item.subtitle}`;
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        props.command(item);
      });
      return button;
    }));
  };

  return {
    onStart(props: SuggestionProps<MentionEntity, MentionEntity>) {
      popup = document.createElement('div');
      popup.className = 'mention-dropdown';
      render(props);
      unmount = props.mount(popup);
    },
    onUpdate(props: SuggestionProps<MentionEntity, MentionEntity>) { render(props); },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (!current?.items.length) return false;
      if (event.key === 'ArrowDown') { activeIndex = (activeIndex + 1) % current.items.length; render(current); return true; }
      if (event.key === 'ArrowUp') { activeIndex = (activeIndex + current.items.length - 1) % current.items.length; render(current); return true; }
      if (event.key === 'Enter') { current.command(current.items[activeIndex]); return true; }
      return false;
    },
    onExit() {
      unmount?.();
      unmount = null;
      popup = null;
      current = null;
    },
  };
}

function createLorekitImage() {
  return Node.create({
    name: 'lorekitImage', group: 'block', atom: true, draggable: true, selectable: true,
    addAttributes() {
      return {
        url: { default: '' },
        caption: { default: [] },
        layout: { default: defaultImageLayout },
      };
    },
    parseHTML() { return [{ tag: 'figure[data-lorekit-image]' }]; },
    renderHTML({ HTMLAttributes, node }) {
      const attrs = node.attrs as { url: string; caption: LorekitInline[]; layout: LorekitImageLayout };
      return ['figure', mergeAttributes(HTMLAttributes, { 'data-lorekit-image': 'true' }), ['img', { src: attrs.url }], ['figcaption', inlineText(attrs.caption)]];
    },
    addNodeView() { return props => imageNodeView(props); },
  });
}

function imageNodeView({ node, getPos, editor }: NodeViewRendererProps) {
  let currentNode = node;
  const dom = document.createElement('figure');
  dom.className = 'tiptap-image-node';
  const image = document.createElement('img');
  const caption = document.createElement('input');
  caption.type = 'text';
  caption.className = 'tiptap-image-caption';
  caption.placeholder = 'Legenda da imagem...';
  const options = document.createElement('div');
  options.className = 'tiptap-image-options';
  const border = optionButton('Borda');
  const background = optionButton('Fundo');
  const stretch = optionButton('Largura total');
  const width = document.createElement('select');
  ['auto', '25%', '50%', '75%', '100%'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; width.append(option); });
  options.append(border, background, stretch, width);
  dom.append(image, caption, options);

  const updateAttrs = (next: Record<string, unknown>) => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (typeof pos !== 'number') return;
    editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...next }));
  };
  const render = () => {
    const attrs = currentNode.attrs as { url?: string; caption?: LorekitInline[]; layout?: LorekitImageLayout };
    const layout = { ...defaultImageLayout, ...(attrs.layout ?? {}) };
    image.src = buildImageUrl(attrs.url ?? '');
    image.alt = inlineText(attrs.caption ?? []);
    caption.value = inlineText(attrs.caption ?? []);
    width.value = layout.width;
    dom.classList.toggle('has-border', layout.withBorder);
    dom.classList.toggle('has-background', layout.withBackground);
    dom.classList.toggle('is-stretched', layout.stretched);
    dom.style.width = layout.stretched ? '100%' : layout.width === 'auto' ? '' : layout.width;
  };
  caption.addEventListener('change', () => updateAttrs({ caption: [{ kind: 'text', text: caption.value }] }));
  border.addEventListener('click', () => { const layout = imageLayout(currentNode.attrs['layout']); updateAttrs({ layout: { ...layout, withBorder: !layout.withBorder } }); });
  background.addEventListener('click', () => { const layout = imageLayout(currentNode.attrs['layout']); updateAttrs({ layout: { ...layout, withBackground: !layout.withBackground } }); });
  stretch.addEventListener('click', () => { const layout = imageLayout(currentNode.attrs['layout']); updateAttrs({ layout: { ...layout, stretched: !layout.stretched } }); });
  width.addEventListener('change', () => { const layout = imageLayout(currentNode.attrs['layout']); updateAttrs({ layout: { ...layout, width: width.value } }); });
  render();
  return {
    dom,
    update(updatedNode: typeof currentNode) {
      if (updatedNode.type !== currentNode.type) return false;
      currentNode = updatedNode;
      render();
      return true;
    },
    stopEvent: (event: Event) => event.target === caption || event.target === width || options.contains(event.target as globalThis.Node),
  };
}

function createLorekitQuote() {
  return Node.create({
    name: 'lorekitQuote', group: 'block', content: 'block+', defining: true,
    addAttributes() { return { caption: { default: [] } }; },
    parseHTML() { return [{ tag: 'blockquote[data-lorekit-quote]' }]; },
    renderHTML({ HTMLAttributes }) { return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-lorekit-quote': 'true' }), 0]; },
    addNodeView() { return props => quoteNodeView(props); },
  });
}

function quoteNodeView({ node, getPos, editor }: NodeViewRendererProps) {
  let currentNode = node;
  const dom = document.createElement('blockquote');
  dom.className = 'tiptap-quote-node';
  const contentDOM = document.createElement('div');
  contentDOM.className = 'tiptap-quote-content';
  const caption = document.createElement('input');
  caption.type = 'text';
  caption.className = 'tiptap-quote-caption';
  caption.placeholder = 'Legenda da citação...';
  dom.append(contentDOM, caption);
  const render = () => { caption.value = inlineText((currentNode.attrs['caption'] as LorekitInline[] | undefined) ?? []); };
  caption.addEventListener('change', () => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (typeof pos === 'number') editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, caption: [{ kind: 'text', text: caption.value }] }));
  });
  render();
  return {
    dom, contentDOM,
    update(updatedNode: typeof currentNode) { if (updatedNode.type !== currentNode.type) return false; currentNode = updatedNode; render(); return true; },
    stopEvent: (event: Event) => event.target === caption,
  };
}

function createUnsupportedBlock() {
  return Node.create({
    name: 'lorekitUnsupported', group: 'block', atom: true, selectable: true,
    addAttributes() { return { source: { default: 'tiptap' }, originalType: { default: 'unknown' }, data: { default: {} } }; },
    parseHTML() { return [{ tag: 'div[data-lorekit-unsupported]' }]; },
    renderHTML({ HTMLAttributes, node }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-lorekit-unsupported': 'true' }), `Conteúdo não editável: ${String(node.attrs['originalType'])}`]; },
    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement('div');
        dom.className = 'tiptap-unsupported-node';
        dom.textContent = `Conteúdo não editável preservado: ${String(node.attrs['originalType'])}`;
        return { dom };
      };
    },
  });
}

function optionButton(label: string): HTMLButtonElement { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; return button; }
function inlineText(content: LorekitInline[]): string { return content.map(part => part.kind === 'mention' ? `@${part.label}` : part.text).join(''); }
function imageLayout(value: unknown): LorekitImageLayout { const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; return { withBorder: record['withBorder'] === true, withBackground: record['withBackground'] === true, stretched: record['stretched'] === true, width: typeof record['width'] === 'string' ? record['width'] : 'auto' }; }
