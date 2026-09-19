import { Link } from '../../models/link.model';
import { GraphEdge, GraphNode, GraphView } from './relationship-graph.types';
import {
  allocateNonOverlappingLabels,
  calculateDenseEdgeGeometry,
  createGraphIndexes,
} from './relationship-graph-geometry';
import { makeNodeKey } from './relationship-graph.utils';

function node(table: string, id: string, x: number, y: number, radius = 34): GraphNode {
  return {
    table,
    id,
    label: id,
    imagePath: null,
    key: makeNodeKey(table, id),
    isRoot: false,
    x,
    y,
    radius,
    degree: 1,
    isIsolated: false,
  };
}

function edge(id: string, from: GraphNode, to: GraphNode, name = id): GraphEdge {
  return {
    id,
    fromKey: from.key,
    toKey: to.key,
    name,
    link: new Link(id, from.table, from.id, to.table, to.id, name),
  };
}

describe('dense relation graph geometry', () => {
  it('keeps inverse links on distinct lanes while preserving their direction', () => {
    const first = node('Character', 'first', 200, 350);
    const second = node('Location', 'second', 800, 350);
    const forward = edge('forward', first, second);
    const reverse = edge('reverse', second, first);
    const graph: GraphView = { nodes: [first, second], edges: [forward, reverse] };
    const indexes = createGraphIndexes(graph);

    const forwardGeometry = calculateDenseEdgeGeometry(graph, forward, indexes)!;
    const reverseGeometry = calculateDenseEdgeGeometry(graph, reverse, indexes)!;

    expect(forwardGeometry.path).not.toBe(reverseGeometry.path);
    expect(forwardGeometry.path.startsWith('M ' + (first.x + first.radius))).toBeTrue();
    expect(reverseGeometry.path.startsWith('M ' + (second.x - second.radius))).toBeTrue();
  });

  it('routes around a third node when a corridor is available', () => {
    const first = node('Character', 'first', 150, 350);
    const obstacle = node('Location', 'obstacle', 475, 350, 42);
    const second = node('Character', 'second', 800, 350);
    const relation = edge('relation', first, second, 'long relation');
    const graph: GraphView = { nodes: [first, obstacle, second], edges: [relation] };

    const geometry = calculateDenseEdgeGeometry(graph, relation, createGraphIndexes(graph))!;

    expect(geometry.congested).toBeFalse();
    expect(geometry.path).not.toContain(' Q 475 350');
  });

  it('allocates label candidates without overlapping each other', () => {
    const first = node('Character', 'first', 200, 350);
    const second = node('Location', 'second', 800, 350);
    const firstEdge = edge('first-edge', first, second, 'first relation');
    const secondEdge = edge('second-edge', second, first, 'second relation');
    const graph: GraphView = { nodes: [first, second], edges: [firstEdge, secondEdge] };
    const indexes = createGraphIndexes(graph);
    const geometries = new Map([
      [firstEdge.id, calculateDenseEdgeGeometry(graph, firstEdge, indexes)!],
      [secondEdge.id, calculateDenseEdgeGeometry(graph, secondEdge, indexes)!],
    ]);

    const positions = allocateNonOverlappingLabels(graph, graph.edges, geometries);

    expect(positions.size).toBe(2);
    expect(positions.get(firstEdge.id)).not.toEqual(positions.get(secondEdge.id));
  });
});
