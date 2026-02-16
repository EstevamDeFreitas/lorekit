import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { Link } from '../models/link.model';
import { Image } from '../models/image.model';
import { buildGraphView, makeNodeKey } from '../libs/relationship-graph/relationship-graph.utils';
import { EntitySummary, GraphView } from '../libs/relationship-graph/relationship-graph.types';

export type SelectableTable = {
  value: string;
  label: string;
};

type GraphOptions = {
  depth?: number;
  includeAllLevels?: boolean;
};

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
    Item: 'Itens'
  };

  private readonly selectableTables = ['World', 'Character', 'Location', 'Organization', 'Species', 'Culture', 'Document', 'Item'];

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getSelectableTables(): SelectableTable[] {
    return this.selectableTables.map((table) => ({
      value: table,
      label: this.tableLabels[table] || table
    }));
  }

  getEntitiesByTable(table: string): EntitySummary[] {
    if (!table) return [];

    const rows = this.crud.findAll(table) || [];

    return rows
      .map((row: any) => this.toEntitySummary(table, row))
      .sort((a: EntitySummary, b: EntitySummary) => a.label.localeCompare(b.label));
  }

  getEntitySummary(table: string, id: string): EntitySummary | null {
    if (!table || !id) return null;

    const row = this.crud.findById(table, id, [{ table: 'Image', firstOnly: false }]);
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

  getGraphForRoot(table: string, id: string, options: GraphOptions = {}): GraphView | null {
    const root = this.getEntitySummary(table, id);
    if (!root) return null;

    const depth = Math.max(1, options.depth ?? 2);
    const links = this.getLinksRecursive(table, id, depth, !!options.includeAllLevels);
    const entityMap = new Map<string, EntitySummary>();
    entityMap.set(`${root.table}:${root.id}`, root);

    for (const link of links) {
      const fromSummary = this.getEntitySummary(link.fromTable, link.fromId);
      if (fromSummary) {
        entityMap.set(`${fromSummary.table}:${fromSummary.id}`, fromSummary);
      }

      const toSummary = this.getEntitySummary(link.toTable, link.toId);
      if (toSummary) {
        entityMap.set(`${toSummary.table}:${toSummary.id}`, toSummary);
      }
    }

    const graph = buildGraphView(root, Array.from(entityMap.values()), links);
    this.applySavedPositions(graph, links, root);

    return graph;
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

  private getLinksRecursive(table: string, id: string, depth: number, includeAllLevels: boolean): Link[] {
    const startKey = makeNodeKey(table, id);
    const visitedNodes = new Set<string>([startKey]);
    const visitedLinks = new Map<string, Link>();

    let frontier = [{ table, id }];
    let level = 0;
    const maxDepth = includeAllLevels ? Number.MAX_SAFE_INTEGER : depth;

    while (frontier.length > 0 && level < maxDepth) {
      const nextFrontier: Array<{ table: string; id: string }> = [];

      for (const current of frontier) {
        const outgoing = this.crud.findAll('Link', { fromTable: current.table, fromId: current.id }) || [];
        const incoming = this.crud.findAll('Link', { toTable: current.table, toId: current.id }) || [];
        const allLinks = [...outgoing, ...incoming] as Link[];

        for (const link of allLinks) {
          if (!visitedLinks.has(link.id)) {
            visitedLinks.set(link.id, link);
          }

          const fromKey = makeNodeKey(link.fromTable, link.fromId);
          const toKey = makeNodeKey(link.toTable, link.toId);

          if (!visitedNodes.has(fromKey)) {
            visitedNodes.add(fromKey);
            nextFrontier.push({ table: link.fromTable, id: link.fromId });
          }

          if (!visitedNodes.has(toKey)) {
            visitedNodes.add(toKey);
            nextFrontier.push({ table: link.toTable, id: link.toId });
          }
        }
      }

      frontier = nextFrontier;
      level += 1;
    }

    return Array.from(visitedLinks.values());
  }

  private applySavedPositions(graph: GraphView, links: Link[], root: EntitySummary): void {
    const rootNode = graph.nodes.find((n) => n.isRoot);
    if (!rootNode) return;

    const nodeMap = new Map(graph.nodes.map((node) => [node.key, node]));

    for (const link of links) {
      const config = this.parseConfig(link.configJson);
      const positions = config.positions || {};

      for (const [nodeKey, rawOffset] of Object.entries(positions)) {
        const node = nodeMap.get(nodeKey);
        if (!node || node.isRoot) continue;

        const offset = rawOffset as { x?: number; y?: number };

        if (typeof offset?.x === 'number' && typeof offset?.y === 'number') {
          node.x = rootNode.x + offset.x;
          node.y = rootNode.y + offset.y;
        }
      }
    }
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
      imagePath: this.getPreferredImagePath(row?.Images)
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

    return null;
  }
}
