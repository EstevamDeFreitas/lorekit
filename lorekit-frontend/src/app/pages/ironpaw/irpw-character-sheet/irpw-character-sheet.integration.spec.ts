import { ATTRIBUTE_GROUP_SKILLS, SKILL } from '../../../models/irpw-attributes-skills.model';
import { IrpwCharacterSheetComponent } from './irpw-character-sheet.component';

describe('Ironpaw character sheet assignment transitions', () => {
  function createCharacterAttributes() {
    const attributes: Record<string, { value: number | null; skills: Record<string, number> }> = {};
    for (const group of Object.keys(ATTRIBUTE_GROUP_SKILLS)) {
      attributes[group] = { value: null, skills: {} };
      for (const skill of ATTRIBUTE_GROUP_SKILLS[group as keyof typeof ATTRIBUTE_GROUP_SKILLS]) {
        attributes[group].skills[skill] = 0;
      }
    }
    return attributes;
  }

  function createSheet(): any {
    const sheet = Object.create(IrpwCharacterSheetComponent.prototype) as any;
    sheet.selectedCharacterId = 'character-1';
    sheet.selectedCharacter = {
      id: 'character-1',
      ParentSpecies: { id: 'species-old' },
      ParentIRPWVocation: { id: 'vocation-old', attributes: null },
    };
    sheet.selectedSpecieId = 'species-new';
    sheet.selectedVocationId = 'vocation-new';
    sheet.characters = [sheet.selectedCharacter];
    sheet.filteredCharacters = [sheet.selectedCharacter];
    sheet.availableSpecies = [{ id: 'species-new', name: 'Nova espécie' }];
    sheet.availableVocations = [{ id: 'vocation-new', name: 'Nova vocação', attributes: JSON.stringify({ BODY: { skills: { [SKILL.ATHLETICS]: 2 } } }) }];
    sheet.attributesData = createCharacterAttributes();
    sheet.attributesData.BODY.skills[SKILL.ATHLETICS] = 3;
    sheet.characterService = {
      saveCharacterSpecie: jasmine.createSpy('saveCharacterSpecie'),
      saveCharacterVocation: jasmine.createSpy('saveCharacterVocation'),
    };
    sheet.irpwSpecieService = { ensureConfig: jasmine.createSpy('ensureConfig').and.returnValue({ id: 'species-new' }) };
    sheet.applySpeciesPerceptionMinimums = jasmine.createSpy('applySpeciesPerceptionMinimums');
    sheet.recalculateLifeMinimum = jasmine.createSpy('recalculateLifeMinimum');
    sheet.onAttributesChange = jasmine.createSpy('onAttributesChange');
    sheet.refreshInheritedHabilities = jasmine.createSpy('refreshInheritedHabilities');
    return sheet;
  }

  it('resets skills and applies the new vocation minimums', () => {
    const sheet = createSheet();

    sheet.onVocationSelect();

    expect(sheet.characterService.saveCharacterVocation).toHaveBeenCalledWith('character-1', 'vocation-new');
    expect(sheet.attributesData.BODY.skills[SKILL.ATHLETICS]).toBe(2);
    expect(sheet.onAttributesChange).toHaveBeenCalled();
    expect(sheet.recalculateLifeMinimum).toHaveBeenCalled();
  });

  it('preserves skills and replaces only species-derived values on species change', () => {
    const sheet = createSheet();
    sheet.selectedCharacter.ParentIRPWVocation = { id: 'vocation-old' };
    sheet.attributesData.BODY.skills[SKILL.ATHLETICS] = 3;

    sheet.onSpecieSelect();

    expect(sheet.characterService.saveCharacterSpecie).toHaveBeenCalledWith('character-1', 'species-new');
    expect(sheet.attributesData.BODY.skills[SKILL.ATHLETICS]).toBe(3);
    expect(sheet.applySpeciesPerceptionMinimums).toHaveBeenCalledWith('species-new');
    expect(sheet.recalculateLifeMinimum).toHaveBeenCalled();
  });
});
