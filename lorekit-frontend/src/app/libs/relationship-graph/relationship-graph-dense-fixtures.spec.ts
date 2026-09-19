import { allocateNonOverlappingLabels, calculateDenseEdgeGeometry, createGraphIndexes } from './relationship-graph-geometry';
import { createDenseRelationFixtures } from './relationship-graph-dense-fixtures';

describe('dense relation graph fixtures', () => {
  it('keeps deterministic fixtures complete and geometrically addressable', () => {
    const firstRun = createDenseRelationFixtures();
    const secondRun = createDenseRelationFixtures();

    expect(firstRun.map(fixture => fixture.name)).toEqual(secondRun.map(fixture => fixture.name));
    for (let index = 0; index < firstRun.length; index++) {
      const first = firstRun[index];
      const second = secondRun[index];
      expect(first.graph.nodes.map(node => [node.key, node.x, node.y])).toEqual(
        second.graph.nodes.map(node => [node.key, node.x, node.y]),
      );

      const indexes = createGraphIndexes(first.graph);
      const geometries = new Map(first.graph.edges.map(edge => [
        edge.id,
        calculateDenseEdgeGeometry(first.graph, edge, indexes)!,
      ]));
      const labels = allocateNonOverlappingLabels(first.graph, first.graph.edges, geometries);

      expect(geometries.size).toBe(first.graph.edges.length);
      expect(Array.from(geometries.values()).every(geometry =>
        Number.isFinite(geometry.labelX) && Number.isFinite(geometry.labelY) && geometry.path.length > 0,
      )).toBeTrue();
      expect(labels.size).toBeGreaterThan(0);
    }
  });

  it('keeps the 80-link hub within a bounded synchronous geometry pass', () => {
    const fixture = createDenseRelationFixtures().find(current => current.name === 'hub-80')!;
    const indexes = createGraphIndexes(fixture.graph);
    const startedAt = performance.now();
    const geometries = fixture.graph.edges.map(edge => calculateDenseEdgeGeometry(fixture.graph, edge, indexes)!);
    const elapsed = performance.now() - startedAt;

    expect(geometries.length).toBe(80);
    expect(elapsed).toBeLessThan(2000);
  });
});
