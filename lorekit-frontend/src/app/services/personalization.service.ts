import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { Personalization } from '../models/personalization.model';

@Injectable({
  providedIn: 'root'
})
export class PersonalizationService {
  private apiUrl = `${environment.apiUrl}/personalizations`;

  constructor(private http : HttpClient) { }

  getPersonalization(entityTable: string, entityId: string) {
    return this.http.get<Personalization>(`${this.apiUrl}/entity/${entityTable}/${entityId}`);
  }

  savePersonalization(personalization: Personalization) {
    if (personalization.id) {
      return this.http.put<Personalization>(`${this.apiUrl}/${personalization.id}`, personalization);
    } else {
      return this.http.post<Personalization>(this.apiUrl, personalization);
    }
  }



}
