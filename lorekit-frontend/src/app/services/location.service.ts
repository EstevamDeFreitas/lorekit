import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { HttpClient } from '@angular/common/http';
import { Location, LocationCategory } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private apiUrl = `${environment.apiUrl}/location`;

  constructor(private http : HttpClient) { }

  getLocations(){
    return this.http.get<Location[]>(`${this.apiUrl}`);
  }

  saveLocation(location: Location) {
    if (location.id) {
      return this.http.put<Location>(`${this.apiUrl}/${location.id}`, location);
    } else {
      return this.http.post<Location>(this.apiUrl, location);
    }
  }

  deleteLocation(locationId: string) {
    return this.http.delete(`${this.apiUrl}/${locationId}`);
  }

  getLocationById(locationId: string) {
    return this.http.get<Location>(`${this.apiUrl}/${locationId}`);
  }

  getLocationByWorldId(worldId: string) {
    return this.http.get<Location[]>(`${this.apiUrl}/world/${worldId}`);
  }

  //Location Category
  getLocationCategories(){
    return this.http.get<string[]>(`${this.apiUrl}/categories`);
  }

  saveLocationCategory(category: LocationCategory) {
    if (category.id) {
      return this.http.put<LocationCategory>(`${this.apiUrl}/categories/${encodeURIComponent(category.id)}`, category);
    } else {
      return this.http.post<LocationCategory>(`${this.apiUrl}/categories`, category);
    }
  }

  deleteLocationCategory(category: LocationCategory) {
    return this.http.delete(`${this.apiUrl}/categories/${encodeURIComponent(category.id)}`);
  }

  getLocationCategoryById(categoryId: string) {
    return this.http.get<LocationCategory>(`${this.apiUrl}/categories/${encodeURIComponent(categoryId)}`);
  }

}
