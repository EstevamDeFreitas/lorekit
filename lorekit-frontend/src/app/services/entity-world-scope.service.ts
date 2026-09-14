import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';

type RelationshipRow = {
  parentTable?: string;
  parentId?: string;
  entityTable?: string;
  entityId?: string;
};

type EntityReference = {
  table: string;
  id: string;
};

@Injectable({
  providedIn: 'root',
})
export class EntityWorldScopeService {
  private readonly crud: CrudHelper;

  constructor(dbProvider: DbProvider) {
    this.crud = dbProvider.getCrudHelper();
  }

  getWorldId(table: string, id: string): string | null {
    if (!table || !id) {
      return null;
    }

    if (table === 'World') {
      return this.crud.findById('World', id) ? id : null;
    }

    const parentMap = this.buildParentMap();
    const queue = [...(parentMap.get(this.makeKey(table, id)) || [])];
    const visited = new Set<string>();

    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const key = this.makeKey(current.table, current.id);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (current.table === 'World') {
        return this.crud.findById('World', current.id) ? current.id : null;
      }

      queue.push(...(parentMap.get(key) || []));
    }

    return null;
  }

  getEntityKeysForWorld(worldId: string | null | undefined): Set<string> {
    if (!worldId) {
      return new Set<string>();
    }

    if (!this.crud.findById('World', worldId)) {
      return new Set<string>();
    }

    const childMap = this.buildChildMap();
    const visited = new Set<string>();
    const queue: EntityReference[] = [{ table: 'World', id: worldId }];

    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const key = this.makeKey(current.table, current.id);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      queue.push(...(childMap.get(key) || []));
    }

    return visited;
  }

  belongsToWorld(table: string, id: string, worldId: string | null | undefined): boolean {
    if (!worldId || !table || !id) {
      return false;
    }

    return this.getEntityKeysForWorld(worldId).has(this.makeKey(table, id));
  }

  private buildParentMap(): Map<string, EntityReference[]> {
    const parentMap = new Map<string, EntityReference[]>();

    for (const row of this.getRelationships()) {
      if (!row.entityTable || !row.entityId || !row.parentTable || !row.parentId) {
        continue;
      }

      const childKey = this.makeKey(row.entityTable, row.entityId);
      const parents = parentMap.get(childKey) || [];
      parents.push({ table: row.parentTable, id: row.parentId });
      parentMap.set(childKey, parents);
    }

    return parentMap;
  }

  private buildChildMap(): Map<string, EntityReference[]> {
    const childMap = new Map<string, EntityReference[]>();

    for (const row of this.getRelationships()) {
      if (!row.entityTable || !row.entityId || !row.parentTable || !row.parentId) {
        continue;
      }

      const parentKey = this.makeKey(row.parentTable, row.parentId);
      const children = childMap.get(parentKey) || [];
      children.push({ table: row.entityTable, id: row.entityId });
      childMap.set(parentKey, children);
    }

    return childMap;
  }

  private getRelationships(): RelationshipRow[] {
    return (this.crud.findAll('Relationship') || []) as RelationshipRow[];
  }

  private makeKey(table: string, id: string): string {
    return `${table}:${id}`;
  }
}
