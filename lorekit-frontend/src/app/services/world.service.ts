import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { World } from '../models/world.model';

@Injectable({
  providedIn: 'root'
})
export class WorldService {
  private apiUrl = 'http://localhost:3000/worlds';

  constructor(private http : HttpClient) { }

  getWorlds() {
    return this.http.get<World[]>(this.apiUrl);
  }

}
