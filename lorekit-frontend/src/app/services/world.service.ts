import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { World } from '../models/world.model';
import { environment } from '../../enviroments/environment';

@Injectable({
  providedIn: 'root'
})
export class WorldService {
  private apiUrl = `${environment.apiUrl}/worlds`;

  constructor(private http : HttpClient) { }

  getWorlds() {
    return this.http.get<World[]>(this.apiUrl);
  }

  getWorldById(id: string) {
    return this.http.get<World>(`${this.apiUrl}/${id}`);
  }

  createWorld(world: World) {
    return this.http.post<World>(this.apiUrl, world);
  }

  updateWorld(id: string, world: World) {
    return this.http.put<World>(`${this.apiUrl}/${id}`, world);
  }

  deleteWorld(id: string, deleteRelatedItems: boolean = false) {
    return this.http.delete(`${this.apiUrl}/${id}?deleteRelatedItems=${deleteRelatedItems}`);
  }

}
