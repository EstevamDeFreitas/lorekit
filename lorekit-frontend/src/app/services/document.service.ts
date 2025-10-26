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
    return this.crud.findAll('Document', {
      entityTable: entityTable,
      entityId: entityId
    });
  }

  getDocument(documentId: string) : Document {
    return this.crud.findById('Document', documentId);
  }

  saveDocument(document: Document) : Document {
    if (document.id != '') {
      return <Document>this.crud.update('Document', document.id, document);
    } else {
      return <Document>this.crud.create('Document', document);
    }
  }

  deleteDocument(documentId: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Document', documentId, deleteRelatedItems);
  }

}
