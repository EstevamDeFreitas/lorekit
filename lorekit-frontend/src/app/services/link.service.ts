import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { Link } from '../models/link.model';
import { Image } from '../models/image.model';
import { buildGraphView } from '../libs/relationship-graph/relationship-graph.utils';
import { EntitySummary, GraphView } from '../libs/relationship-graph/relationship-graph.types';

export type SelectableTable = {
  value: string;
  label: string;
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

  getGraphForRoot(table: string, id: string): GraphView | null {
    const root = this.getEntitySummary(table, id);
    if (!root) return null;

    const links = this.getLinksForEntity(table, id);
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

    return buildGraphView(root, Array.from(entityMap.values()), links);
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
