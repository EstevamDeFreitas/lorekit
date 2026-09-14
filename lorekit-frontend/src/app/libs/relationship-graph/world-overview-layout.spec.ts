import { Link } from '../../models/link.model';
import { buildGraphView } from './relationship-graph.utils';

describe('World overview layout', () => {
  const world = { table: 'World', id: 'world', label: 'World' };
  const entities = [world, ...['a', 'b', 'c', 'd', 'isolated'].map(id => ({
    table: 'Character', id, label: id,
  }))];
  const links = [
    new Link('ab', 'Character', 'a', 'Character', 'b', 'knows'),
    new Link('cd', 'Character', 'c', 'Character', 'd', 'knows'),
  ];

  it('centers the world and groups connected entities without inventing links', () => {
    const graph = buildGraphView(null, entities, links, 'World:world');
    const center = graph.nodes.find(node => node.table === 'World')!;
    const a = graph.nodes.find(node => node.id === 'a')!;
    const b = graph.nodes.find(node => node.id === 'b')!;
    const c = graph.nodes.find(node => node.id === 'c')!;
    expect(center.x).toBe(graph.width! / 2);
    expect(center.y).toBe(graph.height! / 2);
    expect(center.isRoot).toBeFalse();
    expect(graph.edges.map(edge => edge.id)).toEqual(['ab', 'cd']);
    expect(graph.nodes.length).toBe(entities.length);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(Math.hypot(a.x - c.x, a.y - c.y));
    expect(graph).toEqual(buildGraphView(null, entities, links, 'World:world'));
    for (const node of graph.nodes) {
      expect(node.x - node.radius).toBeGreaterThanOrEqual(0);
      expect(node.y + node.radius).toBeLessThanOrEqual(graph.height!);
      for (const other of graph.nodes) {
        if (node === other) continue;
        expect(Math.hypot(node.x - other.x, node.y - other.y))
          .toBeGreaterThan(node.radius + other.radius + 28);
      }
    }
  });

  it('never changes the layout of an explicit root', () => {
    expect(buildGraphView(entities[1], entities, links, 'World:world'))
      .toEqual(buildGraphView(entities[1], entities, links));
  });
});
