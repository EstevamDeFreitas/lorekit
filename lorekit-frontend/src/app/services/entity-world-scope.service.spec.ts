import { EntityWorldScopeService } from './entity-world-scope.service';

type RelationshipRow = {
  parentTable: string;
  parentId: string;
  entityTable: string;
  entityId: string;
};

class FakeScopeCrud {
  constructor(
    private readonly worlds: Set<string>,
    private readonly relationships: RelationshipRow[],
  ) {}

  findAll(table: string): RelationshipRow[] {
    return table === 'Relationship'
      ? this.relationships.map(relationship => ({ ...relationship }))
      : [];
  }

  findById(table: string, id: string): { id: string } | null {
    return table === 'World' && this.worlds.has(id) ? { id } : null;
  }
}

function createService(
  worlds: string[],
  relationships: RelationshipRow[],
): EntityWorldScopeService {
  const crud = new FakeScopeCrud(new Set(worlds), relationships);
  return new EntityWorldScopeService({ getCrudHelper: () => crud } as any);
}

describe('EntityWorldScopeService', () => {
  it('resolves direct and inherited world membership', () => {
    const service = createService(['world-1'], [
      { parentTable: 'World', parentId: 'world-1', entityTable: 'Location', entityId: 'location-1' },
      { parentTable: 'Location', parentId: 'location-1', entityTable: 'Character', entityId: 'character-1' },
      { parentTable: 'Character', parentId: 'character-1', entityTable: 'Object', entityId: 'object-1' },
    ]);

    expect(service.getWorldId('Location', 'location-1')).toBe('world-1');
    expect(service.getWorldId('Character', 'character-1')).toBe('world-1');
    expect(service.belongsToWorld('Object', 'object-1', 'world-1')).toBeTrue();
    expect(service.getEntityKeysForWorld('world-1')).toEqual(new Set([
      'World:world-1',
      'Location:location-1',
      'Character:character-1',
      'Object:object-1',
    ]));
  });

  it('terminates safely when hierarchy relationships contain a cycle', () => {
    const service = createService(['world-1'], [
      { parentTable: 'World', parentId: 'world-1', entityTable: 'Location', entityId: 'location-a' },
      { parentTable: 'Location', parentId: 'location-a', entityTable: 'Location', entityId: 'location-b' },
      { parentTable: 'Location', parentId: 'location-b', entityTable: 'Location', entityId: 'location-a' },
    ]);

    expect(service.getWorldId('Location', 'location-a')).toBe('world-1');
    expect(service.getEntityKeysForWorld('world-1')).toEqual(new Set([
      'World:world-1',
      'Location:location-a',
      'Location:location-b',
    ]));
  });

  it('ignores missing world references without treating them as membership', () => {
    const service = createService(['world-1'], [
      { parentTable: 'World', parentId: 'missing-world', entityTable: 'Character', entityId: 'orphan' },
      { parentTable: 'World', parentId: 'world-1', entityTable: 'Character', entityId: 'member' },
    ]);

    expect(service.getWorldId('Character', 'orphan')).toBeNull();
    expect(service.belongsToWorld('Character', 'orphan', 'world-1')).toBeFalse();
    expect(service.getWorldId('World', 'world-1')).toBe('world-1');
  });
});
