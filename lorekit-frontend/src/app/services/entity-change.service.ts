import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface EntityChangeEvent {
  table: string;
  id: string;
  action: 'save' | 'delete';
}

@Injectable({
  providedIn: 'root'
})
export class EntityChangeService {
  private readonly subject = new Subject<EntityChangeEvent>();

  readonly changes$ = this.subject.asObservable();

  notifySave(table: string, id: string): void {
    this.subject.next({ table, id, action: 'save' });
  }

  notifyDelete(table: string, id: string): void {
    this.subject.next({ table, id, action: 'delete' });
  }
}
