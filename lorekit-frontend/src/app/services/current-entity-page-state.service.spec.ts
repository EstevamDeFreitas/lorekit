import { CurrentEntityPageStateService } from './current-entity-page-state.service';

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
});
