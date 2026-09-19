import { Link } from '../../models/link.model';
import { buildGraphView } from './relationship-graph.utils';

describe('world overview links', () => {
  it('keeps direct world links visible and places their nodes on the inner orbit', () => {
    const world = { table: 'World', id: 'world', label: 'World' };
    const linked = { table: 'Character', id: 'linked', label: 'Linked' };
    const unrelated = { table: 'Character', id: 'unrelated', label: 'Unrelated' };
    const graph = buildGraphView(null, [world, linked, unrelated], [
      new Link('world-linked', 'World', 'world', 'Character', 'linked', 'contains'),
    ], 'World:world');
    const center = graph.nodes.find(node => node.key === 'World:world')!;
    const linkedNode = graph.nodes.find(node => node.key === 'Character:linked')!;
    const unrelatedNode = graph.nodes.find(node => node.key === 'Character:unrelated')!;

    expect(graph.edges.map(edge => edge.id)).toEqual(['world-linked']);
    expect(Math.hypot(linkedNode.x - center.x, linkedNode.y - center.y)).toBeLessThan(420);
    expect(unrelatedNode.isIsolated).toBeTrue();
  });
});
