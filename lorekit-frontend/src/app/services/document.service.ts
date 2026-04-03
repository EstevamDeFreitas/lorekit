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
