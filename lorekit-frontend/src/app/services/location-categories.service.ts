import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LocationCategory } from '../models/location.model';
import { environment } from '../../enviroments/environment';

@Injectable({
  providedIn: 'root'
})
export class LocationCategoriesService {
  private apiUrl = `${environment.apiUrl}/location-categories`;

  constructor(private http : HttpClient) { }

  //Location Category
  getLocationCategories(){
    return this.http.get<LocationCategory[]>(`${this.apiUrl}`);
  }

  saveLocationCategory(category: LocationCategory) {
    if (category.id) {
      return this.http.put<LocationCategory>(`${this.apiUrl}/${category.id}`, category);
    } else {
      return this.http.post<LocationCategory>(`${this.apiUrl}`, category);
    }
  }

  deleteLocationCategory(category: LocationCategory) {
    return this.http.delete(`${this.apiUrl}/${category.id}`);
  }

  getLocationCategoryById(categoryId: string) {
    return this.http.get<LocationCategory>(`${this.apiUrl}/${categoryId}`);
  }

}
