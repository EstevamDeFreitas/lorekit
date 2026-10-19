import type { StoryMessage } from './story-contracts';

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
}
export function renderStoryText(text: string): string {
  return text
    .replaceAll('\r\n', '\n')
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) =>
          line.startsWith('> ')
            ? `<blockquote>${inline(line.slice(2))}</blockquote>`
            : inline(line),
        )
        .join('<br>'),
    )
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('');
}
export function escapeMarkdown(text: string): string {
  return text
    .replace(/[\\`*_{}[\]()#+\-.!>|~]/g, '\\$&')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ');
}
/** Preserve the supported formatting while escaping syntax the chat treats as literal text. */
export function storyTextMarkdown(text: string): string {
  return text
    .replaceAll('\r\n', '\n')
    .replace(/[\\`_{}[\]()#!|~]/g, '\\$&')
    .split('\n')
    .map((line) => line.replace(/^(\s*)([-+]|\d+\.)\s/, '$1\\$2 '))
    .join('\n');
}
export function messageMarkdown(
  message: StoryMessage,
  imageUrl: (assetId: string) => string,
): string {
  let output = `**${escapeMarkdown(message.speaker.name)}** · ${escapeMarkdown(message.authorName)} · ${message.createdAt}\n\n`;
  if (message.text) output += `${storyTextMarkdown(message.text)}\n\n`;
  for (const asset of message.assets)
    output += `![${escapeMarkdown(asset.name)}](${imageUrl(asset.id)})\n\n`;
  if (message.roll) {
    const roll = message.roll;
    output += `> **${escapeMarkdown(roll.actionName)}** (${roll.kind}) — ${escapeMarkdown(roll.formula)}\n`;
    for (const modifier of roll.preview.modifiers)
      output += `> ${escapeMarkdown(modifier.label)}: ${modifier.value >= 0 ? '+' : ''}${modifier.value}${modifier.displayValue ? ` (${escapeMarkdown(modifier.displayValue)})` : ''}\n`;
    for (const result of roll.results)
      output += `> Dados: ${result.rolls.join(', ')}; resultado: ${result.total}; ${result.status}\n`;
    if (roll.target !== null) output += `> Dificuldade: ${roll.target}\n`;
    if (roll.relatedRollMessageId)
      output += `> Oposição: ${roll.relatedRollMessageId}\n`;
    output += `> Regras Ironpaw: v${roll.rulesVersion}\n\n`;
  }
  return output;
}

export function mergeReadRanges(
  ranges: ReadonlyArray<readonly [string, string]>,
): Array<[string, string]> {
  const sorted = ranges
    .map(([start, end]) => [BigInt(start), BigInt(end)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const result: Array<[bigint, bigint]> = [];
  for (const [start, end] of sorted) {
    if (start < 0n || end < start)
      throw new Error('Intervalo de leitura inválido.');
    const last = result.at(-1);
    if (last && start <= last[1] + 1n) last[1] = last[1] > end ? last[1] : end;
    else result.push([start, end]);
  }
  return result.map(([start, end]) => [String(start), String(end)]);
}
