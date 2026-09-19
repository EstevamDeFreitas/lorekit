import { GraphEdge, GraphNode, GraphView, Point } from './relationship-graph.types';

export type DenseEdgeGeometry = {
  path: string;
  labelX: number;
  labelY: number;
  labelCandidates: Point[];
  congested: boolean;
};

export type GraphIndexes = {
  nodesByKey: Map<string, GraphNode>;
  edgesByPair: Map<string, GraphEdge[]>;
  edgesByNode: Map<string, GraphEdge[]>;
  routeBuckets: Map<string, GraphNode[]>;
  routeCellSize: number;
};

type GeometryOptions = {
  forceCenterLane?: boolean;
};

const LANE_GAP = 42;
const ROUTE_CLEARANCE = 18;
const ROUTE_VARIATIONS = [0, 54, -54, 108, -108, 162, -162];

export function createGraphIndexes(graph: GraphView): GraphIndexes {
  const nodesByKey = new Map(graph.nodes.map(node => [node.key, node]));
  const edgesByPair = new Map<string, GraphEdge[]>();
  const edgesByNode = new Map<string, GraphEdge[]>();
  const routeCellSize = 220;
  const routeBuckets = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    const key = getRouteCellKey(node.x, node.y, routeCellSize);
    const bucket = routeBuckets.get(key) || [];
    bucket.push(node);
    routeBuckets.set(key, bucket);
  }

  for (const edge of graph.edges) {
    const pair = getUndirectedPairKey(edge);
    const pairEdges = edgesByPair.get(pair) || [];
    pairEdges.push(edge);
    edgesByPair.set(pair, pairEdges);

    for (const key of new Set([edge.fromKey, edge.toKey])) {
      const nodeEdges = edgesByNode.get(key) || [];
      nodeEdges.push(edge);
      edgesByNode.set(key, nodeEdges);
    }
  }

  for (const pairEdges of edgesByPair.values()) {
    pairEdges.sort((first, second) => first.id.localeCompare(second.id));
  }

  return { nodesByKey, edgesByPair, edgesByNode, routeBuckets, routeCellSize };
}

export function getUndirectedPairKey(edge: GraphEdge): string {
  return edge.fromKey <= edge.toKey
    ? edge.fromKey + '|' + edge.toKey
    : edge.toKey + '|' + edge.fromKey;
}

export function calculateDenseEdgeGeometry(
  graph: GraphView,
  edge: GraphEdge,
  indexes: GraphIndexes = createGraphIndexes(graph),
  options: GeometryOptions = {},
): DenseEdgeGeometry | null {
  const summary = edge.visualSummary;
  const sourceEdge = summary
    ? graph.edges.find(candidate => candidate.id === summary.sourceEdgeId) || edge
    : edge;
  const from = indexes.nodesByKey.get(sourceEdge.fromKey);
  const to = indexes.nodesByKey.get(sourceEdge.toKey);
  if (!from || !to) return null;

  const pairEdges = indexes.edgesByPair.get(getUndirectedPairKey(sourceEdge)) || [sourceEdge];
  if (from.key === to.key) {
    return createLoopGeometry(from, sourceEdge, pairEdges, options.forceCenterLane === true);
  }

  const canonicalFromKey = sourceEdge.fromKey <= sourceEdge.toKey
    ? sourceEdge.fromKey
    : sourceEdge.toKey;
  const canonicalToKey = canonicalFromKey === sourceEdge.fromKey
    ? sourceEdge.toKey
    : sourceEdge.fromKey;
  const canonicalFrom = indexes.nodesByKey.get(canonicalFromKey)!;
  const canonicalTo = indexes.nodesByKey.get(canonicalToKey)!;
  const canonicalDx = canonicalTo.x - canonicalFrom.x;
  const canonicalDy = canonicalTo.y - canonicalFrom.y;
  const canonicalDistance = Math.max(1, Math.hypot(canonicalDx, canonicalDy));
  const canonicalNormal = {
    x: -canonicalDy / canonicalDistance,
    y: canonicalDx / canonicalDistance,
  };
  const midpoint = getMidpoint(from, to);
  const start = getBoundaryPoint(from, to);
  const end = getBoundaryPoint(to, from);
  const hasBothDirections = pairEdges.some(candidate =>
    candidate.fromKey === canonicalFromKey && candidate.toKey === canonicalToKey,
  ) && pairEdges.some(candidate =>
    candidate.fromKey === canonicalToKey && candidate.toKey === canonicalFromKey,
  );
  const sameDirectionEdges = pairEdges.filter(candidate =>
    candidate.fromKey === sourceEdge.fromKey && candidate.toKey === sourceEdge.toKey,
  );
  const directionIndex = Math.max(0, sameDirectionEdges.findIndex(candidate => candidate.id === sourceEdge.id));
  const laneOffset = options.forceCenterLane
    ? 0
    : getLaneOffset(directionIndex, sameDirectionEdges.length, sourceEdge.fromKey === canonicalFromKey, hasBothDirections);
  const variations = options.forceCenterLane
    ? [0]
    : ROUTE_VARIATIONS.map(variation => laneOffset + variation);

  let selectedControl = getControl(midpoint, canonicalNormal, variations[0]);
  let selectedObstacles = countRouteObstacles(start, selectedControl, end, indexes, from.key, to.key);
  let selectedScore = getRouteScore(selectedObstacles, variations[0], laneOffset);

  for (const offset of variations.slice(1)) {
    const control = getControl(midpoint, canonicalNormal, offset);
    const obstacles = countRouteObstacles(start, control, end, indexes, from.key, to.key);
    const score = getRouteScore(obstacles, offset, laneOffset);
    if (score < selectedScore) {
      selectedScore = score;
      selectedControl = control;
      selectedObstacles = obstacles;
    }
    if (obstacles === 0) break;
  }

  const labelCandidates = getQuadraticLabelCandidates(start, selectedControl, end, canonicalNormal);
  const label = labelCandidates[0] || getQuadraticPoint(start, selectedControl, end, 0.5);

  return {
    path: 'M ' + start.x + ' ' + start.y + ' Q ' + selectedControl.x + ' ' + selectedControl.y + ' ' + end.x + ' ' + end.y,
    labelX: label.x,
    labelY: label.y,
    labelCandidates,
    congested: selectedObstacles > 0,
  };
}

