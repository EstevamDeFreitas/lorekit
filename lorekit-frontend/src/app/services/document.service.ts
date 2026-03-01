import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { Document } from '../models/document.model';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getDocuments(entityTable: string, entityId: string): Document[] {
    return this.crud.findAll('Document', {}, [{"table": "Personalization", "firstOnly": true}], {parentTable: entityTable, parentId: entityId});
  }

  getDocumentsTree(entityTable: string | null, entityId: string | null): Document[] {
    let documents : Document[] = [];

    if(entityTable && entityId) {
      documents = this.crud.findAll('Document', {}, [{"table": "Personalization", "firstOnly": true}, {"table": "Document", "firstOnly": true}], {parentTable: entityTable, parentId: entityId});
    }
    else{
      documents = this.crud.findAll('Document', {}, [{"table": "Personalization", "firstOnly": true}, {"table": "Document", "firstOnly": true}, {"table": "Document", "firstOnly": true, "isParent":true}]);
    }

    for(let doc of documents) {
      doc.SubDocuments = this.getDocumentsTree('Document', doc.id);
    }

    return documents;
  }

  getAllDocuments() : Document[] {
    return this.crud.findAll('Document', {}, [{"table": "Personalization", "firstOnly": true}]);
  }

  getDocumentsByWorldId(worldId: string) : Document[] {
    return <Document[]>this.crud.findAll('Document', {}, [{"table": "Personalization", "firstOnly": true}], {parentTable: 'World', parentId: worldId});
  }

  getDocument(documentId: string) : Document {
    return this.crud.findById('Document', documentId, [{"table": "Personalization", "firstOnly": true}]);
  }

  saveDocument(document: Document, entityTable: string, entityId: string, worldId: string | null = null) : Document {
    if (document.id != '') {
      document = <Document>this.crud.update('Document', document.id, document);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Document',
        entityId: document.id
      });

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Document',
          entityId: document.id
        });
      }


      return document;
    } else {
      document = <Document>this.crud.create('Document', document);

      this.crud.create('Relationship', {
        parentTable: entityTable,
        parentId: entityId,
        entityTable: 'Document',
        entityId: document.id
      });

      this.crud.create('Relationship', {
        parentTable: 'World',
        parentId: worldId,
        entityTable: 'Document',
        entityId: document.id
      });

      return document;

    }
  }

  deleteDocument(documentId: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Document', documentId, deleteRelatedItems);
  }

}
