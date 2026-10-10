import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { DynamicListFieldComponent } from './dynamic-list-field.component';
import { defaultListFieldOptions, parseListValue } from '../../models/dynamicfields.model';

describe('DynamicListFieldComponent floating table editor', () => {
  it('keeps long tables and lists in their own scroll region', () => {
    const fixture = TestBed.createComponent(DynamicListFieldComponent);
    fixture.componentRef.setInput('label', 'Inventário');
    const element: HTMLElement = fixture.nativeElement;
    element.style.height = '140px';
    element.style.width = '320px';
    for (const mode of ['table', 'headless'] as const) {
      fixture.componentRef.setInput('config', { ...defaultListFieldOptions(), mode });
      fixture.componentRef.setInput('value', JSON.stringify({ items: Array.from({ length: 30 }, (_, index) => mode === 'table' ? { item: `Item ${index}` } : `Item ${index}`) }));
      fixture.detectChanges();
      const region = element.querySelector<HTMLElement>('.list-scroll-region')!;
      expect(getComputedStyle(region).overflowY).toBe('auto');
      expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
      expect(region.clientHeight).toBeLessThan(140);
    }
  });
  function setup() {
    const fixture = TestBed.createComponent(DynamicListFieldComponent);
    fixture.componentRef.setInput('label', 'Inventário');
    fixture.componentRef.setInput('config', defaultListFieldOptions());
    fixture.componentRef.setInput('value', JSON.stringify({ items: [{ item: 'Espada' }] }));
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    return { fixture, overlay, element: fixture.nativeElement as HTMLElement };
  }

  it('edits outside the clipped field and saves the existing row', async () => {
    const { fixture, overlay, element } = setup();
    const edit = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Editar')!;
    edit.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('.list-row-popover')).toBeNull();
    expect(overlay.querySelector('[role="dialog"]')).not.toBeNull();
    expect(overlay.querySelector<HTMLInputElement>('input')?.value).toBe('Espada');
    let saved = '';
    fixture.componentInstance.valueChange.subscribe(value => saved = value);
    fixture.componentInstance.setDraftValue(defaultListFieldOptions().columns[0], 'Arco');
    overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
    expect(parseListValue(saved, defaultListFieldOptions()).items).toEqual([{ item: 'Arco' }]);
    expect(overlay.querySelector('[role="dialog"]')).toBeNull();
  });

  it('cancels with Escape or an outside click without changing stored rows', () => {
    const { fixture, overlay, element } = setup();
    const add = element.querySelector<HTMLButtonElement>('.list-button')!;
    add.click();
    fixture.detectChanges();
    overlay.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.editingIndex).toBeNull();
    add.click();
    fixture.detectChanges();
    overlay.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    fixture.detectChanges();
    expect(overlay.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.tableRows).toEqual([{ item: 'Espada' }]);
  });
});
