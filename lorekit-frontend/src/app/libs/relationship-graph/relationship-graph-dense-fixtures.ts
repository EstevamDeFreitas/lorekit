import { Link } from '../../models/link.model';
import { GraphEdge, GraphNode, GraphView } from './relationship-graph.types';
import { makeNodeKey } from './relationship-graph.utils';

export type DenseRelationFixture = {
  name: string;
  graph: GraphView;
};

export function createDenseRelationFixtures(): DenseRelationFixture[] {
  const inverseNodes = [fixtureNode('Character', 'first', 180, 350), fixtureNode('Location', 'second', 820, 350)];
  const inverseEdges = [fixtureEdge('inverse-forward', inverseNodes[0], inverseNodes[1]), fixtureEdge('inverse-reverse', inverseNodes[1], inverseNodes[0])];

  const parallelNodes = [fixtureNode('Character', 'source', 180, 350), fixtureNode('Location', 'target', 820, 350)];
  const parallelEdges = Array.from({ length: 10 }, (_, index) => index % 2 === 0
    ? fixtureEdge('parallel-' + index, parallelNodes[0], parallelNodes[1])
    : fixtureEdge('parallel-' + index, parallelNodes[1], parallelNodes[0]));

  const starCenter = fixtureNode('Character', 'hub', 500, 350, 44);
  const starNodes = [starCenter, ...Array.from({ length: 80 }, (_, index) => fixtureNode('Character', 'leaf-' + index, 500 + Math.cos(index) * 300, 350 + Math.sin(index) * 300))];
  const starEdges = starNodes.slice(1).map((leaf, index) => fixtureEdge('star-' + index, starCenter, leaf));

  const loopNode = fixtureNode('Object', 'loop', 500, 350);
  const loopEdges = Array.from({ length: 4 }, (_, index) => fixtureEdge('loop-' + index, loopNode, loopNode));

  const nonPlanarNodes = Array.from({ length: 5 }, (_, index) => fixtureNode('Organization', 'k5-' + index, 200 + index * 150, index % 2 ? 540 : 160));
  const nonPlanarEdges: GraphEdge[] = [];
  for (let first = 0; first < nonPlanarNodes.length; first++) {
    for (let second = first + 1; second < nonPlanarNodes.length; second++) {
      nonPlanarEdges.push(fixtureEdge('k5-' + first + '-' + second, nonPlanarNodes[first], nonPlanarNodes[second]));
    }
  }

  return [
    { name: 'inverse', graph: { nodes: inverseNodes, edges: inverseEdges } },
    { name: 'parallel-10', graph: { nodes: parallelNodes, edges: parallelEdges } },
    { name: 'hub-80', graph: { nodes: starNodes, edges: starEdges } },
    { name: 'self-loops-4', graph: { nodes: [loopNode], edges: loopEdges } },
    { name: 'non-planar-k5', graph: { nodes: nonPlanarNodes, edges: nonPlanarEdges } },
  ];
}

function fixtureNode(table: string, id: string, x: number, y: number, radius = 34): GraphNode {
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

function fixtureEdge(id: string, from: GraphNode, to: GraphNode): GraphEdge {
  return {
    id,
    fromKey: from.key,
    toKey: to.key,
    name: id,
    link: new Link(id, from.table, from.id, to.table, to.id, id),
  };
}
