import {
  escapeMarkdown,
  mergeReadRanges,
  renderStoryText,
  storyTextMarkdown,
} from './story-format';
describe('Story formatting and read intervals', () => {
  it('renders only allowed formatting and escapes executable HTML', () => {
    const html = renderStoryText(
      '**nome** e *fala*\n\n> <script>alert(1)</script>',
    );
    expect(html).toContain('<strong>nome</strong>');
    expect(html).toContain('<em>fala</em>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(
      storyTextMarkdown('# título\n![externo](https://example.invalid)'),
    ).toContain('\\# título');
    expect(escapeMarkdown('Nome\n# Cena')).not.toContain('\n');
  });
  it('merges overlapping receipts without filling unread gaps', () => {
    expect(
      mergeReadRanges([
        ['10', '12'],
        ['3', '4'],
        ['4', '6'],
        ['12', '13'],
      ]),
    ).toEqual([
      ['3', '6'],
      ['10', '13'],
    ]);
  });
  it('renders validated colors together with emphasis and keeps HTML escaped', () => {
    const html = renderStoryText('[color=#ffcc00]**forte** e *itálico* <script>[/color]');
    expect(html).toContain('<span style="color: #ffcc00"><strong>forte</strong> e <em>itálico</em> &lt;script&gt;</span>');
    expect(renderStoryText('**[color=#aabbcc]texto[/color]**')).toContain('<strong><span style="color: #aabbcc">texto</span></strong>');
    expect(renderStoryText('[color=red]texto[/color]')).not.toContain('<span');
    expect(storyTextMarkdown('[color=#ffcc00]**texto**[/color]')).toBe('**texto**');
  });
});
