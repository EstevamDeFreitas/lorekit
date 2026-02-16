import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { World } from '../models/world.model';
import { GlobalParameterService } from './global-parameter.service';

@Injectable({
  providedIn: 'root'
})
export class WorldStateService {
  private readonly WORLD_STORAGE_KEY = 'currentWorld';
  private currentWorldSubject = new BehaviorSubject<World | null>(null);
  currentWorld$ = this.currentWorldSubject.asObservable();

  constructor(private globalParameterService: GlobalParameterService) {
    const persistedWorld = this.loadPersistedWorld();
    this.currentWorldSubject.next(persistedWorld);
  }

  setWorld(world: World) {
    this.currentWorldSubject.next(world);
    this.persistWorld(world);
  }

  getCurrentWorld(): World | null {
    return this.currentWorldSubject.value;
  }

  clearWorld() {
    this.currentWorldSubject.next(null);
    this.globalParameterService.setParameter(this.WORLD_STORAGE_KEY, '');
  }

  private persistWorld(world: World): void {
    try {
      this.globalParameterService.setParameter(this.WORLD_STORAGE_KEY, JSON.stringify(world));
    } catch {
      this.globalParameterService.setParameter(this.WORLD_STORAGE_KEY, '');
    }
  }

  private loadPersistedWorld(): World | null {
    const value = this.globalParameterService.getParameter(this.WORLD_STORAGE_KEY);

    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as World;
      return parsed ?? null;
    } catch {
      this.globalParameterService.setParameter(this.WORLD_STORAGE_KEY, '');
      return null;
    }
  }

}
