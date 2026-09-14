import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { Link } from '../models/link.model';
import { Image } from '../models/image.model';
import { buildGraphView, makeNodeKey } from '../libs/relationship-graph/relationship-graph.utils';
import { EntitySummary, GraphView } from '../libs/relationship-graph/relationship-graph.types';
import { EntityWorldScopeService } from './entity-world-scope.service';

export type SelectableTable = {
  value: string;
  label: string;
};

type GraphOptions = {
  depth?: number;
  includeAllLevels?: boolean;
};

const SUMMARY_INCLUDES = [
  { table: 'Image', firstOnly: false },
  { table: 'Personalization', firstOnly: true },
];

function getConnectedComponent(rootKey: string, scopedLinks: Link[]): { keys: Set<string>; links: Link[] } {
  const keys = new Set<string>([rootKey]);
  const adjacency = new Map<string, Set<string>>();

  for (const link of scopedLinks) {
    const fromKey = makeNodeKey(link.fromTable, link.fromId);
    const toKey = makeNodeKey(link.toTable, link.toId);
    if (!adjacency.has(fromKey)) adjacency.set(fromKey, new Set<string>());
    if (!adjacency.has(toKey)) adjacency.set(toKey, new Set<string>());
    adjacency.get(fromKey)!.add(toKey);
    adjacency.get(toKey)!.add(fromKey);
  }

  const queue = [rootKey];
  for (let index = 0; index < queue.length; index++) {
    const neighbours = adjacency.get(queue[index]) || [];
    for (const neighbour of neighbours) {
      if (keys.has(neighbour)) continue;
      keys.add(neighbour);
      queue.push(neighbour);
    }
  }

  return {
    keys,
    links: scopedLinks.filter((link) => {
      const fromKey = makeNodeKey(link.fromTable, link.fromId);
      const toKey = makeNodeKey(link.toTable, link.toId);
      return keys.has(fromKey) && keys.has(toKey);
    }),
  };
}

@Injectable({
  providedIn: 'root'
})
export class LinkService {
  private crud: CrudHelper;

  private readonly tableLabels: Record<string, string> = {
    World: 'Mundos',
    Character: 'Personagens',
    Location: 'Localidades',
    Organization: 'Organizações',
    Species: 'Espécies',
    Culture: 'Culturas',
    Document: 'Documentos',
    Object: 'Objetos'
  };

  private readonly selectableTables = ['World', 'Character', 'Location', 'Organization', 'Species', 'Culture', 'Document', 'Object'];

  constructor(
    private dbProvider: DbProvider,
    private entityWorldScopeService: EntityWorldScopeService,
  ) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getSelectableTables(): SelectableTable[] {
    return this.selectableTables.map((table) => ({
      value: table,
      label: this.tableLabels[table] || table
    }));
  }

  getEntitiesByTable(table: string, worldId: string | null = null): EntitySummary[] {
    if (!table) return [];

    const scopeKeys = worldId
      ? this.entityWorldScopeService.getEntityKeysForWorld(worldId)
      : null;

    return this.getEntitiesByTableWithScope(table, scopeKeys);
  }

  getEntitiesForScope(worldId: string | null = null): EntitySummary[] {
    const scopeKeys = worldId
      ? this.entityWorldScopeService.getEntityKeysForWorld(worldId)
      : null;

    return this.selectableTables
      .flatMap((table) => this.getEntitiesByTableWithScope(table, scopeKeys))
      .sort((a: EntitySummary, b: EntitySummary) => a.label.localeCompare(b.label));
  }

  getWorldIdForEntity(table: string, id: string): string | null {
    return this.entityWorldScopeService.getWorldId(table, id);
  }

  getEntitySummary(table: string, id: string): EntitySummary | null {
    if (!table || !id) return null;

    const row = this.crud.findById(table, id, SUMMARY_INCLUDES);
    if (!row) return null;

    return this.toEntitySummary(table, row);
  }

