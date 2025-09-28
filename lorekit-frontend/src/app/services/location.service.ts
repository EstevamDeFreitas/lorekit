import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { HttpClient } from '@angular/common/http';
import { Location, LocationCategory } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private apiUrl = `${environment.apiUrl}/locations`;

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


}
