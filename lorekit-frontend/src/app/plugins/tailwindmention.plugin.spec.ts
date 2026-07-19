import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import TailwindMentionPlugin from './tailwindmention.plugin';

describe('TailwindMentionPlugin teardown', () => {
  let holder: HTMLDivElement;

  beforeEach(() => {
    holder = document.createElement('div');
    holder.id = 'mention-test-holder';
    document.body.appendChild(holder);
  });

  afterEach(() => {
    holder.remove();
    document.querySelectorAll('.mention-dropdown').forEach(element => element.remove());
  });

  function createPlugin(search: (term: string, limit: number) => Promise<any[]> | any[] = () => []) {
    return new TailwindMentionPlugin({
      holderId: holder.id,
      search,
    });
  }

  it('removes its dropdown from the document when destroyed', () => {
    const plugin = createPlugin();
    plugin.init();

    const dropdown = (plugin as any).ensureDropdown() as HTMLDivElement;
    expect(document.body.contains(dropdown)).toBeTrue();

    plugin.destroy();

    expect(document.body.contains(dropdown)).toBeFalse();
  });

  it('does not render results that resolve after destruction', fakeAsync(() => {
    let resolveSearch!: (results: any[]) => void;
    const plugin = createPlugin(() => new Promise(resolve => {
      resolveSearch = resolve;
    }));
    plugin.init();

    spyOn<any>(plugin, 'getMentionContext').and.returnValue({
      textNode: document.createTextNode('@entity'),
      tokenStart: 0,
      caretOffset: 7,
      query: 'entity',
    });

    (plugin as any).onInput();
    tick(120);
    plugin.destroy();
    resolveSearch([{
      entityTable: 'Document',
      entityId: '1',
      label: 'Entity',
      href: 'lorekit://entity/Document/1',
    }]);
    flushMicrotasks();

    expect(document.querySelector('.mention-dropdown')).toBeNull();
  }));
});
