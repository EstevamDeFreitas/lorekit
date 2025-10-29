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

  getDocument(documentId: string) : Document {
    return this.crud.findById('Document', documentId, [{"table": "Personalization", "firstOnly": true}]);
  }

  saveDocument(document: Document, entityTable: string, entityId: string) : Document {
    if (document.id != '') {
      return <Document>this.crud.update('Document', document.id, document);
    } else {
      document = <Document>this.crud.create('Document', document);

      this.crud.create('Relationship', {
        parentTable: entityTable,
        parentId: entityId,
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
