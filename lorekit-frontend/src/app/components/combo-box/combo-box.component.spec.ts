import { Component } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ComboBoxComponent } from './combo-box.component';

@Component({
  imports: [ComboBoxComponent],
  template: `<div class="scroll-parent" style="height: 110px; width: 300px; overflow: hidden; position: relative;">
    <div style="backdrop-filter: blur(14px); position: relative;">
      <app-combo-box label="Tipo" [items]="items" compareProp="value" displayProp="label" [(comboValue)]="value" />
    </div>
    <div class="next-card" style="height: 250px; background: red; backdrop-filter: blur(14px); position: relative;">Próximo campo</div>
  </div>`,
})
class ComboBoxTestHost {
  items = [{ value: 'text', label: 'Texto' }, { value: 'number', label: 'Número' }];
  value: string | null = 'text';
}

describe('ComboBoxComponent overlay', () => {
  let fixture: ComponentFixture<ComboBoxTestHost>;
  let overlay: HTMLElement;
  let input: HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ errorOnUnknownProperties: true, errorOnUnknownElements: true });
    fixture = TestBed.createComponent(ComboBoxTestHost);
    fixture.detectChanges();
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    input = fixture.nativeElement.querySelector('input');
  });

  function open() {
    input.focus();
    fixture.detectChanges();
    tick(32);
    fixture.detectChanges();
  }

  function options() {
    return Array.from(overlay.querySelectorAll<HTMLElement>('.cursor-pointer'));
  }

  it('renders above the following card and outside ancestor clipping', async () => {
    input.focus();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const option = options()[2];
    expect(option.textContent?.trim()).toBe('Número');
    expect(fixture.nativeElement.querySelector('app-combo-box').contains(option)).toBeFalse();
    const pane = overlay.querySelector<HTMLElement>('.cdk-overlay-pane')!;
    const trigger = input.parentElement!.getBoundingClientRect();
    expect(pane.getBoundingClientRect().width).toBeCloseTo(trigger.width, 0);
    const rect = option.getBoundingClientRect();
    expect(option.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))).toBeTrue();
    option.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('number');
    expect(options().length).toBe(0);
  });

  it('filters and selects with the keyboard, and clears the selection', fakeAsync(() => {
    open();
    input.value = 'nú';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(options().map(option => option.textContent?.trim())).toEqual(['-- Nenhum --', 'Número']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('number');
    input.blur();
    open();
    options()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBeNull();
  }));

  it('keeps trigger clicks open and closes on outside clicks, Escape and Tab', fakeAsync(() => {
    open();
    input.click();
    fixture.detectChanges();
    expect(options().length).toBe(3);
    document.body.click();
    fixture.detectChanges();
    expect(options().length).toBe(0);
    for (const key of ['Escape', 'Tab']) {
      input.blur();
      open();
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
      expect(options().length).toBe(0);
    }
  }));

  it('closes on ancestor scroll but permits scrolling the option list', fakeAsync(() => {
    open();
    overlay.querySelector('.scrollbar-dark')!.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(options().length).toBe(3);
    fixture.nativeElement.querySelector('.scroll-parent').dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(options().length).toBe(0);
  }));

  it('removes the dropdown when its host is destroyed', fakeAsync(() => {
    open();
    fixture.destroy();
    expect(overlay.querySelector('.cdk-overlay-pane')).toBeNull();
  }));
});
