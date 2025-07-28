import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { World } from '../models/world.model';

@Injectable({
  providedIn: 'root'
})
export class WorldStateService {
  private currentWorldSubject = new BehaviorSubject<World | null>(null);
  currentWorld$ = this.currentWorldSubject.asObservable();

  setWorld(world: World) {
    this.currentWorldSubject.next(world);
  }

  getCurrentWorld(): World | null {
    return this.currentWorldSubject.value;
  }

  clearWorld() {
    this.currentWorldSubject.next(null);
  }

}
