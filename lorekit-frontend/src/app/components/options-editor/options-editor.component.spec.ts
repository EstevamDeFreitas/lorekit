import { TestBed } from '@angular/core/testing';
import { OptionsEditorComponent } from './options-editor.component';

describe('OptionsEditorComponent', () => {
  it('displays existing options on separate lines and counts nonempty options', () => {
    const fixture = TestBed.createComponent(OptionsEditorComponent);
    fixture.componentRef.setInput('value', 'Força;Agilidade;;Magia');
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(textarea.value).toBe('Força\nAgilidade\n\nMagia');
    expect(fixture.nativeElement.textContent).toContain('3 opções');
  });

  it('keeps a trailing newline while typing and emits compatible stored options', () => {
    const fixture = TestBed.createComponent(OptionsEditorComponent);
    fixture.detectChanges();
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.value.subscribe(value => emitted.push(value));
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    textarea.value = 'Força\n';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(textarea.value).toBe('Força\n');
    textarea.value += 'Agilidade';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(emitted).toEqual(['Força;', 'Força;Agilidade']);
    expect(textarea.value).toBe('Força\nAgilidade');
  });

  it('updates after a reset and allows removing every option', () => {
    const fixture = TestBed.createComponent(OptionsEditorComponent);
    fixture.componentRef.setInput('value', 'Uma opção');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 opção');
    fixture.componentRef.setInput('value', undefined);
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(textarea.value).toBe('');
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('0 opções');
  });
});
