import { TestBed } from '@angular/core/testing';
import { DynamicSliderFieldComponent } from './dynamic-slider-field.component';
import { defaultSliderFieldOptions } from '../../models/dynamicfields.model';

describe('DynamicSliderFieldComponent limits', () => {
  it('shows and enforces both configured limits, including zero and negative values', () => {
    const fixture = TestBed.createComponent(DynamicSliderFieldComponent);
    fixture.componentRef.setInput('label', 'Reputação');
    fixture.componentRef.setInput('config', { ...defaultSliderFieldOptions(), min: -10, max: 0, unit: 'pts' });
    fixture.componentRef.setInput('value', JSON.stringify({ value: -10 }));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.slider-limits')?.textContent).toContain('Mín. -10 pts');
    expect(element.querySelector('.slider-limits')?.textContent).toContain('Máx. 0 pts');
    expect(element.querySelector('.slider-limit--active')?.textContent).toContain('Mín.');
    const range = element.querySelector<HTMLInputElement>('input[type="range"]')!;
    range.value = '50';
    range.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.currentValue).toBe(0);
    expect(element.querySelector('.slider-limit--active')?.textContent).toContain('Máx.');
    expect(range.getAttribute('aria-valuetext')).toBe('0 pts (máximo)');
  });
});
