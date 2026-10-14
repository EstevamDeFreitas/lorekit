import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { IrpwRepertoireEditorComponent } from './irpw-repertoire-editor.component';
import { IrpwVocationHability } from '../../../models/irpw-vocation.model';
import { EntityHistoryService } from '../../../services/entity-history.service';

describe('Ironpaw repertoire management', () => {
  function setup(abilities: IrpwVocationHability[]) {
    TestBed.configureTestingModule({ providers: [{ provide: EntityHistoryService, useValue: { register: () => () => {}, applying: () => false } }] });
    // Isolate the existing history-enabled field components; this suite covers repertoire state and mechanics.
    TestBed.overrideComponent(InputComponent, { set: { imports: [FormsModule], template: '<input [ngModel]="value()" (ngModelChange)="value.set($event)">' } });
    TestBed.overrideComponent(TextAreaComponent, { set: { imports: [FormsModule], template: '<textarea [ngModel]="value()" (ngModelChange)="value.set($event)"></textarea>' } });
    const fixture = TestBed.createComponent(IrpwRepertoireEditorComponent);
    fixture.componentRef.setInput('abilities', abilities);
    fixture.componentInstance.changed.subscribe(updated => fixture.componentRef.setInput('abilities', updated));
    fixture.detectChanges();
    return fixture;
  }
  it('filters by category and search while keeping empty results recoverable', () => {
    const fixture = setup([{ id: 'p', name: 'Salto', description: '', type: 'technical' }, { id: 'm', name: 'Luz', description: '', type: 'magic' }]);
    const editor = fixture.componentInstance;
    editor.selectedId.set('p');
    editor.query.set('Luz');
    expect(editor.selected()?.id).toBe('m');
    editor.query.set('');
    editor.setFilter('magic');
    expect(editor.visible().map(a => a.id)).toEqual(['m']);
    editor.query.set('ausente');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum resultado');
    expect(editor.selected()).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Remover item"]')).toBeNull();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search.labels?.[0]?.textContent).toContain('Buscar no repertório');
    editor.add('magic');
    fixture.detectChanges();
    expect(editor.query()).toBe('');
    expect(editor.selected()?.rollSkill).toBe('CONJURATION');
    expect(editor.abilities().length).toBe(3);
  });
  it('duplicates nested spell mechanics independently and keeps selection valid after deletion', () => {
    const ability: IrpwVocationHability = { id: 'm', name: 'Luz', description: '', type: 'magic', variations: [{ grade: 'major', cost: 5, description: 'Original' }], remodelings: [{ id: 'r', name: 'Brilho', kind: 'empower', grade: 'minor', description: '' }] };
    const fixture = setup([ability]);
    const editor = fixture.componentInstance;
    editor.duplicate(ability);
    fixture.detectChanges();
    const copy = editor.selected()!;
    expect(copy.id).not.toBe(ability.id);
    copy.variations![0].description = 'Alterada';
    expect(ability.variations![0].description).toBe('Original');
    editor.remove(copy);
    fixture.detectChanges();
    expect(editor.selected()?.id).toBe('m');
    editor.remove(ability);
    fixture.detectChanges();
    expect(editor.selected()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Seu repertório começa aqui');
  });
  it('refreshes the selected mechanics when a power becomes a spell', () => {
    const ability: IrpwVocationHability = { id: 'p', name: 'Pulso', description: '', type: 'technical', grade: 'master', cost: 5 };
    const fixture = setup([ability]);
    fixture.componentInstance.setType(ability, 'magic');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()?.cost).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Menor');
    expect(fixture.nativeElement.textContent).toContain('Remodelações');
  });
  it('uses the same management for species traits without exposing spell mechanics', () => {
    const fixture = setup([{ id: 'w', name: 'Frio', description: 'Sensível ao frio.' }]);
    fixture.componentRef.setInput('mode', 'weaknesses');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fraqueza');
    expect(fixture.nativeElement.querySelector('irpw-ability-mechanics')).toBeNull();
  });
});
