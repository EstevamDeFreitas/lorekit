import { Link } from '../../models/link.model';
import { layoutWorldOverview } from './world-overview-layout';
import { EntitySummary, GraphEdge, GraphNode, GraphView, Point } from './relationship-graph.types';

export const GRAPH_CANVAS_WIDTH = 1200;
export const GRAPH_CANVAS_HEIGHT = 700;
export const MIN_NODE_GAP = 28;
const SEPARATION_BUFFER = 1;

const DEFAULT_NODE_RADIUS = 34;
const ROOT_NODE_RADIUS = 52;
const ROOT_ORBIT_RADIUS = 320;
const ROOT_LEVEL_GAP = 220;
const MAX_LAYOUT_ITERATIONS = 120;
const LAYOUT_PADDING = 24;

type LayoutPlan = {
  nodeRadius: number;
  minimumDistance: number;
  connectedFirstRadius: number;
  levelGap: number;
  isolatedFirstRadius: number;
  ringGap: number;
};

export function makeNodeKey(table: string, id: string): string {
  return table + ':' + id;
}

export function buildGraphView(root: EntitySummary | null, entities: EntitySummary[], links: Link[], overviewWorldKey?: string): GraphView {
  const entityMap = new Map<string, EntitySummary>();

  if (root) {
    entityMap.set(makeNodeKey(root.table, root.id), root);
  }

  for (const entity of entities) {
    entityMap.set(makeNodeKey(entity.table, entity.id), entity);
  }

  const edges: GraphEdge[] = links
    .filter(link => {
      const fromKey = makeNodeKey(link.fromTable, link.fromId);
      const toKey = makeNodeKey(link.toTable, link.toId);
      return entityMap.has(fromKey) && entityMap.has(toKey);
    })
    .map(link => ({
      id: link.id,
      fromKey: makeNodeKey(link.fromTable, link.fromId),
      toKey: makeNodeKey(link.toTable, link.toId),
      name: link.name,
      link,
    }));

  const degreeByKey = new Map<string, number>();
  for (const edge of edges) {
    degreeByKey.set(edge.fromKey, (degreeByKey.get(edge.fromKey) || 0) + 1);
    degreeByKey.set(edge.toKey, (degreeByKey.get(edge.toKey) || 0) + 1);
  }

  const rootKey = root ? makeNodeKey(root.table, root.id) : '';
  const nodeCount = entityMap.size;
  const nodes = Array.from(entityMap.entries())
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, entity]) => {
      const degree = degreeByKey.get(key) || 0;
      const isRoot = key === rootKey;
      return {
        ...entity,
        key,
        isRoot,
        x: GRAPH_CANVAS_WIDTH / 2,
        y: GRAPH_CANVAS_HEIGHT / 2,
        radius: isRoot ? ROOT_NODE_RADIUS : getNodeRadius(nodeCount),
        degree,
        isIsolated: degree === 0,
      } satisfies GraphNode;
    });

  if (!root && overviewWorldKey && nodes.some(node => node.key === overviewWorldKey)) {
    const graph: GraphView = { nodes, edges };
    layoutWorldOverview(graph, overviewWorldKey);
    return graph;
  }

  const layoutSize = getLayoutSize(nodes, edges, rootKey);
  applyAutoLayout(nodes, edges, rootKey, layoutSize.width, layoutSize.height);

  return {
    nodes,
    edges,
    width: layoutSize.width,
    height: layoutSize.height,
  };
}

