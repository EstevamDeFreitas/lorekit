import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { Document } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = `${environment.apiUrl}/documents`;

  constructor(private http : HttpClient) { }

  getDocuments(entityTable: string, entityId: string) {
    return this.http.get<Document[]>(`${this.apiUrl}/entity/${entityTable}/${entityId}`);
  }

  getDocument(documentId: string) {
    return this.http.get<Document>(`${this.apiUrl}/${documentId}`);
  }

  saveDocument(document: Document) {
    if (document.id) {
      return this.http.put<Document>(`${this.apiUrl}/${document.id}`, document);
    } else {
      return this.http.post<Document>(this.apiUrl, document);
    }
  }

  deleteDocument(documentId: string, deleteRelatedItems: boolean = false) {
    return this.http.delete(`${this.apiUrl}/${documentId}?deleteRelatedItems=${deleteRelatedItems}`);
  }

}
