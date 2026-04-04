import { Document } from '../models/document.model';
import { DocumentService } from './document.service';

type RelationshipRow = {
  id: string;
  parentTable: string;
  parentId: string;
  entityTable: string;
  entityId: string;
};

class FakeDocumentCrud {
  relationships: RelationshipRow[];
  documents = new Map<string, Document>();

  constructor(documents: Document[], relationships: RelationshipRow[]) {
    this.relationships = relationships.map(relationship => ({ ...relationship }));
    documents.forEach(document => {
      this.documents.set(document.id, document);
    });
  }

  findAll(table: string, where: Record<string, any> = {}) {
    if (table === 'Relationship') {
      return this.relationships
        .filter(relationship => this.matchesWhere(relationship, where))
        .map(relationship => ({ ...relationship }));
    }

    if (table === 'Document') {
      return Array.from(this.documents.values())
        .filter(document => this.matchesWhere(document, where))
        .map(document => ({ ...document }));
    }

    return [];
  }

  findFirst(table: string, where: Record<string, any> = {}) {
    return this.findAll(table, where)[0] || null;
  }

  findById(table: string, id: string) {
    if (table !== 'Document') {
      return null;
    }

    const document = this.documents.get(id);
    if (!document) {
      return null;
    }

    const parentWorld = this.relationships.find(relationship =>
      relationship.entityTable === 'Document'
      && relationship.entityId === id
      && relationship.parentTable === 'World'
    );
    const parentDocument = this.relationships.find(relationship =>
      relationship.entityTable === 'Document'
      && relationship.entityId === id
      && relationship.parentTable === 'Document'
    );

    return {
      ...document,
      ParentWorld: parentWorld ? { id: parentWorld.parentId } : null,
      ParentDocument: parentDocument ? { id: parentDocument.parentId } : null,
    };
  }

  create(table: string, data: any) {
    if (table === 'Relationship') {
      this.relationships.push({
        id: data.id || `rel-${this.relationships.length + 1}`,
        parentTable: data.parentTable,
        parentId: data.parentId,
        entityTable: data.entityTable,
        entityId: data.entityId,
      });
      return data;
    }

    if (table === 'Document') {
      this.documents.set(data.id, data);
      return data;
    }

    return data;
  }

  deleteWhen(table: string, where: Record<string, any>) {
    if (table !== 'Relationship') {
      return;
    }

    this.relationships = this.relationships.filter(relationship => !this.matchesWhere(relationship, where));
  }

  update(_table: string, _id: string, data: any) {
    return data;
  }

  private matchesWhere(value: Record<string, any>, where: Record<string, any>) {
    return Object.entries(where).every(([key, expected]) => value[key] === expected);
  }
}

describe('DocumentService', () => {
  function createService(relations: RelationshipRow[]) {
    const crud = new FakeDocumentCrud([
      new Document('doc-a', 'Documento A', ''),
      new Document('doc-b', 'Documento B', ''),
    ], relations);

    const service = new DocumentService({ getCrudHelper: () => crud } as any);
    return { crud, service };
  }

  function hasRelation(
    relationships: RelationshipRow[],
    parentTable: string,
    parentId: string,
    entityId: string,
  ) {
    return relationships.some(relationship =>
      relationship.parentTable === parentTable
      && relationship.parentId === parentId
      && relationship.entityTable === 'Document'
      && relationship.entityId === entityId
    );
  }

  it('promotes a child document to the root of its original context while preserving world', () => {
    const { crud, service } = createService([
      { id: '1', parentTable: 'Event', parentId: 'event-1', entityTable: 'Document', entityId: 'doc-a' },
      { id: '2', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-a' },
      { id: '3', parentTable: 'Document', parentId: 'doc-a', entityTable: 'Document', entityId: 'doc-b' },
      { id: '4', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-b' },
    ]);

    service.reparentDocument('doc-b', null);

    expect(hasRelation(crud.relationships, 'Event', 'event-1', 'doc-b')).toBeTrue();
    expect(hasRelation(crud.relationships, 'World', 'world-1', 'doc-b')).toBeTrue();
    expect(hasRelation(crud.relationships, 'Document', 'doc-a', 'doc-b')).toBeFalse();
  });

  it('moves a root document under another document in the same context', () => {
    const { crud, service } = createService([
      { id: '1', parentTable: 'Event', parentId: 'event-1', entityTable: 'Document', entityId: 'doc-a' },
      { id: '2', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-a' },
      { id: '3', parentTable: 'Event', parentId: 'event-1', entityTable: 'Document', entityId: 'doc-b' },
      { id: '4', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-b' },
    ]);

    service.reparentDocument('doc-b', 'doc-a');

    expect(hasRelation(crud.relationships, 'Document', 'doc-a', 'doc-b')).toBeTrue();
    expect(hasRelation(crud.relationships, 'Event', 'event-1', 'doc-b')).toBeFalse();
    expect(hasRelation(crud.relationships, 'World', 'world-1', 'doc-b')).toBeTrue();
  });

  it('blocks cyclical document reparenting', () => {
    const { service } = createService([
      { id: '1', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-a' },
      { id: '2', parentTable: 'Document', parentId: 'doc-a', entityTable: 'Document', entityId: 'doc-b' },
      { id: '3', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-b' },
    ]);

    expect(() => service.reparentDocument('doc-a', 'doc-b'))
      .toThrowError(/descendente/i);
  });

  it('blocks reparenting documents across worlds', () => {
    const { service } = createService([
      { id: '1', parentTable: 'World', parentId: 'world-1', entityTable: 'Document', entityId: 'doc-a' },
      { id: '2', parentTable: 'World', parentId: 'world-2', entityTable: 'Document', entityId: 'doc-b' },
    ]);

    expect(() => service.reparentDocument('doc-b', 'doc-a'))
      .toThrowError(/mesmo mundo/i);
  });
});
