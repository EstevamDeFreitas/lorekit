import { RelationGraphComponent } from './relation-graph.component';

describe('Relation graph unrestricted zoom', () => {
  it('zooms beyond the old limits and returns to the same scale', () => {
    const component = Object.create(RelationGraphComponent.prototype) as RelationGraphComponent;
    component.graphView = { nodes: [], edges: [], width: 12000, height: 8000 };
    component.zoomLevel = 1;
    component.zoomStep = 0.1;
    component.panX = 0;
    component.panY = 0;
    for (let i = 0; i < 100; i++) component.zoomOut();
    expect(component.zoomLevel).toBeLessThan(0.5);
    expect(component.zoomLevel).toBeGreaterThan(0);
    expect(component.graphViewBox.split(' ').every(value => Number.isFinite(Number(value)))).toBeTrue();
    for (let i = 0; i < 200; i++) component.zoomIn();
    expect(component.zoomLevel).toBeGreaterThan(2.5);
    for (let i = 0; i < 100; i++) component.zoomOut();
    expect(component.zoomLevel).toBeCloseTo(1, 10);
    component.centerViewport();
    expect(component.zoomLevel).toBe(1);
  });
});
