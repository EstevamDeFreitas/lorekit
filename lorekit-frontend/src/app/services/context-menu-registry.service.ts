import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ContextMenuRegistryService {
  private currentCloseFn?: () => void;

  closeAll() {

    this.currentCloseFn?.();

    this.currentCloseFn = undefined;
  }

  setCurrent(closeFn: () => void) {

    this.currentCloseFn = closeFn;
  }
}
