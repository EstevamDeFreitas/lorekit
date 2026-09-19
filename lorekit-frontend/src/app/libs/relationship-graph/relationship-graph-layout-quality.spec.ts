import { Link } from '../../models/link.model';
import { EntitySummary, GraphEdge, GraphNode } from './relationship-graph.types';
import { buildGraphView, makeNodeKey } from './relationship-graph.utils';

function entity(table: string, id: string): EntitySummary {
  return { table, id, label: id, imagePath: null };
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

function distance(first: GraphNode, second: GraphNode): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function orientation(first: GraphNode, second: GraphNode, third: GraphNode): number {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function segmentsCross(first: GraphEdge, second: GraphEdge, nodesByKey: Map<string, GraphNode>): boolean {
  if (new Set([first.fromKey, first.toKey, second.fromKey, second.toKey]).size < 4) return false;

  const firstFrom = nodesByKey.get(first.fromKey)!;
  const firstTo = nodesByKey.get(first.toKey)!;
  const secondFrom = nodesByKey.get(second.fromKey)!;
  const secondTo = nodesByKey.get(second.toKey)!;
  const firstStart = orientation(firstFrom, firstTo, secondFrom);
  const firstEnd = orientation(firstFrom, firstTo, secondTo);
  const secondStart = orientation(secondFrom, secondTo, firstFrom);
  const secondEnd = orientation(secondFrom, secondTo, firstTo);

  return firstStart * firstEnd < 0 && secondStart * secondEnd < 0;
}

describe('relationship graph layout quality', () => {
  it('brings directly related peers closer than an unrelated peer in another branch', () => {
    const root = entity('Character', 'root');
    const left = entity('Location', 'left');
    const right = entity('Location', 'right');
    const leftPeer = entity('Object', 'left-peer');
    const leftOther = entity('Object', 'left-other');
    const rightPeer = entity('Object', 'right-peer');
    const rightOther = entity('Object', 'right-other');
    const graph = buildGraphView(root, [root, left, right, leftPeer, leftOther, rightPeer, rightOther], [
      link('root-left', 'Character', 'root', 'Location', 'left'),
      link('root-right', 'Character', 'root', 'Location', 'right'),
      link('left-peer', 'Location', 'left', 'Object', 'left-peer'),
      link('left-other', 'Location', 'left', 'Object', 'left-other'),
      link('right-peer', 'Location', 'right', 'Object', 'right-peer'),
      link('right-other', 'Location', 'right', 'Object', 'right-other'),
      link('peer-connection', 'Object', 'left-peer', 'Object', 'right-peer'),
    ]);
    const nodesByKey = new Map(graph.nodes.map(node => [node.key, node]));

    expect(distance(nodesByKey.get(makeNodeKey('Object', 'left-peer'))!, nodesByKey.get(makeNodeKey('Object', 'right-peer'))!))
      .toBeLessThan(distance(nodesByKey.get(makeNodeKey('Object', 'left-peer'))!, nodesByKey.get(makeNodeKey('Object', 'right-other'))!));
  });

  it('reorders a criss-cross branch so the two direct relations do not cross each other', () => {
    const root = entity('Character', 'root');
    const left = entity('Location', 'left');
    const right = entity('Location', 'right');
    const leftTop = entity('Object', 'left-top');
    const leftBottom = entity('Object', 'left-bottom');
    const rightTop = entity('Object', 'right-top');
    const rightBottom = entity('Object', 'right-bottom');
    const graph = buildGraphView(root, [root, left, right, leftTop, leftBottom, rightTop, rightBottom], [
      link('root-left', 'Character', 'root', 'Location', 'left'),
      link('root-right', 'Character', 'root', 'Location', 'right'),
      link('left-top', 'Location', 'left', 'Object', 'left-top'),
      link('left-bottom', 'Location', 'left', 'Object', 'left-bottom'),
      link('right-top', 'Location', 'right', 'Object', 'right-top'),
      link('right-bottom', 'Location', 'right', 'Object', 'right-bottom'),
      link('cross-top', 'Object', 'left-top', 'Object', 'right-bottom'),
      link('cross-bottom', 'Object', 'left-bottom', 'Object', 'right-top'),
    ]);
    const nodesByKey = new Map(graph.nodes.map(node => [node.key, node]));
    const crossEdges = graph.edges.filter(edge => edge.id.startsWith('cross-'));

    expect(segmentsCross(crossEdges[0], crossEdges[1], nodesByKey)).toBeFalse();
  });
});
