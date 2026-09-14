import { Link } from '../models/link.model';
import { LinkService } from './link.service';
import { EntityWorldScopeService } from './entity-world-scope.service';

type Row = Record<string, any>;

class FakeLinkCrud {
  readonly relationships: Row[] = [
    { parentTable: 'World', parentId: 'world-1', entityTable: 'Location', entityId: 'location-1' },
    { parentTable: 'Location', parentId: 'location-1', entityTable: 'Character', entityId: 'character-1' },
    { parentTable: 'World', parentId: 'world-1', entityTable: 'Species', entityId: 'species-1' },
    { parentTable: 'World', parentId: 'world-1', entityTable: 'Organization', entityId: 'organization-1' },
    { parentTable: 'World', parentId: 'world-1', entityTable: 'Culture', entityId: 'culture-1' },
    { parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'document-1' },
    { parentTable: 'World', parentId: 'world-1', entityTable: 'Object', entityId: 'object-1' },
    { parentTable: 'World', parentId: 'world-2', entityTable: 'Location', entityId: 'location-2' },
    { parentTable: 'World', parentId: 'world-2', entityTable: 'Character', entityId: 'character-2' },
  ];

  readonly tables: Record<string, Row[]> = {
    World: [
      { id: 'world-1', name: 'World 1' },
      { id: 'world-2', name: 'World 2' },
    ],
    Character: [
      { id: 'character-1', name: 'Character 1', Images: [{ usageKey: 'profile', filePath: 'character-1.png' }] },
      { id: 'character-2', name: 'Character 2' },
      { id: 'character-global', name: 'Character Global' },
    ],
    Location: [
      { id: 'location-1', name: 'Location 1' },
      { id: 'location-2', name: 'Location 2' },
    ],
    Species: [{ id: 'species-1', name: 'Species 1' }],
    Organization: [{ id: 'organization-1', name: 'Organization 1' }],
    Culture: [{ id: 'culture-1', name: 'Culture 1' }],
    Document: [{ id: 'document-1', title: 'Document 1' }],
    Object: [{ id: 'object-1', name: 'Object 1' }],
  };

  readonly links: Link[] = [
    new Link('inside', 'Character', 'character-1', 'Location', 'location-1', 'lives in'),
    new Link('unrelated', 'Culture', 'culture-1', 'Organization', 'organization-1', 'unrelated'),
    new Link('network', 'Location', 'location-1', 'Species', 'species-1', 'connects species'),
    new Link('network-2', 'Species', 'species-1', 'Document', 'document-1', 'describes document'),
    new Link('cross-world', 'Character', 'character-1', 'Character', 'character-2', 'crosses worlds'),
    new Link('world-cross', 'World', 'world-1', 'World', 'world-2', 'world bridge'),
  ];

  findAll(table: string, where: Record<string, any> = {}): Row[] {
    const rows: Row[] = table === 'Relationship'
      ? this.relationships
      : table === 'Link'
        ? this.links
        : this.tables[table] || [];

    return rows
      .filter(row => Object.entries(where).every(([key, expected]) => row[key] === expected))
      .map(row => ({
        ...row,
        Images: Array.isArray(row['Images']) ? row['Images'].map((image: Row) => ({ ...image })) : row['Images'],
      }));
  }

  findById(table: string, id: string): Row | null {
    return this.findAll(table).find(row => row['id'] === id) || null;
  }
}

function createService(): { crud: FakeLinkCrud; service: LinkService } {
  const crud = new FakeLinkCrud();
  const dbProvider = { getCrudHelper: () => crud };
  const scopeService = new EntityWorldScopeService(dbProvider as any);
  return { crud, service: new LinkService(dbProvider as any, scopeService) };
}

describe('LinkService graph scope', () => {
  it('loads every selectable entity in the selected world, including isolated nodes', () => {
    const { crud, service } = createService();

    const graph = service.getGraphForScope(null, 'world-1')!;
    const keys = new Set(graph.nodes.map(node => node.key));

    expect(keys.has('Character:character-1')).toBeTrue();
    expect(keys.has('Location:location-1')).toBeTrue();
    expect(keys.has('Species:species-1')).toBeTrue();
    expect(keys.has('Organization:organization-1')).toBeTrue();
    expect(keys.has('Culture:culture-1')).toBeTrue();
    expect(keys.has('Document:document-1')).toBeTrue();
    expect(keys.has('Object:object-1')).toBeTrue();
    expect(keys.has('Character:character-2')).toBeFalse();
    expect(keys.has('World:world-2')).toBeFalse();
    expect(graph.nodes.find(node => node.id === 'character-1')?.imagePath).toBe('character-1.png');
    expect(graph.nodes.find(node => node.id === 'object-1')?.isIsolated).toBeTrue();
    expect(graph.edges.map(edge => edge.id)).toEqual(['inside', 'unrelated', 'network', 'network-2']);
    expect(crud.links.length).toBe(6);
  });

  it('lets an explicit root determine the world even when the global world differs', () => {
    const { service } = createService();

    const rootedFromWorldOne = service.getGraphForScope(
      { table: 'Character', id: 'character-2' },
      'world-1',
    )!;
    const rootedFromWorldTwo = service.getGraphForScope(
      { table: 'Character', id: 'character-2' },
      'world-2',
    )!;
    const firstKeys = rootedFromWorldOne.nodes.map(node => node.key);
    const secondKeys = rootedFromWorldTwo.nodes.map(node => node.key);
    const root = rootedFromWorldOne.nodes.find(node => node.isRoot)!;

    expect(root.key).toBe('Character:character-2');
    expect(root.x).toBe(600);
    expect(root.y).toBe(350);
    expect(firstKeys).toEqual(secondKeys);
    expect(firstKeys).toEqual(['Character:character-2']);
  });

  it('uses the global entity set when there is no selected world', () => {
    const { service } = createService();

    const graph = service.getGraphForScope(null, null)!;

    expect(graph.nodes.map(node => node.key)).toContain('Character:character-global');
    expect(graph.nodes.map(node => node.key)).toContain('Character:character-2');
    expect(graph.edges.map(edge => edge.id)).toContain('cross-world');
    expect(service.getEntitiesByTable('Character', 'world-1').map(entity => entity.id))
      .toEqual(['character-1']);
  });

  it('expands an explicit root to its connected relation web without isolated context', () => {
    const { service } = createService();

    const graph = service.getGraphForScope(
      { table: 'Character', id: 'character-1' },
      'world-1',
    )!;

    expect(graph.edges.map(edge => edge.id)).toEqual(['inside', 'network', 'network-2']);
    expect(graph.nodes.map(node => node.key)).toEqual([
      'Character:character-1',
      'Document:document-1',
      'Location:location-1',
      'Species:species-1',
    ]);
    expect(graph.nodes.every(node => !node.isIsolated)).toBeTrue();
  });
});
