import { Link } from '../../../models/link.model';
import { GraphEdge, GraphNode, GraphView } from '../../../libs/relationship-graph/relationship-graph.types';
import { makeNodeKey } from '../../../libs/relationship-graph/relationship-graph.utils';
import { RelationGraphComponent } from './relation-graph.component';

function node(id: string, x: number): GraphNode {
  return {
    table: 'Character',
    id,
    label: id,
    imagePath: null,
    key: makeNodeKey('Character', id),
    isRoot: id === 'root',
    x,
    y: 350,
    radius: id === 'root' ? 52 : 34,
    degree: 1,
    isIsolated: false,
  };
}

function edge(id: string, from: GraphNode, to: GraphNode): GraphEdge {
  return {
    id,
    fromKey: from.key,
    toKey: to.key,
    name: id,
    link: new Link(id, from.table, from.id, to.table, to.id, id),
  };
}

describe('dense relation graph projection', () => {
  it('summarizes a dense pair and expands back to the original link ids', () => {
    const first = node('first', 200);
    const second = node('second', 800);
    const graph: GraphView = {
      nodes: [first, second],
      edges: [
        edge('forward-1', first, second),
        edge('forward-2', first, second),
        edge('forward-3', first, second),
        edge('reverse-1', second, first),
      ],
    };
    const component = Object.create(RelationGraphComponent.prototype) as RelationGraphComponent & Record<string, unknown>;
    component.graphView = graph;
    component.summarizeParallel = true;
    component.expandedPairKeys = new Set<string>();
    component.relationFocusDepth = 0;
    component.relationFocusRootKey = '';

    const summary = component.displayEdges(graph);

    expect(summary.length).toBe(1);
    expect(summary[0].visualSummary).toEqual(jasmine.objectContaining({
      count: 4,
      forwardCount: 3,
      reverseCount: 1,
    }));

    component.openEdge(summary[0]);
    const expanded = component.displayEdges(graph);
    expect(expanded.map(current => current.id)).toEqual(['forward-1', 'forward-2', 'forward-3', 'reverse-1']);
  });

  it('keeps focus transient and leaves the complete graph available for return', () => {
    const root = node('root', 200);
    const first = node('first', 450);
    const second = node('second', 700);
    const third = node('third', 950);
    const graph: GraphView = {
      nodes: [root, first, second, third],
      edges: [
        edge('root-first', root, first),
        edge('first-second', first, second),
        edge('second-third', second, third),
      ],
    };
    const component = Object.create(RelationGraphComponent.prototype) as RelationGraphComponent & Record<string, unknown>;
    component.graphView = graph;
    component.selectedNodeKey = root.key;
    component.summarizeParallel = false;
    component.relationFocusDepth = 0;
    component.relationFocusRootKey = '';

    component.setRelationFocus(1);
    expect(component.renderedGraph?.nodes.map(current => current.id)).toEqual(['root', 'first']);
    expect(component.renderedGraph?.edges.map(current => current.id)).toEqual(['root-first']);

    component.clearRelationFocus();
    expect(component.renderedGraph?.nodes.length).toBe(4);
    expect(component.renderedGraph?.edges.length).toBe(3);
  });
});
