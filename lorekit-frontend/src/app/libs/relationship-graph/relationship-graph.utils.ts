import { Link } from '../../models/link.model';
import { EntitySummary, GraphEdge, GraphNode, GraphView, Point } from './relationship-graph.types';

export const GRAPH_CANVAS_WIDTH = 1200;
export const GRAPH_CANVAS_HEIGHT = 700;

export function makeNodeKey(table: string, id: string): string {
  return `${table}:${id}`;
}

export function buildGraphView(root: EntitySummary, entities: EntitySummary[], links: Link[]): GraphView {
  const nodeMap = new Map<string, GraphNode>();

  const rootKey = makeNodeKey(root.table, root.id);
  nodeMap.set(rootKey, {
    ...root,
    key: rootKey,
    isRoot: true,
    x: GRAPH_CANVAS_WIDTH / 2,
    y: GRAPH_CANVAS_HEIGHT / 2,
  });

  for (const entity of entities) {
    const key = makeNodeKey(entity.table, entity.id);
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        ...entity,
        key,
        isRoot: key === rootKey,
        x: 0,
        y: 0,
      });
    }
  }

  const edges: GraphEdge[] = links.map((link) => ({
    id: link.id,
    fromKey: makeNodeKey(link.fromTable, link.fromId),
    toKey: makeNodeKey(link.toTable, link.toId),
    name: link.name,
    link,
  }));

  const nodes = Array.from(nodeMap.values());
  applyRadialLayout(nodes, rootKey, GRAPH_CANVAS_WIDTH, GRAPH_CANVAS_HEIGHT);

  return {
    nodes,
    edges,
  };
}

export function applyRadialLayout(nodes: GraphNode[], rootKey: string, width: number, height: number): void {
  const root = nodes.find((n) => n.key === rootKey);
  if (!root) return;

  const centerX = width / 2;
  const centerY = height / 2;

  root.x = centerX;
  root.y = centerY;

  const others = nodes.filter((n) => n.key !== rootKey);
  if (!others.length) return;

  const radius = Math.max(180, Math.min(width, height) * 0.35);
  const angleStep = (Math.PI * 2) / others.length;

  others.forEach((node, index) => {
    const angle = index * angleStep - Math.PI / 2;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
  });
}

export function quadraticPath(from: Point, to: Point): string {
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - 60;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}
