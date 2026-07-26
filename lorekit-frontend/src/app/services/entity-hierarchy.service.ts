import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';

@Injectable({
  providedIn: 'root'
})
export class EntityHierarchyService {
  private readonly crud: CrudHelper;

  constructor(dbProvider: DbProvider) {
    this.crud = dbProvider.getCrudHelper();
  }

  canReparent(table: string, entityId: string, parentId: string | null): boolean {
    try {
      this.assertCanReparent(table, entityId, parentId);
      return true;
    } catch {
      return false;
    }
  }

  reparent(table: string, entityId: string, parentId: string | null): void {
    this.assertCanReparent(table, entityId, parentId);

    this.crud.deleteWhen('Relationship', {
      parentTable: table,
      entityTable: table,
      entityId
    });

    if (parentId) {
      this.crud.create('Relationship', {
        parentTable: table,
        parentId,
        entityTable: table,
        entityId
      });
    }
  }

  getParentId(table: string, entityId: string): string | null {
    const relationship = this.crud.findFirst('Relationship', {
      parentTable: table,
      entityTable: table,
      entityId
    }) as { parentId?: string } | null;

    return relationship?.parentId || null;
  }

  private assertCanReparent(table: string, entityId: string, parentId: string | null): void {
    if (!table || !entityId) {
      throw new Error('Entidade inválida para mover.');
    }

    if (entityId === parentId) {
      throw new Error('Uma entidade não pode ser filha de si mesma.');
    }

    if (!this.crud.findById(table, entityId)) {
      throw new Error('Entidade de origem não encontrada.');
    }

    if (!parentId) {
      return;
    }

    if (!this.crud.findById(table, parentId)) {
      throw new Error('Entidade de destino não encontrada.');
    }

    if (this.getWorldId(table, entityId) !== this.getWorldId(table, parentId)) {
      throw new Error('A entidade precisa continuar no mesmo mundo.');
    }

    if (this.isAncestor(table, entityId, parentId)) {
      throw new Error('Não é possível mover uma entidade para dentro de um descendente.');
    }
  }

  private getWorldId(table: string, entityId: string): string | null {
    const relationship = this.crud.findFirst('Relationship', {
      parentTable: 'World',
      entityTable: table,
      entityId
    }) as { parentId?: string } | null;

    return relationship?.parentId || null;
  }

  private isAncestor(table: string, ancestorId: string, entityId: string): boolean {
    const visited = new Set<string>();
    let currentParentId = this.getParentId(table, entityId);

    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === ancestorId) {
        return true;
      }

      visited.add(currentParentId);
      currentParentId = this.getParentId(table, currentParentId);
    }

    return false;
  }
}
