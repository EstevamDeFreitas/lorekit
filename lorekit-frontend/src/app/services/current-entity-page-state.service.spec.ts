import { UiConfigPayload } from '../models/ui-field-config.model';
import { activeLayoutTabId, CurrentEntityPageStateService, layoutTabStateId, resolveEntityTab } from './current-entity-page-state.service';

describe('CurrentEntityPageStateService', () => {
  let service: CurrentEntityPageStateService;

  beforeEach(() => {
    service = new CurrentEntityPageStateService();
  });

  it('returns the fallback until a tab is stored', () => {
    expect(service.getCurrentTab('Character', 'character-1', 'properties')).toBe('properties');
  });

  it('keeps the current tab isolated by page and entity', () => {
    service.setCurrentTab('Character', 'character-1', 'backstory');
    service.setCurrentTab('Character', 'character-2', 'properties');
    service.setCurrentTab('Culture', 'character-1', 'description');

    expect(service.getCurrentTab('Character', 'character-1', 'properties')).toBe('backstory');
    expect(service.getCurrentTab('Character', 'character-2', 'backstory')).toBe('properties');
    expect(service.getCurrentTab('Culture', 'character-1', 'properties')).toBe('description');
  });

  it('ignores state without an entity id', () => {
    service.setCurrentTab('Character', '', 'backstory');

    expect(service.getCurrentTab('Character', '', 'properties')).toBe('properties');
  });

  it('composes layout ids and restores a valid configured tab', () => {
    expect(layoutTabStateId('tab:main')).toBe('layout:tab:main');
    expect(resolveEntityTab('layout:tab:second', layout(), ['fixed'])).toBe('layout:tab:second');
    expect(activeLayoutTabId('layout:tab:second', layout())).toBe('tab:second');
  });

  it('keeps fixed tabs and falls back when a configured tab was removed', () => {
    expect(resolveEntityTab('fixed', layout(), ['fixed'])).toBe('fixed');
    expect(resolveEntityTab('layout:tab:removed', layout(), ['fixed'])).toBe('layout:tab:first');
  });
});

function layout(): UiConfigPayload {
  return {
    version: 2,
    columns: 12,
    rowHeight: 56,
    tabs: [
      { id: 'tab:first', name: 'Primeira', items: [] },
      { id: 'tab:second', name: 'Segunda', items: [] },
    ],
  };
}
