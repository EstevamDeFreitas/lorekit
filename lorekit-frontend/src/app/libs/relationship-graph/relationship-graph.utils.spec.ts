import { Link } from '../../models/link.model';
import { EntitySummary } from './relationship-graph.types';
import {
  GRAPH_CANVAS_HEIGHT,
  GRAPH_CANVAS_WIDTH,
  MIN_NODE_GAP,
  UNRELATED_NODE_GAP,
  buildGraphView,
} from './relationship-graph.utils';

function entity(table: string, id: string, imagePath?: string): EntitySummary {
  return {
    table,
    id,
    label: id,
    imagePath: imagePath || null,
  };
}

function link(
  id: string,
  fromTable: string,
  fromId: string,
  toTable: string,
  toId: string,
): Link {
  return new Link(id, fromTable, fromId, toTable, toId, id);
}

describe('relationship graph utilities', () => {
  it('keeps isolated entities and supports a graph without a root', () => {
    const graph = buildGraphView(null, [
      entity('Character', 'connected'),
      entity('Species', 'isolated'),
    ], []);

    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(0);
    expect(graph.nodes.find(node => node.id === 'isolated')?.isIsolated).toBeTrue();
    expect(graph.nodes.every(node => node.radius > 0)).toBeTrue();
    expect(graph.nodes.some(node => node.isRoot)).toBeFalse();
  });

  it('places the root in the center and produces repeatable positions for cycles', () => {
    const root = entity('Character', 'root');
    const entities = [
      root,
      entity('Location', 'location'),
      entity('Species', 'species'),
      entity('Object', 'isolated'),
    ];
    const links = [
      link('root-location', 'Character', 'root', 'Location', 'location'),
      link('location-species', 'Location', 'location', 'Species', 'species'),
      link('species-root', 'Species', 'species', 'Character', 'root'),
    ];

    const first = buildGraphView(root, entities, links);
    const second = buildGraphView(root, entities, links);
    const firstPositions = first.nodes.map(node => [node.key, node.x, node.y]);
    const secondPositions = second.nodes.map(node => [node.key, node.x, node.y]);
    const rootNode = first.nodes.find(node => node.isRoot)!;

    expect(rootNode.x).toBe(first.width! / 2);
    expect(rootNode.y).toBe(first.height! / 2);
    expect(firstPositions).toEqual(secondPositions);
    expect(first.nodes.find(node => node.id === 'isolated')?.isIsolated).toBeTrue();
    expect(first.nodes.find(node => node.id === 'location')?.degree).toBe(2);
    expect(first.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y))).toBeTrue();
  });

  it('keeps extra space around the root for relation labels', () => {
    const root = entity('Character', 'root');
    const related = entity('Location', 'related');
    const graph = buildGraphView(root, [root, related], [
      link('root-related', 'Character', 'root', 'Location', 'related'),
    ]);
    const rootNode = graph.nodes.find(node => node.isRoot)!;
    const relatedNode = graph.nodes.find(node => node.id === 'related')!;
    const distance = Math.hypot(relatedNode.x - rootNode.x, relatedNode.y - rootNode.y);

    expect(distance).toBeGreaterThan(210);
  });

  it('keeps deeper nodes close to their parent branch', () => {
    const root = entity('Character', 'root');
    const parent = entity('Location', 'parent');
    const sibling = entity('Species', 'sibling');
    const child = entity('Object', 'child');
    const graph = buildGraphView(root, [root, parent, sibling, child], [
      link('root-parent', 'Character', 'root', 'Location', 'parent'),
      link('root-sibling', 'Character', 'root', 'Species', 'sibling'),
      link('parent-child', 'Location', 'parent', 'Object', 'child'),
    ]);
    const parentNode = graph.nodes.find(node => node.id === 'parent')!;
    const siblingNode = graph.nodes.find(node => node.id === 'sibling')!;
    const childNode = graph.nodes.find(node => node.id === 'child')!;
    const childToParent = Math.hypot(childNode.x - parentNode.x, childNode.y - parentNode.y);
    const childToSibling = Math.hypot(childNode.x - siblingNode.x, childNode.y - siblingNode.y);

    expect(childToParent).toBeLessThan(childToSibling);
  });

  it('keeps unrelated siblings apart at every tree level', () => {
    const root = entity('Character', 'root');
    const parent = entity('Location', 'parent');
    const children = Array.from({ length: 28 }, (_, index) => entity('Object', 'child-' + index));
    const grandchildren = children.map((child, index) => entity('Scene', 'grandchild-' + index));
    const links = [
      link('root-parent', 'Character', 'root', 'Location', 'parent'),
      ...children.map(child => link('parent-' + child.id, 'Location', 'parent', 'Object', child.id)),
      ...children.map((child, index) =>
        link('grandchild-' + index, 'Object', child.id, 'Scene', grandchildren[index].id)
      ),
    ];

    const graph = buildGraphView(root, [root, parent, ...children, ...grandchildren], links);
    const minimumPairDistance = (nodes: Array<{ x: number; y: number }>) => {
      let minimum = Number.POSITIVE_INFINITY;
      for (let firstIndex = 0; firstIndex < nodes.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex++) {
          minimum = Math.min(
            minimum,
            Math.hypot(nodes[secondIndex].x - nodes[firstIndex].x, nodes[secondIndex].y - nodes[firstIndex].y),
          );
        }
      }
      return minimum;
    };
    const childNodes = graph.nodes.filter(node => node.table === 'Object');
    const grandchildNodes = graph.nodes.filter(node => node.table === 'Scene');
    const expectedUnrelatedDistance =
      childNodes[0].radius * 2 + MIN_NODE_GAP + UNRELATED_NODE_GAP - 4;

    expect(minimumPairDistance(childNodes)).toBeGreaterThanOrEqual(expectedUnrelatedDistance);
    expect(minimumPairDistance(grandchildNodes)).toBeGreaterThanOrEqual(expectedUnrelatedDistance);
  });
  it('keeps every node visible on a large dense graph with a smaller fallback radius', () => {
    const entities = Array.from({ length: 181 }, (_, index) => entity('Character', 'entity-' + index));
    const links = entities.slice(1).map((current, index) =>
      link('link-' + index, 'Character', entities[index].id, 'Character', current.id)
    );

    const graph = buildGraphView(entities[0], entities, links);

    expect(graph.nodes.length).toBe(181);
    expect(graph.edges.length).toBe(180);
    expect(graph.nodes.filter(node => node.radius === 24).length).toBe(180);
    expect(graph.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y))).toBeTrue();
    expect(graph.width).toBeGreaterThan(GRAPH_CANVAS_WIDTH);
    expect(graph.height).toBeGreaterThan(GRAPH_CANVAS_HEIGHT);

    for (let firstIndex = 0; firstIndex < graph.nodes.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < graph.nodes.length; secondIndex++) {
        const first = graph.nodes[firstIndex];
        const second = graph.nodes[secondIndex];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        expect(distance).toBeGreaterThanOrEqual(first.radius + second.radius + MIN_NODE_GAP - 0.01);
      }
    }
  });
});
