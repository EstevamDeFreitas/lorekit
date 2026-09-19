import { GraphView, Point } from './relationship-graph.types';

// Only used for the world overview; explicit entity roots keep their own layout.
export function layoutWorldOverview(graph: GraphView, worldKey: string): void {
  const world = graph.nodes.find(node => node.key === worldKey);
  if (!world) return;
  world.radius = 52;
  const nodes = graph.nodes.filter(node => node !== world);
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const worldNeighbours = new Set<string>();
  const adjacency = new Map(nodes.map(node => [node.key, new Set<string>()]));
  for (const edge of graph.edges) {
    if (edge.fromKey === edge.toKey) continue;
    if (edge.fromKey === worldKey && byKey.has(edge.toKey)) {
      worldNeighbours.add(edge.toKey);
      continue;
    }
    if (edge.toKey === worldKey && byKey.has(edge.fromKey)) {
      worldNeighbours.add(edge.fromKey);
      continue;
    }
    if (!byKey.has(edge.fromKey) || !byKey.has(edge.toKey)) continue;
    adjacency.get(edge.fromKey)!.add(edge.toKey);
    adjacency.get(edge.toKey)!.add(edge.fromKey);
  }
  // Connected components occupy neighbouring sectors, independent of entity type.
  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const node of nodes) {
    if (visited.has(node.key)) continue;
    const group = [node.key];
    visited.add(node.key);
    for (let i = 0; i < group.length; i++) {
      for (const neighbour of adjacency.get(group[i])!) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        group.push(neighbour);
      }
    }
    groups.push(group);
  }
  groups.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const sizes = groups.map(group => Math.max(80, Math.sqrt(group.length) * 100));
  const circumference = sizes.reduce((sum, size) => sum + size * 2 + 80, 0);
  const orbit = Math.max(300, circumference / (2 * Math.PI), ...sizes.map(size => size + 180));
  const anchors = new Map<string, Point>();
  let angle = -Math.PI / 2;
  groups.forEach((group, index) => {
    const sector = (sizes[index] * 2 + 80) / circumference * Math.PI * 2;
    const groupAngle = angle + sector / 2;
    angle += sector;
    const anchor = { x: Math.cos(groupAngle) * orbit, y: Math.sin(groupAngle) * orbit };
    group.forEach((key, position) => {
      const node = byKey.get(key)!;
      // A golden-angle seed avoids stacking nodes on the same radial line.
      const localAngle = position * Math.PI * (3 - Math.sqrt(5));
      const radius = position === 0 ? 0 : 110 * Math.sqrt(position);
      node.x = anchor.x + Math.cos(localAngle) * radius;
      node.y = anchor.y + Math.sin(localAngle) * radius;
      anchors.set(key, anchor);
    });
  });

  // Edges attached to the world use an inner, deterministic orbit so the central
  // world remains legible without inventing links between otherwise unrelated nodes.
  const worldLinkedKeys = nodes
    .filter(node => worldNeighbours.has(node.key))
    .map(node => node.key)
    .sort();
  const worldInnerRadius = Math.max(250, 180 + Math.sqrt(worldLinkedKeys.length) * 36);
  worldLinkedKeys.forEach((key, index) => {
    const node = byKey.get(key)!;
    const angle = -Math.PI / 2 + index / Math.max(1, worldLinkedKeys.length) * Math.PI * 2;
    const anchor = {
      x: Math.cos(angle) * worldInnerRadius,
      y: Math.sin(angle) * worldInnerRadius,
    };
    node.x = anchor.x;
    node.y = anchor.y;
    anchors.set(key, anchor);
  });
  for (let iteration = 0; iteration < 180; iteration++) {
    const forces = new Map(nodes.map(node => [node.key, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const spacing = a.radius + b.radius + 90;
        const strength = Math.min(20, 6000 / (distance * distance) + Math.max(0, spacing - distance) * 0.2);
        const fx = dx / distance * strength, fy = dy / distance * strength;
        forces.get(a.key)!.x -= fx;
        forces.get(a.key)!.y -= fy;
        forces.get(b.key)!.x += fx;
        forces.get(b.key)!.y += fy;
      }
    }
    // Use unique undirected neighbours so parallel links do not collapse spacing.
    for (const [key, neighbours] of adjacency) {
      for (const neighbour of neighbours) {
        if (key >= neighbour) continue;
        const a = byKey.get(key)!, b = byKey.get(neighbour)!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const spring = Math.max(-12, Math.min(12, (distance - 230) * 0.035));
        const fx = dx / distance * spring, fy = dy / distance * spring;
        forces.get(key)!.x += fx;
        forces.get(key)!.y += fy;
        forces.get(neighbour)!.x -= fx;
        forces.get(neighbour)!.y -= fy;
      }
    }
    for (const node of nodes) {
      const anchor = anchors.get(node.key)!;
      const force = forces.get(node.key)!;
      node.x += Math.max(-20, Math.min(20, force.x + (anchor.x - node.x) * 0.012));
      node.y += Math.max(-20, Math.min(20, force.y + (anchor.y - node.y) * 0.012));
      const distance = Math.hypot(node.x, node.y);
      const clearance = 180 + node.radius;
      if (distance < clearance) {
        const angle = distance > 0.01 ? Math.atan2(node.y, node.x) : Math.atan2(anchor.y, anchor.x);
        node.x = Math.cos(angle) * clearance;
        node.y = Math.sin(angle) * clearance;
      }
    }
  }

  // Keep the world exactly central while fitting all labels into the viewBox.
  const halfWidth = Math.max(600, ...nodes.map(node => Math.abs(node.x) + node.radius + 130));
  const halfHeight = Math.max(350, ...nodes.map(node => Math.abs(node.y) + node.radius + 80));
  graph.width = Math.ceil(halfWidth * 2);
  graph.height = Math.ceil(halfHeight * 2);
  world.x = graph.width / 2;
  world.y = graph.height / 2;
  for (const node of nodes) {
    node.x += world.x;
    node.y += world.y;
  }
}
