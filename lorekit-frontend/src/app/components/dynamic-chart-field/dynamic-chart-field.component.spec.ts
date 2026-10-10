import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { DynamicChartFieldComponent } from './dynamic-chart-field.component';
import { defaultChartFieldOptions, parseChartValue } from '../../models/dynamicfields.model';

describe('DynamicChartFieldComponent Radar', () => {
  it('renders fixed axes even without values and allows only numeric edits', () => {
    const fixture = TestBed.createComponent(DynamicChartFieldComponent);
    fixture.componentRef.setInput('label', 'Atributos');
    fixture.componentRef.setInput('config', { ...defaultChartFieldOptions(), categories: ['Força', 'Agilidade', 'Magia'] });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('input').length).toBe(0);
    element.querySelector<HTMLButtonElement>('.chart-edit-button')!.click();
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(Array.from(overlay.querySelectorAll('.radar-category')).map(label => label.textContent?.trim())).toEqual(['Força', 'Agilidade', 'Magia']);
    expect(overlay.querySelectorAll('input[type="number"]').length).toBe(3);
    expect(element.querySelector('.chart-input--label')).toBeNull();
    expect(element.querySelector('.chart-button')).toBeNull();
    expect(element.querySelectorAll('.chart-grid line').length).toBe(3);

    let emitted = '';
    fixture.componentInstance.valueChange.subscribe(value => emitted = value);
    fixture.componentInstance.setValue(0, 0, 8);
    fixture.componentInstance.setValue(1, 0, 5);
    fixture.componentInstance.setValue(2, 0, 3);
    expect(emitted).toBe('');
    fixture.componentInstance.saveEditor();
    fixture.detectChanges();
    expect(parseChartValue(emitted)).toEqual({ labels: ['Força', 'Agilidade', 'Magia'], series: [{ id: 'series-1', values: [8, 5, 3] }] });
    const xs = fixture.componentInstance.radarDataPoints(0).split(' ').map(point => Number(point.split(',')[0]));
    expect(new Set(xs).size).toBe(3);
  });

  it('discards edits when the floating editor is cancelled', () => {
    const fixture = TestBed.createComponent(DynamicChartFieldComponent);
    fixture.componentRef.setInput('label', 'Atributos');
    fixture.componentRef.setInput('config', defaultChartFieldOptions());
    fixture.detectChanges();
    const changes: string[] = [];
    fixture.componentInstance.valueChange.subscribe(value => changes.push(value));
    fixture.componentInstance.openEditor();
    fixture.componentInstance.setValue(0, 0, 9);
    fixture.componentInstance.cancelEditor();
    expect(changes).toEqual([]);
    expect(fixture.componentInstance.draftRows[0].values).toEqual([0]);
    expect(fixture.componentInstance.editorOpen()).toBeFalse();
  });
});
