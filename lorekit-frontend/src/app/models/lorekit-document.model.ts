export const LOREKIT_DOCUMENT_FORMAT = 'lorekit-editor' as const;
export const LOREKIT_DOCUMENT_VERSION = 1 as const;

export type LorekitTextMark = {
  bold?: true;
  italic?: true;
  color?: string;
  highlight?: string;
  link?: string;
};

export type LorekitText = LorekitTextMark & { kind: 'text'; text: string };
export type LorekitMention = { kind: 'mention'; entityTable: string; entityId: string; label: string };
export type LorekitInline = LorekitText | LorekitMention;
export type LorekitListItem = { content: LorekitInline[]; checked?: boolean; items: LorekitListItem[] };
export type LorekitImageLayout = { withBorder: boolean; withBackground: boolean; stretched: boolean; width: string };

export type LorekitBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: LorekitInline[] }
  | { type: 'paragraph'; content: LorekitInline[] }
  | { type: 'list'; style: 'ordered' | 'unordered' | 'checklist'; start: number; items: LorekitListItem[] }
  | { type: 'quote'; content: LorekitInline[]; caption: LorekitInline[] }
  | { type: 'table'; rows: LorekitInline[][][] }
  | { type: 'image'; url: string; caption: LorekitInline[]; layout: LorekitImageLayout }
  | { type: 'unsupported'; source: string; originalType: string; data: Record<string, unknown> };

export type LorekitDocument = {
  format: typeof LOREKIT_DOCUMENT_FORMAT;
  version: typeof LOREKIT_DOCUMENT_VERSION;
  blocks: LorekitBlock[];
};

export type EditorCapabilities = {
  blockTypes: ReadonlySet<LorekitBlock['type']>;
  inlineMarks: ReadonlySet<keyof LorekitTextMark | 'mention'>;
};

export interface RichTextEditorAdapter<TDocument> {
  readonly capabilities: EditorCapabilities;
  toEditor(document: LorekitDocument): TDocument;
  fromEditor(document: TDocument): LorekitDocument;
}
