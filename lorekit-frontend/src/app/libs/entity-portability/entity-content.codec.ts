import { LorekitDocumentCodec } from '../../components/editor/lorekit-document.codec';
import type { LorekitDocument, LorekitInline } from '../../models/lorekit-document.model';

export const PACKAGE_ASSET_PREFIX = 'bundle-asset://';
export const EXTERNAL_MENTION_PREFIX = 'external-ref:';
export const RICH_CHARACTER_COLUMNS = new Set(['description', 'personality', 'background', 'objectives', 'appearance']);

export function jsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  validateJsonTree(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Objeto JSON esperado.');
  return parsed as Record<string, unknown>;
}

/** Limits nesting and rejects prototype pollution before any traversal/remapping. */
export function validateJsonTree(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (depth > 64 || ++budget.nodes > 50000) throw new Error('Conteúdo estruturado excede os limites.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach(item => validateJsonTree(item, depth + 1, budget)); return; }
  if (typeof value !== 'object') throw new Error('Valor JSON inválido.');
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Chave JSON não permitida.');
    validateJsonTree(item, depth + 1, budget);
  }
}

export function validatePersonalization(serialized: unknown): void {
  if (!serialized) return;
  if (typeof serialized !== 'string') throw new Error('Personalização inválida.');
  const object = jsonObject(serialized);
  if (Object.values(object).some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value))) throw new Error('Personalização deve conter valores simples.');
  if (Object.values(object).some(value => typeof value === 'string' && /(?:file:|blob:|data:|lorekit-asset:|bundle-asset:)/i.test(value))) throw new Error('Recursos da personalização devem ser registros de imagem.');
}

export interface ContentMapper {
  mention(part: Extract<LorekitInline, { kind: 'mention' }>): Promise<LorekitInline> | LorekitInline;
  asset(reference: string): Promise<string> | string;
}

function documentFromSource(serialized: string): LorekitDocument | null {
  if (!serialized.trim()) return null;
  let raw: unknown;
  try { raw = JSON.parse(serialized); } catch { raw = null; }
  if (raw && typeof raw === 'object') {
    validateJsonTree(raw);
    if (LorekitDocumentCodec.isLorekitDocument(raw)) return structuredClone(raw);
    if (Array.isArray((raw as Record<string, unknown>)['blocks'])) {
      if (typeof DOMParser === 'undefined') throw new Error('A conversão de EditorJS exige o ambiente do editor.');
      return LorekitDocumentCodec.deserialize(serialized);
    }
    throw new Error('Formato de texto estruturado não suportado.');
  }
  if (/<\/?[a-z][^>]*>/i.test(serialized)) {
    if (typeof DOMParser === 'undefined') throw new Error('A conversão de HTML exige o ambiente do editor.');
    if (/<\s*(img|iframe|script|object)\b/i.test(serialized)) throw new Error('HTML com recursos incorporados não é portátil. Converta para blocos do editor.');
    return LorekitDocumentCodec.deserialize(serialized);
  }
  return null;
}

/** Maps semantic positions only. Never substitutes arbitrary UUIDs in prose/JSON. */
export async function mapRichContent(serialized: string, mapper: ContentMapper): Promise<string> {
  const document = documentFromSource(serialized);
  if (!document) return serialized;
  validateDocument(document, () => undefined, () => undefined, false);
  const inline = async (parts: LorekitInline[]): Promise<LorekitInline[]> => Promise.all(parts.map(part => part.kind === 'mention' ? mapper.mention(part) : part));
  const list = async (items: Array<{ content: LorekitInline[]; items: unknown[] }>): Promise<void> => {
    for (const item of items) { item.content = await inline(item.content); await list(item.items as typeof items); }
  };
  for (const block of document.blocks) {
    if (block.type === 'paragraph' || block.type === 'heading') block.content = await inline(block.content);
    else if (block.type === 'quote') { block.content = await inline(block.content); block.caption = await inline(block.caption); }
    else if (block.type === 'list') await list(block.items);
    else if (block.type === 'table') block.rows = await Promise.all(block.rows.map(row => Promise.all(row.map(inline))));
    else if (block.type === 'image') { block.url = await mapper.asset(block.url); block.caption = await inline(block.caption); }
  }
  return JSON.stringify(document);
}

export function inspectPortableContent(value: unknown, mention: (type: string, key: string) => void, asset: (key: string) => void): void {
  if (value === null || value === '') return;
  if (typeof value !== 'string') throw new Error('Texto inválido.');
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { parsed = null; }
  if (parsed && typeof parsed === 'object') {
    validateDocument(parsed, mention, asset, true); return;
  }
  // Source HTML is converted before packaging; imported HTML never enters the editor directly.
  if (/<\/?[a-z][^>]*>/i.test(value) || /(?:file:|blob:|data:|lorekit-asset:|lorekit:\/\/entity|bundle-asset:)/i.test(value)) throw new Error('Texto contém referência ou HTML não convertido.');
}

