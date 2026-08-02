import { Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: '[appMobilePinchZoom]',
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd()',
    '(touchcancel)': 'onTouchEnd()',
  },
})
export class MobilePinchZoomDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private startDistance = 0;
  private startZoom = 1;

  onTouchStart(event: TouchEvent): void {
    if (!this.isMobile() || event.touches.length !== 2) {
      return;
    }

    this.startDistance = this.distance(event.touches);
    this.startZoom = this.currentZoom();
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.startDistance || event.touches.length !== 2) {
      return;
    }

    event.preventDefault();
    const zoom = Math.min(1.5, Math.max(0.55, this.startZoom * (this.distance(event.touches) / this.startDistance)));
    this.elementRef.nativeElement.style.setProperty('--mobile-grid-zoom', String(zoom));
  }

  onTouchEnd(): void {
    if (this.startDistance) {
      this.startDistance = 0;
    }
  }

  private currentZoom(): number {
    const value = Number.parseFloat(getComputedStyle(this.elementRef.nativeElement).getPropertyValue('--mobile-grid-zoom'));
    return Number.isFinite(value) ? value : 1;
  }

  private distance(touches: TouchList): number {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  }

  private isMobile(): boolean {
    return window.matchMedia('(max-width: 767px)').matches;
  }
}