  getLinksForEntity(table: string, id: string): Link[] {
    const outgoing = this.crud.findAll('Link', { fromTable: table, fromId: id }) || [];
    const incoming = this.crud.findAll('Link', { toTable: table, toId: id }) || [];

    const byId = new Map<string, Link>();
    [...outgoing, ...incoming].forEach((link: Link) => {
      byId.set(link.id, link);
    });

    return Array.from(byId.values());
  }

  getGraphForScope(
    rootReference: { table: string; id: string } | null,
    selectedWorldId: string | null = null,
  ): GraphView | null {
    const root = rootReference
      ? this.getEntitySummary(rootReference.table, rootReference.id)
      : null;

    if (rootReference && !root) {
      return null;
    }

    const rootWorldId = rootReference
      ? this.getWorldIdForEntity(rootReference.table, rootReference.id)
      : null;
    const effectiveWorldId = rootReference ? rootWorldId : selectedWorldId || null;
    const entities = this.getEntitiesForScope(effectiveWorldId);

    if (root && !entities.some((entity) => makeNodeKey(entity.table, entity.id) === makeNodeKey(root.table, root.id))) {
      entities.push(root);
    }

    const visibleKeys = new Set(
      entities.map((entity) => makeNodeKey(entity.table, entity.id))
    );
    const scopedLinks = (this.crud.findAll('Link') || [])
      .filter((link: Link) => {
        const fromKey = makeNodeKey(link.fromTable, link.fromId);
        const toKey = makeNodeKey(link.toTable, link.toId);
        return visibleKeys.has(fromKey) && visibleKeys.has(toKey);
      }) as Link[];

    const rootKey = root ? makeNodeKey(root.table, root.id) : null;
    const connectedComponent = rootKey
      ? getConnectedComponent(rootKey, scopedLinks)
      : null;
    const links = connectedComponent?.links || scopedLinks;
    const graphEntityKeys = connectedComponent?.keys || null;

    const graphEntities = graphEntityKeys
      ? entities.filter((entity) =>
          graphEntityKeys.has(makeNodeKey(entity.table, entity.id))
        )
      : entities;

    return buildGraphView(root, graphEntities, links,
      !rootReference && selectedWorldId ? makeNodeKey('World', selectedWorldId) : undefined);
  }

  getGraphForRoot(table: string, id: string, _options: GraphOptions = {}): GraphView | null {
    return this.getGraphForScope({ table, id }, null);
  }

  saveNodePosition(root: { table: string; id: string }, node: { table: string; id: string; x: number; y: number }, links: Link[]): void {
    if (!root?.table || !root?.id) return;
    if (!node?.table || !node?.id) return;

    const rootSummary = this.getEntitySummary(root.table, root.id);
    if (!rootSummary) return;

    const graph = this.getGraphForRoot(root.table, root.id, { includeAllLevels: true });
    if (!graph) return;

    const rootNode = graph.nodes.find((n) => n.isRoot);
    if (!rootNode) return;

    const nodeKey = makeNodeKey(node.table, node.id);
    const offset = {
      x: +(node.x - rootNode.x).toFixed(2),
      y: +(node.y - rootNode.y).toFixed(2),
    };

    const targetLinkIds = new Set(
      links
        .filter((link) => makeNodeKey(link.fromTable, link.fromId) === nodeKey || makeNodeKey(link.toTable, link.toId) === nodeKey)
        .map((link) => link.id)
    );

    for (const linkId of targetLinkIds) {
      const link = this.crud.findById('Link', linkId) as Link | null;
      if (!link) continue;

      const config = this.parseConfig(link.configJson);
      const positions = config.positions || {};
      positions[nodeKey] = offset;
      config.positions = positions;

      this.crud.update('Link', link.id, {
        configJson: JSON.stringify(config)
      });
    }
  }

