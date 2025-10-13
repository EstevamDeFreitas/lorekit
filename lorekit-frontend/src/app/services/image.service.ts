import { inject, Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Image } from '../models/image.model';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private apiUrl = `${environment.apiUrl}/images`;

  private http = inject(HttpClient);

  constructor() { }

  uploadImage(file: File, entityTable: string, entityId: string, usageKey: string): Observable<Image> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('entityTable', entityTable);
    formData.append('entityId', entityId);
    formData.append('usageKey', usageKey);

    return this.http.post<Image>(`${this.apiUrl}/upload`, formData);
  }

  getImages(entityTable: string, entityId: string, usageKey: string): Observable<Image[]> {
    return this.http.get<Image[]>(`${this.apiUrl}/${entityTable}/${entityId}/${usageKey}`);
  }

  deleteImage(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }


}
