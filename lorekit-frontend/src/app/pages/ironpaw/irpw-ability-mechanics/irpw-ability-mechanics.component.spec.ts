import { TestBed } from '@angular/core/testing';
import { IrpwAbilityMechanicsComponent } from './irpw-ability-mechanics.component';
import { IrpwVocationHability } from '../../../models/irpw-vocation.model';

describe('Ironpaw ability editor', () => {
  it('combines the selected grade cost with the remodeling surcharge', () => {
    const fixture = TestBed.createComponent(IrpwAbilityMechanicsComponent);
    const ability: IrpwVocationHability = { type: 'magic', description: '', grade: 'minor', cost: 2, variations: [{ grade: 'medium', cost: 6, description: '' }] };
    fixture.componentRef.setInput('ability', ability);
    fixture.detectChanges();
    fixture.componentInstance.addRemodeling();
    const remodeling = ability.remodelings![0];
    expect(fixture.componentInstance.remodelingCost(remodeling)).toBe(3);
    remodeling.kind = 'potential';
    fixture.componentInstance.changeRemodeling(remodeling);
    expect(remodeling.grade).toBe('medium');
    expect(fixture.componentInstance.remodelingCost(remodeling)).toBe(8);
    fixture.componentInstance.removeRemodeling(0);
    expect(ability.remodelings).toEqual([]);
  });
  it('emits changes when creating a variation and resets mechanics for a trick', () => {
    const fixture = TestBed.createComponent(IrpwAbilityMechanicsComponent);
    const ability: IrpwVocationHability = { type: 'magic', description: '', grade: 'minor' };
    fixture.componentRef.setInput('ability', ability);
    const changed = jasmine.createSpy('changed');
    fixture.componentInstance.changed.subscribe(changed);
    fixture.componentInstance.addVariation();
    fixture.componentInstance.setVariationGrade(0, 'major');
    expect(ability.variations?.[0].cost).toBe(5);
    expect(changed).toHaveBeenCalled();
    fixture.componentInstance.setSpellKind('trick');
    fixture.detectChanges();
    expect(ability.cost).toBe(0);
    expect(ability.variations).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('não podem ser remodelados');
    expect(fixture.nativeElement.querySelectorAll('textarea').length).toBe(0);
  });
});