export function applyAutoLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rootKey: string,
  width: number,
  height: number,
): void {
  if (!nodes.length) {
    return;
  }

  const center = { x: width / 2, y: height / 2 };
  const root = nodes.find(node => node.key === rootKey);
  const movableNodes = nodes.filter(node => node.key !== rootKey);
  const connectedNodes = movableNodes.filter(node => !node.isIsolated);
  const isolatedNodes = movableNodes.filter(node => node.isIsolated);
  const minDimension = Math.min(width, height);
  const plan = getLayoutPlan(nodes, rootKey);
  const depthByKey = root
    ? getNodeDepths(rootKey, edges)
    : new Map<string, number>();

  if (root) {
    root.x = center.x;
    root.y = center.y;
  }

  if (root) {
    placeRootedConnectedNodes(
      connectedNodes,
      edges,
      depthByKey,
      center,
      plan,
    );
  } else {
    placeOnRings(
      connectedNodes,
      center,
      plan.connectedFirstRadius,
      plan.ringGap,
      plan.minimumDistance,
    );
  }
  placeOnRings(
    isolatedNodes,
    center,
    plan.isolatedFirstRadius,
    plan.ringGap,
    plan.minimumDistance,
  );

  const targets = new Map<string, Point>();
  for (const node of movableNodes) {
    const dx = node.x - center.x;
    const dy = node.y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    const depth = depthByKey.get(node.key) || 1;
    const targetRadius = node.isIsolated
      ? plan.isolatedFirstRadius
      : root
        ? getDepthRadius(depth, plan)
        : plan.connectedFirstRadius;
    targets.set(node.key, {
      x: center.x + dx / distance * targetRadius,
      y: center.y + dy / distance * targetRadius,
    });
  }

  const nodeByKey = new Map(nodes.map(node => [node.key, node]));
  const iterations = nodes.length > 160
    ? 45
    : nodes.length > 80
      ? 75
      : Math.min(MAX_LAYOUT_ITERATIONS, 100);

  for (let iteration = 0; iteration < iterations; iteration++) {
    const forces = new Map<string, Point>(
      movableNodes.map(node => [node.key, { x: 0, y: 0 }]),
    );

    for (let firstIndex = 0; firstIndex < movableNodes.length; firstIndex++) {
      const first = movableNodes[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < movableNodes.length; secondIndex++) {
        const second = movableNodes[secondIndex];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.01) {
          const angle = stableAngle(first.key, second.key);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const minimumDistance = first.radius + second.radius + MIN_NODE_GAP + SEPARATION_BUFFER;
        const overlap = Math.max(0, minimumDistance - distance);
        const strength = Math.min(18, 3600 / Math.max(distance * distance, 900) + overlap * 0.14);
        const ux = dx / distance;
        const uy = dy / distance;
        const firstForce = forces.get(first.key)!;
        const secondForce = forces.get(second.key)!;
        firstForce.x -= ux * strength;
        firstForce.y -= uy * strength;
        secondForce.x += ux * strength;
        secondForce.y += uy * strength;
      }
    }

    for (const edge of edges) {
      if (edge.fromKey === edge.toKey) {
        continue;
      }

      const from = nodeByKey.get(edge.fromKey);
      const to = nodeByKey.get(edge.toKey);
      if (!from || !to) {
        continue;
      }

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desiredDistance = root ? getDesiredEdgeDistance(from, to, depthByKey, plan) : 150;
      const spring = Math.max(-10, Math.min(10, (distance - desiredDistance) * 0.012));
      const ux = dx / distance;
      const uy = dy / distance;
      const fromForce = forces.get(from.key);
      const toForce = forces.get(to.key);
      if (fromForce) {
        fromForce.x += ux * spring;
        fromForce.y += uy * spring;
      }
      if (toForce) {
        toForce.x -= ux * spring;
        toForce.y -= uy * spring;
      }
    }

    for (const node of movableNodes) {
      const force = forces.get(node.key)!;
      const target = targets.get(node.key)!;
      const targetStrength = node.isIsolated ? 0.006 : root ? 0.005 : 0.0025;
      force.x += (target.x - node.x) * targetStrength;
      force.y += (target.y - node.y) * targetStrength;
      force.x += (center.x - node.x) * 0.0012;
      force.y += (center.y - node.y) * 0.0012;

      const nextX = node.x + Math.max(-24, Math.min(24, force.x));
      const nextY = node.y + Math.max(-24, Math.min(24, force.y));
      const constrained = constrainToCircle(
        { x: nextX, y: nextY },
        center,
        Math.max(0, minDimension / 2 - node.radius - LAYOUT_PADDING),
      );
      node.x = constrained.x;
      node.y = constrained.y;
    }

    if (root) {
      root.x = center.x;
      root.y = center.y;
    }
  }

  enforceMinimumSeparation(nodes, root, center, Math.max(0, minDimension / 2 - LAYOUT_PADDING));
}

export function quadraticPath(from: Point, to: Point): string {
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - 60;
  return 'M ' + from.x + ' ' + from.y + ' Q ' + controlX + ' ' + controlY + ' ' + to.x + ' ' + to.y;
}