function validateDocument(value: unknown, mention: (type: string, key: string) => void, asset: (key: string) => void, portable: boolean): asserts value is LorekitDocument {
  validateJsonTree(value);
  const doc = object(value, ['format', 'version', 'blocks']);
  if (doc['format'] !== 'lorekit-editor' || doc['version'] !== 1) throw new Error('Versão do documento não suportada.');
  const inline = (value: unknown): void => {
    for (const item of array(value)) {
      const part = object(item, ['kind', 'text', 'bold', 'italic', 'underline', 'strike', 'color', 'highlight', 'link', 'fontSize', 'entityTable', 'entityId', 'label']);
      if (part['kind'] === 'mention') {
        object(item, ['kind', 'entityTable', 'entityId', 'label']);
        text(part['label']); mention(text(part['entityTable']), text(part['entityId']));
      } else if (part['kind'] === 'text') {
        object(item, ['kind', 'text', 'bold', 'italic', 'underline', 'strike', 'color', 'highlight', 'link', 'fontSize']); text(part['text']);
        for (const flag of ['bold', 'italic', 'underline', 'strike']) if (part[flag] !== undefined && part[flag] !== true) throw new Error('Marca de texto inválida.');
        if (part['link'] !== undefined && !/^(https?:\/\/|mailto:|#)/i.test(text(part['link']))) throw new Error('Link de texto não permitido.');
        for (const style of ['color', 'highlight', 'fontSize']) if (part[style] !== undefined && (!/^[\w#\s(),.%/-]{1,128}$/.test(text(part[style])) || /url/i.test(text(part[style])))) throw new Error('Estilo de texto inválido.');
      } else throw new Error('Elemento inline não suportado.');
    }
  };
  const list = (value: unknown): void => {
    for (const item of array(value)) { const row = object(item, ['content', 'checked', 'items']); if (row['checked'] !== undefined && typeof row['checked'] !== 'boolean') throw new Error('Checklist inválida.'); inline(row['content']); list(row['items']); }
  };
  for (const item of array(doc['blocks'])) {
    const block = object(item, ['type', 'level', 'content', 'alignment', 'indent', 'style', 'start', 'items', 'caption', 'rows', 'url', 'layout']);
    const variants: Record<string, string[]> = {
      heading: ['type', 'level', 'content', 'alignment', 'indent'], paragraph: ['type', 'content', 'alignment', 'indent'],
      quote: ['type', 'content', 'caption', 'alignment', 'indent'], list: ['type', 'style', 'start', 'items'],
      table: ['type', 'rows'], image: ['type', 'url', 'caption', 'layout'],
    };
    const allowed = variants[String(block['type'])]; if (!allowed) throw new Error('Bloco de editor sem suporte à portabilidade. Nenhum conteúdo foi omitido.'); object(item, allowed);
    if (block['alignment'] !== undefined && !['left', 'center', 'right', 'justify'].includes(text(block['alignment']))) throw new Error('Alinhamento inválido.');
    if (block['indent'] !== undefined && (!Number.isInteger(block['indent']) || Number(block['indent']) < 0 || Number(block['indent']) > 8)) throw new Error('Recuo inválido.');
    switch (block['type']) {
      case 'heading': if (typeof block['level'] !== 'number' || ![1, 2, 3, 4, 5, 6].includes(block['level'])) throw new Error('Título inválido.'); inline(block['content']); break;
      case 'paragraph': inline(block['content']); break;
      case 'quote': inline(block['content']); inline(block['caption']); break;
      case 'list': if (!['ordered', 'unordered', 'checklist'].includes(text(block['style'])) || !Number.isInteger(block['start']) || Number(block['start']) < 1) throw new Error('Lista inválida.'); list(block['items']); break;
      case 'table': for (const row of array(block['rows'])) for (const cell of array(row)) inline(cell); break;
      case 'image': {
        const url = text(block['url']);
        if (portable) { if (!/^bundle-asset:\/\/[a-zA-Z0-9_-]{1,128}$/.test(url)) throw new Error('Imagem do documento fora do pacote.'); asset(url.slice(PACKAGE_ASSET_PREFIX.length)); }
        const layout = object(block['layout'], ['withBorder', 'withBackground', 'stretched', 'width']);
        for (const flag of ['withBorder', 'withBackground', 'stretched']) if (typeof layout[flag] !== 'boolean') throw new Error('Layout de imagem inválido.');
        if (!/^(auto|\d{1,4}(?:\.\d+)?(?:px|%)?)$/.test(text(layout['width']))) throw new Error('Largura de imagem inválida.'); inline(block['caption']); break;
      }
      default: throw new Error('Bloco de editor sem suporte à portabilidade. Nenhum conteúdo foi omitido.');
    }
  }
}

export function inspectGallery(value: unknown, asset: (key: string) => void): void {
  if (value === null || value === '') return;
  if (typeof value !== 'string') throw new Error('Galeria inválida.');
  for (const item of array(JSON.parse(value))) {
    const reference = text(item);
    if (!/^bundle-asset:\/\/[a-zA-Z0-9_-]{1,128}$/.test(reference)) throw new Error('Imagem de galeria fora do pacote.');
    asset(reference.slice(PACKAGE_ASSET_PREFIX.length));
  }
}

function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Estrutura de documento não suportada.');
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Lista esperada no conteúdo.'); return value; }
function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Texto esperado no conteúdo.'); return value; }