export function allocateNonOverlappingLabels(
  graph: GraphView,
  displayedEdges: GraphEdge[],
  geometries: Map<string, DenseEdgeGeometry>,
  options: {
    selectedNodeKey?: string;
    editingLinkId?: string | null;
    hoveredEdgeId?: string | null;
    graphUnitsPerPixel?: number;
  } = {},
): Map<string, Point> {
  const graphUnitsPerPixel = Math.max(0.35, Math.min(2.5, options.graphUnitsPerPixel || 1));
  const nodeClearance = 16 * graphUnitsPerPixel;
  const occupiedLabels: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  const positions = new Map<string, Point>();
  const orderedEdges = displayedEdges
    .map((edge, index) => ({ edge, index, priority: getLabelPriority(edge, graph, options) }))
    .sort((first, second) => first.priority - second.priority || first.index - second.index);

  for (const item of orderedEdges) {
    const geometry = geometries.get(item.edge.id);
    if (!geometry) continue;
    const label = getDisplayLabel(item.edge);
    const width = Math.max(44, label.length * 7 + 18) * graphUnitsPerPixel;
    const height = 18 * graphUnitsPerPixel;
    const candidates = geometry.labelCandidates.length
      ? geometry.labelCandidates
      : [{ x: geometry.labelX, y: geometry.labelY }];

    for (const candidate of candidates) {
      const box = {
        left: candidate.x - width / 2,
        right: candidate.x + width / 2,
        top: candidate.y - height,
        bottom: candidate.y + 4 * graphUnitsPerPixel,
      };
      if (graph.nodes.some(node =>
        node.key !== item.edge.fromKey &&
        node.key !== item.edge.toKey &&
        circleIntersectsBox(node, box, nodeClearance)
      )) {
        continue;
      }
      if (occupiedLabels.some(other => boxesOverlap(box, other))) {
        continue;
      }
      occupiedLabels.push(box);
      positions.set(item.edge.id, candidate);
      break;
    }
  }

  return positions;
}

function getLabelPriority(edge: GraphEdge, graph: GraphView, options: { selectedNodeKey?: string; editingLinkId?: string | null; hoveredEdgeId?: string | null }): number {
  if (options.editingLinkId && edge.id === options.editingLinkId) return 0;
  if (options.hoveredEdgeId && edge.id === options.hoveredEdgeId) return 1;
  if (options.selectedNodeKey && (edge.fromKey === options.selectedNodeKey || edge.toKey === options.selectedNodeKey)) return 10;
  if (graph.nodes.some(node => node.isRoot && (node.key === edge.fromKey || node.key === edge.toKey))) return 20;
  return 30;
}

function getDisplayLabel(edge: GraphEdge): string {
  if (edge.visualSummary) {
    return '×' + edge.visualSummary.count;
  }
  return edge.name?.trim() || 'Relação';
}

function getLaneOffset(
  directionIndex: number,
  directionCount: number,
  isCanonicalDirection: boolean,
  hasBothDirections: boolean,
): number {
  if (hasBothDirections) {
    return (isCanonicalDirection ? 1 : -1) * (directionIndex + 0.5) * LANE_GAP;
  }
  return (directionIndex - (directionCount - 1) / 2) * LANE_GAP;
}

