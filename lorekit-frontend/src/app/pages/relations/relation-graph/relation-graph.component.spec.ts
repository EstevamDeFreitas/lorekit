import { Link } from '../../../models/link.model';
import { GraphEdge, GraphNode, GraphView } from '../../../libs/relationship-graph/relationship-graph.types';
import { makeNodeKey } from '../../../libs/relationship-graph/relationship-graph.utils';
import { RelationGraphComponent } from './relation-graph.component';

function node(table: string, id: string, x: number, y: number, isRoot = false): GraphNode {
  return {
    table,
    id,
    label: id,
    imagePath: null,
    key: makeNodeKey(table, id),
    isRoot,
    x,
    y,
    radius: isRoot ? 52 : 34,
    degree: 1,
    isIsolated: false,
  };
}

function edge(
  id: string,
  fromTable: string,
  fromId: string,
  toTable: string,
  toId: string,
): GraphEdge {
  return {
    id,
    fromKey: makeNodeKey(fromTable, fromId),
    toKey: makeNodeKey(toTable, toId),
    name: id,
    link: new Link(id, fromTable, fromId, toTable, toId, id),
  };
}

function createComponent(graphView: GraphView): RelationGraphComponent {
  const component = Object.create(RelationGraphComponent.prototype) as RelationGraphComponent;
  component.graphView = graphView;
  component.selectedNodeKey = graphView.nodes[0]?.key || '';
  component.editingLinkId = null;
  return component;
}

describe('RelationGraphComponent', () => {
  it('routes inverse, parallel and self-referential edges through distinct curves', () => {
    const firstNode = node('Character', 'first', 300, 350);
    const secondNode = node('Location', 'second', 900, 350);
    const edges = [
      edge('forward', 'Character', 'first', 'Location', 'second'),
      edge('reverse', 'Location', 'second', 'Character', 'first'),
      edge('parallel', 'Character', 'first', 'Location', 'second'),
      edge('self', 'Character', 'first', 'Character', 'first'),
    ];
    const component = createComponent({ nodes: [firstNode, secondNode], edges });

    const geometries = edges.map(currentEdge => component.edgeGeometry(currentEdge)!);

    expect(geometries.every(geometry => geometry !== null)).toBeTrue();
    expect(new Set(geometries.slice(0, 3).map(geometry => geometry.path)).size).toBe(3);
    expect(geometries[0].path).toContain(' Q ');
    expect(geometries[3].path).toContain(' C ');
    expect(geometries.every(geometry => Number.isFinite(geometry.labelX) && Number.isFinite(geometry.labelY))).toBeTrue();
  });

  it('keeps pan movement aligned with the cursor at different zoom levels', () => {
    const graph: GraphView = {
      nodes: [node('Character', 'first', 300, 350)],
      edges: [],
      width: 1200,
      height: 700,
    };
    const component = createComponent(graph) as any;
    component.graphSvg = {
      nativeElement: {
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
      },
    };

    const dragDistance = (zoomLevel: number): number => {
      component.zoomLevel = zoomLevel;
      component.panX = 0;
      component.panY = 0;
      component.startPan({ button: 0, clientX: 100, clientY: 100 } as MouseEvent);
      component.onPanMove({ clientX: 160, clientY: 160 } as MouseEvent);
      component.stopPan();
      return component.panX;
    };

    expect(dragDistance(1)).toBeCloseTo(90);
    expect(dragDistance(2)).toBeCloseTo(45);
  });

  it('keeps contextual create/edit actions scoped to the selected node', () => {
    const firstNode = node('Character', 'first', 300, 350);
    const secondNode = node('Character', 'second', 900, 350);
    const existingEdge = edge('existing', 'Character', 'first', 'Character', 'second');
    const graph: GraphView = { nodes: [firstNode, secondNode], edges: [existingEdge] };
    const component = createComponent(graph) as any;
    const createLink = jasmine.createSpy('createLink');
    const updateLink = jasmine.createSpy('updateLink');
    const deleteLink = jasmine.createSpy('deleteLink');
    const invertLinkDirection = jasmine.createSpy('invertLinkDirection').and.returnValue(
      new Link('existing', 'Character', 'second', 'Character', 'first', 'inverted'),
    );

    component.tableOptions = [{ value: 'Character', label: 'Characters' }];
    component.currentRootTable = '';
    component.currentRootId = '';
    component.currentWorldId = '';
    component.linkService = {
      getEntitiesByTable: jasmine.createSpy('getEntitiesByTable').and.returnValue([
        { table: 'Character', id: 'second', label: 'second' },
      ]),
      getEntitySummary: jasmine.createSpy('getEntitySummary').and.callFake((table: string, id: string) => ({
        table,
        id,
        label: id,
      })),
      getGraphForScope: jasmine.createSpy('getGraphForScope').and.returnValue(graph),
      createLink,
      updateLink,
      deleteLink,
      invertLinkDirection,
    };
    component.tabManager = { openTab: jasmine.createSpy('openTab'), openRelationsTab: jasmine.createSpy('openRelationsTab') };

    component.selectNode(firstNode);
    component.startNewRelation();
    component.relationDraft.toId = 'second';
    component.saveDraftRelation();

    expect(createLink).toHaveBeenCalledWith(jasmine.objectContaining({
      fromTable: 'Character',
      fromId: 'first',
      toTable: 'Character',
      toId: 'second',
    }));
    expect(component.relationEditorOpen).toBeFalse();

    component.startEditLink(existingEdge);
    expect(component.relationDraft.fromId).toBe('first');
    component.saveDraftRelation();
    expect(updateLink).toHaveBeenCalledWith('existing', jasmine.any(Object));

    component.startEditLink(existingEdge);
    component.invertEditingLink();
    expect(invertLinkDirection).toHaveBeenCalledWith('existing');
    component.deleteEditingLink();
    expect(deleteLink).toHaveBeenCalledWith('existing');
  });
});
