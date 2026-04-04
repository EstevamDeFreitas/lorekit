import { Injectable } from '@angular/core';
import { Document } from '../models/document.model';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

type RelationshipRow = {
  id: string;
  parentTable: string;
  parentId: string;
  entityTable: string;
  entityId: string;
};

type DocumentOwnerReference = {
  table: string;
  id: string;
} | null;

type DocumentContext = {
  owner: DocumentOwnerReference;
  worldId: string | null;
};

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private crud : CrudHelper;

  private readonly documentIncludes = [
    { table: 'Personalization', firstOnly: true },
    { table: 'World', firstOnly: true, isParent: true },
    { table: 'Document', firstOnly: true, isParent: true }
  ] as const;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getDocuments(entityTable: string, entityId: string): Document[] {
    return this.crud.findAll('Document', {}, [...this.documentIncludes], { parentTable: entityTable, parentId: entityId }) as Document[];
  }

  getDocumentsTree(entityTable: string | null, entityId: string | null): Document[] {
    let documents : Document[] = [];

    if (entityTable && entityId) {
      documents = this.crud.findAll('Document', {}, [...this.documentIncludes], { parentTable: entityTable, parentId: entityId }) as Document[];
    } else {
      documents = this.crud.findAll('Document', {}, [...this.documentIncludes]) as Document[];
    }

    for (const doc of documents) {
      doc.SubDocuments = this.getDocumentsTree('Document', doc.id);
    }

    return documents;
  }

  getAllDocuments() : Document[] {
    return this.crud.findAll('Document', {}, [...this.documentIncludes]) as Document[];
  }

  getDocumentsByWorldId(worldId: string) : Document[] {
    return this.crud.findAll('Document', {}, [...this.documentIncludes], { parentTable: 'World', parentId: worldId }) as Document[];
  }

  getDocument(documentId: string) : Document {
    return this.crud.findById('Document', documentId, [...this.documentIncludes]) as Document;
  }

  saveDocument(document: Document, entityTable: string | null = null, entityId: string | null = null, worldId: string | null = null) : Document {
    const resolvedWorldId = worldId || this.getInheritedWorldId(entityTable, entityId);

    if (document.id != '') {
      document = this.crud.update('Document', document.id, document) as Document;
      this.syncWorldRelationship(document.id, resolvedWorldId);
      return this.getDocument(document.id);
    }

    document = this.crud.create('Document', document) as Document;

    if (entityTable && entityId) {
      this.ensureRelationship(entityTable, entityId, 'Document', document.id);
    }

    this.syncWorldRelationship(document.id, resolvedWorldId);
    return this.getDocument(document.id);
  }

  deleteDocument(documentId: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Document', documentId, deleteRelatedItems);
  }

  attachExistingDocument(entityTable: string, entityId: string, documentId: string) {
    this.ensureRelationship(entityTable, entityId, 'Document', documentId);
    this.syncWorldRelationship(documentId, this.getInheritedWorldId(entityTable, entityId));
  }

  getDocumentWorldId(documentId: string): string | null {
    return this.getInheritedWorldId('Document', documentId);
  }

  canReparentDocument(documentId: string, parentDocumentId: string | null): boolean {
    try {
      this.assertCanReparentDocument(documentId, parentDocumentId);
      return true;
    } catch {
      return false;
    }
  }

  reparentDocument(documentId: string, parentDocumentId: string | null): Document {
    this.assertCanReparentDocument(documentId, parentDocumentId);

    const documentContext = this.getDocumentContext(documentId);
    const worldId = documentContext.worldId || this.getDocumentWorldId(documentId);

    this.deleteRelationship(documentId, 'Document');
    this.deleteDocumentOwnerRelationships(documentId);

    if (parentDocumentId) {
      this.ensureRelationship('Document', parentDocumentId, 'Document', documentId);
    } else if (documentContext.owner) {
      this.ensureRelationship(documentContext.owner.table, documentContext.owner.id, 'Document', documentId);
    }

    this.syncWorldRelationship(documentId, worldId);
    return this.getDocument(documentId);
  }

  private ensureRelationship(parentTable: string, parentId: string, entityTable: string, entityId: string) {
    const existingRelationship = this.crud.findAll('Relationship', {
      parentTable,
      parentId,
      entityTable,
      entityId,
    }) as RelationshipRow[];

    if ((existingRelationship || []).length > 0) {
      return;
    }

    this.crud.create('Relationship', {
      parentTable,
      parentId,
      entityTable,
      entityId
    });
  }

  private syncWorldRelationship(documentId: string, worldId: string | null) {
    this.crud.deleteWhen('Relationship', {
      parentTable: 'World',
      entityTable: 'Document',
      entityId: documentId
    });

    if (worldId) {
      this.ensureRelationship('World', worldId, 'Document', documentId);
    }
  }

  private assertCanReparentDocument(documentId: string, parentDocumentId: string | null) {
    if (!documentId) {
      throw new Error('Documento inválido para mover.');
    }

    if (documentId === parentDocumentId) {
      throw new Error('Um documento não pode ser filho de si mesmo.');
    }

    const document = this.getDocument(documentId);
    if (!document) {
      throw new Error('Documento de origem não encontrado.');
    }

    if (!parentDocumentId) {
      return;
    }

    const parentDocument = this.getDocument(parentDocumentId);
    if (!parentDocument) {
      throw new Error('Documento de destino não encontrado.');
    }

    if (this.isDocumentAncestor(documentId, parentDocumentId)) {
      throw new Error('Não é possível mover um documento para dentro de um descendente.');
    }

    const sourceContext = this.getDocumentContext(documentId);
    const targetContext = this.getDocumentContext(parentDocumentId);

    if ((sourceContext.worldId || null) !== (targetContext.worldId || null)) {
      throw new Error('O documento precisa continuar no mesmo mundo.');
    }

    if (!this.isSameOwner(sourceContext.owner, targetContext.owner)) {
      throw new Error('O documento precisa continuar no mesmo contexto raiz.');
    }
  }

  private getDocumentContext(documentId: string, visited = new Set<string>()): DocumentContext {
    if (!documentId || visited.has(documentId)) {
      return { owner: null, worldId: null };
    }

    visited.add(documentId);

    const relationships = this.getEntityRelationships('Document', documentId);
    const parentDocument = relationships.find(relationship => relationship.parentTable === 'Document');
    if (parentDocument) {
      return this.getDocumentContext(parentDocument.parentId, visited);
    }

    const ownerRelationship = relationships.find(relationship => relationship.parentTable !== 'Document' && relationship.parentTable !== 'World');
    const worldRelationship = relationships.find(relationship => relationship.parentTable === 'World');

    return {
      owner: ownerRelationship
        ? {
            table: ownerRelationship.parentTable,
            id: ownerRelationship.parentId,
          }
        : null,
      worldId: worldRelationship?.parentId || (ownerRelationship ? this.getInheritedWorldId(ownerRelationship.parentTable, ownerRelationship.parentId) : null),
    };
  }

  private isDocumentAncestor(ancestorId: string, documentId: string): boolean {
    let currentParentId = this.getParentDocumentId(documentId);

    while (currentParentId) {
      if (currentParentId === ancestorId) {
        return true;
      }

      currentParentId = this.getParentDocumentId(currentParentId);
    }

    return false;
  }

  private getParentDocumentId(documentId: string): string | null {
    const relationship = this.crud.findFirst('Relationship', {
      parentTable: 'Document',
      entityTable: 'Document',
      entityId: documentId
    }) as RelationshipRow | null;

    return relationship?.parentId || null;
  }

  private getEntityRelationships(entityTable: string, entityId: string): RelationshipRow[] {
    return this.crud.findAll('Relationship', {
      entityTable,
      entityId,
    }) as RelationshipRow[];
  }

  private deleteDocumentOwnerRelationships(documentId: string) {
    const relationships = this.getEntityRelationships('Document', documentId);

    for (const relationship of relationships) {
      if (relationship.parentTable === 'World' || relationship.parentTable === 'Document') {
        continue;
      }

      this.deleteRelationship(documentId, relationship.parentTable, relationship.parentId);
    }
  }

  private deleteRelationship(documentId: string, parentTable: string, parentId?: string) {
    const relationships = this.getEntityRelationships('Document', documentId)
      .filter(relationship => relationship.parentTable === parentTable && (!parentId || relationship.parentId === parentId));

    for (const relationship of relationships) {
      this.crud.deleteWhen('Relationship', {
        parentTable: relationship.parentTable,
        parentId: relationship.parentId,
        entityTable: relationship.entityTable,
        entityId: relationship.entityId
      });
    }
  }

  private isSameOwner(sourceOwner: DocumentOwnerReference, targetOwner: DocumentOwnerReference) {
    if (!sourceOwner && !targetOwner) {
      return true;
    }

    if (!sourceOwner || !targetOwner) {
      return false;
    }

    return sourceOwner.table === targetOwner.table && sourceOwner.id === targetOwner.id;
  }

  private getInheritedWorldId(entityTable: string | null, entityId: string | null, visited = new Set<string>()): string | null {
    if (!entityTable || !entityId) {
      return null;
    }

    if (entityTable === 'World') {
      return entityId;
    }

    const visitKey = `${entityTable}:${entityId}`;
    if (visited.has(visitKey)) {
      return null;
    }

    visited.add(visitKey);

    const relationships = this.crud.findAll('Relationship', {
      entityTable,
      entityId,
    }) as RelationshipRow[];

    for (const relationship of relationships) {
      if (relationship.parentTable === 'World') {
        return relationship.parentId;
      }
    }

    for (const relationship of relationships) {
      const parentWorldId = this.getInheritedWorldId(relationship.parentTable, relationship.parentId, visited);
      if (parentWorldId) {
        return parentWorldId;
      }
    }

    return null;
  }
}
