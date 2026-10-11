import { ATTRIBUTE_GROUP, ATTRIBUTE_GROUP_SKILLS, SKILL } from '../../../models/irpw-attributes-skills.model';
import { IrpwCharacterSheet } from '../../../models/irpw-character-sheet.model';
import { IrpwCharacterSheetComponent } from './irpw-character-sheet.component';

describe('Ironpaw resource and conjuration persistence', () => {
  function createSheet(): IrpwCharacterSheetComponent {
    const sheet = Object.create(IrpwCharacterSheetComponent.prototype) as IrpwCharacterSheetComponent;
    Object.assign(sheet, {
      selectedCharacterId: 'character-1', selectedCharacter: null, currentSheet: new IrpwCharacterSheet('character-1'),
      irpwSpecieService: { getConfig: () => null }, vocationSkillMinimums: {}, activeConditionsData: [], marksData: [],
      scheduleAutoSave: jasmine.createSpy('scheduleAutoSave'), updateRollFormulaIfAuto: jasmine.createSpy('updateRollFormulaIfAuto'),
    });
    return sheet;
  }
  it('loads legacy quarter values into half-box life states', () => {
    const sheet = createSheet();
    sheet.currentSheet!.lifepoints = JSON.stringify({ maxPoints: 4, currentPoints: 2.25 });
    sheet.parseLifepoints();
    expect(sheet.lifepointsData.currentPoints).toBe(2.5);
    expect(sheet.getLifeFillHalves(3)).toBe(1);
  });
  it('adds full temporary life boxes while keeping permanent life independent', () => {
    const sheet = createSheet();
    sheet.lifepointsData = { maxPoints: 4, currentPoints: 1.5, temporaryPoints: 2, temporaryCurrentPoints: 1 };
    sheet.pendingLifeMaxPoints = 4;
    sheet.pendingLifeTemporaryPoints = 3;
    spyOn(sheet, 'onLifepointsChange');
    sheet.saveLifeMaxPoints();
    expect(sheet.lifepointsData.temporaryCurrentPoints).toBe(2);
    sheet.toggleTemporaryLife(2);
    expect(sheet.lifepointsData.temporaryCurrentPoints).toBe(1);
    expect(sheet.lifepointsData.currentPoints).toBe(1.5);
  });
  it('does not restore spent temporary boxes when saving the same capacity', () => {
    const sheet = createSheet();
    sheet.lifepointsData = { maxPoints: 4, currentPoints: 2, temporaryPoints: 3, temporaryCurrentPoints: 0 };
    sheet.pendingLifeMaxPoints = 4;
    sheet.pendingLifeTemporaryPoints = 3;
    spyOn(sheet, 'onLifepointsChange');
    sheet.saveLifeMaxPoints();
    expect(sheet.lifepointsData.temporaryCurrentPoints).toBe(0);
  });
  it('retains Conjuração training when its parent attribute changes and after reload', () => {
    const sheet = createSheet();
    sheet.parseAttributes();
    sheet.conjurationAttribute = ATTRIBUTE_GROUP.MIND;
    sheet.conjurationLevel = 2;
    sheet.attributesData['BODY'].value = 3;
    sheet.onConjurationAttributeChange(ATTRIBUTE_GROUP.BODY);
    expect(sheet.getAttributeSkills(ATTRIBUTE_GROUP.BODY)).toContain(SKILL.CONJURATION);
    expect(sheet.getAttributeSkills(ATTRIBUTE_GROUP.MIND)).not.toContain(SKILL.CONJURATION);
    expect(sheet.getSkillRollSummary(ATTRIBUTE_GROUP.BODY, SKILL.CONJURATION)).toBe('2d10 + 1 + 3');
    sheet.parseAttributes();
    expect(sheet.conjurationAttribute).toBe(ATTRIBUTE_GROUP.BODY);
    expect(sheet.conjurationLevel).toBe(2);
    expect(ATTRIBUTE_GROUP_SKILLS.BODY).not.toContain(SKILL.CONJURATION);
  });
});