function getLayoutSize(nodes: GraphNode[], edges: GraphEdge[], rootKey: string): { width: number; height: number } {
  const movableNodes = nodes.filter(node => node.key !== rootKey);
  if (!movableNodes.length) {
    return {
      width: GRAPH_CANVAS_WIDTH,
      height: GRAPH_CANVAS_HEIGHT,
    };
  }

  const plan = getLayoutPlan(nodes, rootKey);
  const depthByKey = rootKey ? getNodeDepths(rootKey, edges) : new Map<string, number>();
  const connectedNodes = movableNodes.filter(node => !node.isIsolated);
  const isolatedCount = movableNodes.length - connectedNodes.length;
  const connectedCapacity = getRingCapacity(plan.connectedFirstRadius, plan.minimumDistance);
  const isolatedCapacity = getRingCapacity(plan.isolatedFirstRadius, plan.minimumDistance);
  const connectedOuterRadius = rootKey
    ? getRootedOuterRadius(connectedNodes, depthByKey, plan)
    : getOuterRingRadius(
        connectedNodes.length,
        plan.connectedFirstRadius,
        connectedCapacity,
        plan.ringGap,
      );
  const isolatedOuterRadius = getOuterRingRadius(
    isolatedCount,
    plan.isolatedFirstRadius,
    isolatedCapacity,
    plan.ringGap,
  );
  const outerRadius = Math.max(connectedOuterRadius, isolatedOuterRadius);
  const requiredDimension = Math.ceil(2 * (outerRadius + plan.nodeRadius + LAYOUT_PADDING));

  return {
    width: Math.max(GRAPH_CANVAS_WIDTH, requiredDimension),
    height: Math.max(GRAPH_CANVAS_HEIGHT, requiredDimension),
  };
}

function getLayoutPlan(nodes: GraphNode[], rootKey: string): LayoutPlan {
  const root = nodes.find(node => node.key === rootKey);
  const movableNodes = nodes.filter(node => node.key !== rootKey);
  const nodeRadius = movableNodes[0]?.radius || DEFAULT_NODE_RADIUS;
  const minimumDistance = nodeRadius * 2 + MIN_NODE_GAP + SEPARATION_BUFFER;
  const rootClearance = (root?.radius || 0) + nodeRadius + MIN_NODE_GAP;

  return {
    nodeRadius,
    minimumDistance,
    connectedFirstRadius: Math.max(root ? ROOT_ORBIT_RADIUS : 230, rootClearance),
    levelGap: Math.max(ROOT_LEVEL_GAP, minimumDistance * 2),
    isolatedFirstRadius: Math.max(270, rootClearance),
    ringGap: minimumDistance,
  };
}

function getOuterRingRadius(
  count: number,
  firstRadius: number,
  capacity: number,
  ringGap: number,
): number {
  if (!count) {
    return 0;
  }

  const ringCount = Math.ceil(count / Math.max(1, capacity));
  return firstRadius + Math.max(0, ringCount - 1) * ringGap;
}

function getNodeDepths(rootKey: string, edges: GraphEdge[]): Map<string, number> {
  const depthByKey = new Map<string, number>([[rootKey, 0]]);
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!adjacency.has(edge.fromKey)) adjacency.set(edge.fromKey, new Set<string>());
    if (!adjacency.has(edge.toKey)) adjacency.set(edge.toKey, new Set<string>());
    adjacency.get(edge.fromKey)!.add(edge.toKey);
    adjacency.get(edge.toKey)!.add(edge.fromKey);
  }

  const queue = [rootKey];
  for (let index = 0; index < queue.length; index++) {
    const currentKey = queue[index];
    const currentDepth = depthByKey.get(currentKey) || 0;
    for (const neighbour of adjacency.get(currentKey) || []) {
      if (depthByKey.has(neighbour)) continue;
      depthByKey.set(neighbour, currentDepth + 1);
      queue.push(neighbour);
    }
  }

  return depthByKey;
}

function getDepthRadius(depth: number, plan: LayoutPlan): number {
  return plan.connectedFirstRadius + Math.max(0, depth - 1) * plan.levelGap;
}

function getRootedOuterRadius(
  nodes: GraphNode[],
  depthByKey: Map<string, number>,
  plan: LayoutPlan,
): number {
  const countByDepth = new Map<number, number>();
  for (const node of nodes) {
    if (node.isIsolated) continue;
    const depth = Math.max(1, depthByKey.get(node.key) || 1);
    countByDepth.set(depth, (countByDepth.get(depth) || 0) + 1);
  }

  let outerRadius = 0;
  for (const [depth, count] of countByDepth) {
    const depthRadius = getDepthRadius(depth, plan);
    const capacity = getRingCapacity(depthRadius, plan.minimumDistance);
    const ringCount = Math.ceil(count / Math.max(1, capacity));
    outerRadius = Math.max(
      outerRadius,
      depthRadius + Math.max(0, ringCount - 1) * plan.ringGap,
    );
  }

  return outerRadius;
}

function placeRootedConnectedNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  depthByKey: Map<string, number>,
  center: Point,
  plan: LayoutPlan,
): void {
  if (!nodes.length) return;

  const nodesByDepth = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const depth = Math.max(1, depthByKey.get(node.key) || 1);
    const depthNodes = nodesByDepth.get(depth) || [];
    depthNodes.push(node);
    nodesByDepth.set(depth, depthNodes);
  }

  const angleByKey = new Map<string, number>();
  const depths = Array.from(nodesByDepth.keys()).sort((first, second) => first - second);
  for (const depth of depths) {
    const depthNodes = nodesByDepth.get(depth)!.sort((first, second) => first.key.localeCompare(second.key));
    const depthRadius = getDepthRadius(depth, plan);

    if (depth === 1) {
      placeOnRings(depthNodes, center, depthRadius, plan.ringGap, plan.minimumDistance);
      for (const node of depthNodes) {
        angleByKey.set(node.key, Math.atan2(node.y - center.y, node.x - center.x));
      }
      continue;
    }

    const nodesPerRing = getRingCapacity(depthRadius, plan.minimumDistance);
    for (let start = 0; start < depthNodes.length; start += nodesPerRing) {
      const ringNodes = depthNodes.slice(start, start + nodesPerRing);
      const ringRadius = depthRadius + Math.floor(start / nodesPerRing) * plan.ringGap;
      const preferred = ringNodes.map(node => ({
        node,
        ...getPreferredParentPlacement(node, depth, edges, depthByKey, angleByKey),
      }));
      placeNodesByPreferredAngles(preferred, center, ringRadius);
      for (const item of preferred) {
        angleByKey.set(item.node.key, Math.atan2(item.node.y - center.y, item.node.x - center.x));
      }
    }
  }
}

function getPreferredParentPlacement(
  node: GraphNode,
  depth: number,
  edges: GraphEdge[],
  depthByKey: Map<string, number>,
  angleByKey: Map<string, number>,
): { angle: number; clusterKey: string } {
  const parentAngles: number[] = [];
  const parentKeys: string[] = [];
  for (const edge of edges) {
    const neighbour = edge.fromKey === node.key
      ? edge.toKey
      : edge.toKey === node.key
        ? edge.fromKey
        : null;
    if (!neighbour || depthByKey.get(neighbour) !== depth - 1) continue;
    const angle = angleByKey.get(neighbour);
    if (angle === undefined) continue;
    parentAngles.push(angle);
    parentKeys.push(neighbour);
  }

  if (parentAngles.length) {
    return {
      angle: circularMean(parentAngles),
      clusterKey: Array.from(new Set(parentKeys)).sort().join('|'),
    };
  }

  return {
    angle: stableAngle(node.key, 'depth-' + depth),
    clusterKey: 'fallback:' + node.key,
  };
}

function placeNodesByPreferredAngles(
  items: Array<{ node: GraphNode; angle: number; clusterKey: string }>,
  center: Point,
  radius: number,
): void {
  if (!items.length) return;

  const groups = new Map<string, Array<{ node: GraphNode; angle: number; clusterKey: string }>>();
  for (const item of items) {
    const group = groups.get(item.clusterKey) || [];
    group.push(item);
    groups.set(item.clusterKey, group);
  }

  const orderedGroups = Array.from(groups.entries())
    .map(([clusterKey, groupItems]) => ({
      clusterKey,
      items: groupItems.sort((first, second) => first.node.key.localeCompare(second.node.key)),
      angle: circularMean(groupItems.map(item => item.angle)),
    }))
    .sort((first, second) => {
      const angleDifference = normalizeAngle(first.angle) - normalizeAngle(second.angle);
      return angleDifference || first.clusterKey.localeCompare(second.clusterKey);
    });
  const slotStep = (Math.PI * 2) / items.length;
  const rotations: number[] = [];
  const placements: Array<{ item: { node: GraphNode; angle: number; clusterKey: string }; slot: number }> = [];
  let slotIndex = 0;

  for (const group of orderedGroups) {
    const centerSlot = slotIndex + (group.items.length - 1) / 2;
    rotations.push(normalizeAngle(group.angle - (-Math.PI / 2 + centerSlot * slotStep)));
    group.items.forEach((item, index) => placements.push({ item, slot: slotIndex + index }));
    slotIndex += group.items.length;
  }

  const rotation = circularMean(rotations);
  for (const placement of placements) {
    const angle = -Math.PI / 2 + placement.slot * slotStep + rotation;
    placement.item.node.x = center.x + Math.cos(angle) * radius;
    placement.item.node.y = center.y + Math.sin(angle) * radius;
  }
}