function createLoopGeometry(
  node: GraphNode,
  edge: GraphEdge,
  pairEdges: GraphEdge[],
  forceCenterLane: boolean,
): DenseEdgeGeometry {
  const loopIndex = forceCenterLane
    ? 0
    : Math.max(0, pairEdges.findIndex(candidate => candidate.id === edge.id));
  const angle = -Math.PI / 2 + loopIndex * 0.68;
  const endAngle = angle + 0.92;
  const radius = node.radius + 74 + loopIndex * 18;
  const start = {
    x: node.x + Math.cos(angle) * node.radius * 0.82,
    y: node.y + Math.sin(angle) * node.radius * 0.82,
  };
  const end = {
    x: node.x + Math.cos(endAngle) * node.radius * 0.82,
    y: node.y + Math.sin(endAngle) * node.radius * 0.82,
  };
  const controlOne = {
    x: node.x + Math.cos(angle - 0.62) * radius,
    y: node.y + Math.sin(angle - 0.62) * radius,
  };
  const controlTwo = {
    x: node.x + Math.cos(endAngle + 0.62) * radius,
    y: node.y + Math.sin(endAngle + 0.62) * radius,
  };
  const label = {
    x: node.x + Math.cos(angle + 0.46) * (radius + 6),
    y: node.y + Math.sin(angle + 0.46) * (radius + 6),
  };
  const labelCandidates = [
    label,
    { x: label.x + 28, y: label.y },
    { x: label.x - 28, y: label.y },
    { x: label.x, y: label.y + 24 },
  ];

  return {
    path: 'M ' + start.x + ' ' + start.y + ' C ' + controlOne.x + ' ' + controlOne.y + ' ' + controlTwo.x + ' ' + controlTwo.y + ' ' + end.x + ' ' + end.y,
    labelX: label.x,
    labelY: label.y,
    labelCandidates,
    congested: false,
  };
}

function getBoundaryPoint(from: GraphNode, to: GraphNode): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return {
    x: from.x + dx / distance * from.radius,
    y: from.y + dy / distance * from.radius,
  };
}

function getMidpoint(from: GraphNode, to: GraphNode): Point {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

function getControl(midpoint: Point, normal: Point, offset: number): Point {
  return {
    x: midpoint.x + normal.x * offset,
    y: midpoint.y + normal.y * offset,
  };
}

function getRouteScore(obstacles: number, offset: number, preferredOffset: number): number {
  return obstacles * 100000 + Math.abs(offset - preferredOffset);
}

function countRouteObstacles(
  start: Point,
  control: Point,
  end: Point,
  indexes: GraphIndexes,
  fromKey: string,
  toKey: string,
): number {
  let obstacles = 0;
  for (const node of getRouteCandidates(indexes, start, control, end)) {
    if (node.key === fromKey || node.key === toKey) continue;
    const clearance = node.radius + ROUTE_CLEARANCE;
    for (let index = 1; index < 24; index++) {
      const point = getQuadraticPoint(start, control, end, index / 24);
      if (Math.hypot(point.x - node.x, point.y - node.y) < clearance) {
        obstacles++;
        break;
      }
    }
  }
  return obstacles;
}

function getRouteCandidates(indexes: GraphIndexes, start: Point, control: Point, end: Point): GraphNode[] {
  const padding = 96;
  const minX = Math.min(start.x, control.x, end.x) - padding;
  const maxX = Math.max(start.x, control.x, end.x) + padding;
  const minY = Math.min(start.y, control.y, end.y) - padding;
  const maxY = Math.max(start.y, control.y, end.y) + padding;
  const minCellX = Math.floor(minX / indexes.routeCellSize);
  const maxCellX = Math.floor(maxX / indexes.routeCellSize);
  const minCellY = Math.floor(minY / indexes.routeCellSize);
  const maxCellY = Math.floor(maxY / indexes.routeCellSize);
  const seen = new Set<string>();
  const candidates: GraphNode[] = [];

  for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (const node of indexes.routeBuckets.get(getRouteCellKey(cellX * indexes.routeCellSize, cellY * indexes.routeCellSize, indexes.routeCellSize)) || []) {
        if (seen.has(node.key)) continue;
        seen.add(node.key);
        candidates.push(node);
      }
    }
  }

  return candidates;
}

function getRouteCellKey(x: number, y: number, cellSize: number): string {
  return Math.floor(x / cellSize) + ':' + Math.floor(y / cellSize);
}
function getQuadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function getQuadraticLabelCandidates(start: Point, control: Point, end: Point, normal: Point): Point[] {
  const candidates: Point[] = [];
  for (const t of [0.32, 0.5, 0.68]) {
    const point = getQuadraticPoint(start, control, end, t);
    candidates.push(
      { x: point.x, y: point.y - 7 },
      { x: point.x + normal.x * 28, y: point.y + normal.y * 28 - 7 },
      { x: point.x - normal.x * 28, y: point.y - normal.y * 28 - 7 },
      { x: point.x + normal.x * 52, y: point.y + normal.y * 52 - 7 },
      { x: point.x - normal.x * 52, y: point.y - normal.y * 52 - 7 },
    );
  }
  return candidates;
}

function circleIntersectsBox(
  node: GraphNode,
  box: { left: number; right: number; top: number; bottom: number },
  clearance: number,
): boolean {
  const closestX = Math.max(box.left, Math.min(node.x, box.right));
  const closestY = Math.max(box.top, Math.min(node.y, box.bottom));
  return Math.hypot(node.x - closestX, node.y - closestY) < node.radius + clearance;
}

function boxesOverlap(
  first: { left: number; right: number; top: number; bottom: number },
  second: { left: number; right: number; top: number; bottom: number },
): boolean {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}