  saveNodeCardSize(
    root: { table: string; id: string },
    node: { table: string; id: string; cardWidthScale: number; cardHeightScale: number },
    links: Link[]
  ): void {
    if (!root?.table || !root?.id) return;
    if (!node?.table || !node?.id) return;
    if (typeof node.cardWidthScale !== 'number' || !Number.isFinite(node.cardWidthScale)) return;
    if (typeof node.cardHeightScale !== 'number' || !Number.isFinite(node.cardHeightScale)) return;

    const nodeKey = makeNodeKey(node.table, node.id);
    const normalizedWidthScale = this.normalizeCardDimensionScale(node.cardWidthScale);
    const normalizedHeightScale = this.normalizeCardDimensionScale(node.cardHeightScale);

    const targetLinkIds = new Set(
      links
        .filter((link) => makeNodeKey(link.fromTable, link.fromId) === nodeKey || makeNodeKey(link.toTable, link.toId) === nodeKey)
        .map((link) => link.id)
    );

    for (const linkId of targetLinkIds) {
      const link = this.crud.findById('Link', linkId) as Link | null;
      if (!link) continue;

      const config = this.parseConfig(link.configJson);
      const nodeCardSizes = config.nodeCardSizes || {};
      nodeCardSizes[nodeKey] = {
        widthScale: normalizedWidthScale,
        heightScale: normalizedHeightScale,
      };
      config.nodeCardSizes = nodeCardSizes;

      this.crud.update('Link', link.id, {
        configJson: JSON.stringify(config)
      });
    }
  }

  createLink(payload: {
    fromTable: string;
    fromId: string;
    toTable: string;
    toId: string;
    name?: string;
    configJson?: string;
  }): Link {
    return this.crud.create('Link', {
      id: crypto.randomUUID(),
      fromTable: payload.fromTable,
      fromId: payload.fromId,
      toTable: payload.toTable,
      toId: payload.toId,
      name: payload.name || null,
      configJson: payload.configJson || null
    }) as Link;
  }

  updateLink(id: string, payload: Partial<Pick<Link, 'name' | 'configJson' | 'fromTable' | 'fromId' | 'toTable' | 'toId'>>): Link {
    return this.crud.update('Link', id, payload as Record<string, any>) as Link;
  }

  deleteLink(id: string): void {
    this.crud.delete('Link', id);
  }

  invertLinkDirection(id: string): Link | null {
    const current = this.crud.findById('Link', id) as Link | null;
    if (!current) return null;

    this.updateLink(id, {
      fromTable: current.toTable,
      fromId: current.toId,
      toTable: current.fromTable,
      toId: current.fromId,
    });

    return this.crud.findById('Link', id) as Link | null;
  }



  private getEntitiesByTableWithScope(table: string, scopeKeys: Set<string> | null): EntitySummary[] {
    const rows = this.crud.findAll(table, {}, SUMMARY_INCLUDES) || [];

    return rows
      .map((row: any) => this.toEntitySummary(table, row))
      .filter((entity: EntitySummary) => !scopeKeys || scopeKeys.has(makeNodeKey(entity.table, entity.id)))
      .sort((a: EntitySummary, b: EntitySummary) => a.label.localeCompare(b.label));
  }

  private normalizeCardDimensionScale(scale: number): number {
    return +Math.min(2.2, Math.max(0.6, scale)).toFixed(3);
  }

  private parseConfig(configJson?: string | null): any {
    if (!configJson) return {};

    try {
      return JSON.parse(configJson);
    }
    catch {
      return {};
    }
  }

  private toEntitySummary(table: string, row: any): EntitySummary {
    return {
      table,
      id: String(row.id),
      label: this.getEntityLabel(table, row),
      imagePath: this.getPreferredImagePath(row?.Images),
      Personalization : row.Personalization
    };
  }

  private getEntityLabel(table: string, row: any): string {
    if (table === 'Document') {
      return row.title || row.name || row.id;
    }

    return row.name || row.title || row.id;
  }

  private getPreferredImagePath(images: Image[] | undefined | null): string | null {
    if (!images || !Array.isArray(images) || images.length === 0) {
      return null;
    }

    const profile = images.find((img) => img.usageKey === 'profile');
    if (profile?.filePath) {
      return profile.filePath;
    }

    const fullbody = images.find((img) => img.usageKey === 'fullbody');
    if (fullbody?.filePath) {
      return fullbody.filePath;
    }

    return images.find((img) => !!img.filePath)?.filePath || null;
  }
}