function circularMean(angles: number[]): number {
  if (!angles.length) return 0;
  const vector = angles.reduce(
    (sum, angle) => ({
      x: sum.x + Math.cos(angle),
      y: sum.y + Math.sin(angle),
    }),
    { x: 0, y: 0 },
  );
  return Math.hypot(vector.x, vector.y) < 0.0001
    ? angles[0]
    : Math.atan2(vector.y, vector.x);
}

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

function getDesiredEdgeDistance(
  from: GraphNode,
  to: GraphNode,
  depthByKey: Map<string, number>,
  plan: LayoutPlan,
): number {
  if (from.isRoot || to.isRoot) return plan.connectedFirstRadius;

  const fromDepth = depthByKey.get(from.key);
  const toDepth = depthByKey.get(to.key);
  if (fromDepth !== undefined && toDepth !== undefined && Math.abs(fromDepth - toDepth) === 1) {
    return plan.levelGap;
  }

  return Math.max(150, plan.minimumDistance + MIN_NODE_GAP);
}

function placeOnRings(
  nodes: GraphNode[],
  center: Point,
  firstRadius: number,
  ringGap: number,
  minimumDistance: number,
): void {
  if (!nodes.length) {
    return;
  }

  const nodesPerRing = getRingCapacity(firstRadius, minimumDistance);
  for (let index = 0; index < nodes.length; index++) {
    const ringIndex = Math.floor(index / nodesPerRing);
    const indexInRing = index % nodesPerRing;
    const remainingOnRing = Math.min(nodesPerRing, nodes.length - ringIndex * nodesPerRing);
    const angle = -Math.PI / 2 + (indexInRing / Math.max(1, remainingOnRing)) * Math.PI * 2;
    const radius = firstRadius + ringIndex * ringGap;
    nodes[index].x = center.x + Math.cos(angle) * radius;
    nodes[index].y = center.y + Math.sin(angle) * radius;
  }
}

function getRingCapacity(radius: number, minimumDistance: number): number {
  let capacity = Math.max(1, Math.floor((Math.PI * 2 * radius) / minimumDistance));
  while (capacity > 1 && 2 * radius * Math.sin(Math.PI / capacity) < minimumDistance) {
    capacity--;
  }
  while (2 * radius * Math.sin(Math.PI / (capacity + 1)) >= minimumDistance) {
    capacity++;
  }
  return capacity;
}

function enforceMinimumSeparation(
  nodes: GraphNode[],
  root: GraphNode | undefined,
  center: Point,
  boundaryRadius: number,
): void {
  const passes = nodes.length > 160 ? 24 : 40;

  for (let pass = 0; pass < passes; pass++) {
    let moved = false;

    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex++) {
      const first = nodes[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex++) {
        const second = nodes[secondIndex];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.01) {
          const angle = stableAngle(first.key, second.key);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const minimumDistance = first.radius + second.radius + MIN_NODE_GAP + SEPARATION_BUFFER;
        if (distance >= minimumDistance) {
          continue;
        }

        const correction = minimumDistance - distance;
        const ux = dx / distance;
        const uy = dy / distance;
        const firstIsFixed = root?.key === first.key;
        const secondIsFixed = root?.key === second.key;

        if (!firstIsFixed && !secondIsFixed) {
          first.x -= ux * correction / 2;
          first.y -= uy * correction / 2;
          second.x += ux * correction / 2;
          second.y += uy * correction / 2;
        } else if (!firstIsFixed) {
          first.x -= ux * correction;
          first.y -= uy * correction;
        } else if (!secondIsFixed) {
          second.x += ux * correction;
          second.y += uy * correction;
        }

        moved = true;
      }
    }

    for (const node of nodes) {
      if (root?.key === node.key) {
        node.x = center.x;
        node.y = center.y;
        continue;
      }

      const constrained = constrainToCircle(
        node,
        center,
        Math.max(0, boundaryRadius - node.radius),
      );
      node.x = constrained.x;
      node.y = constrained.y;
    }

    if (!moved) {
      break;
    }
  }

  if (root) {
    root.x = center.x;
    root.y = center.y;
  }
}

function constrainToCircle(point: Point, center: Point, radius: number): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius || distance === 0) {
    return point;
  }
  return {
    x: center.x + dx / distance * radius,
    y: center.y + dy / distance * radius,
  };
}

function getNodeRadius(nodeCount: number): number {
  if (nodeCount > 140) {
    return 24;
  }
  if (nodeCount > 70) {
    return 28;
  }
  return DEFAULT_NODE_RADIUS;
}

function stableAngle(firstKey: string, secondKey: string): number {
  let hash = 2166136261;
  for (const char of firstKey + '|' + secondKey) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2;
}
