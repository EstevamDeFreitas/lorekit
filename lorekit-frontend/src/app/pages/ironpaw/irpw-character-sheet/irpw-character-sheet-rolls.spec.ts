import { IrpwCharacterSheetComponent } from './irpw-character-sheet.component';

describe('Ironpaw tactical roll formulas', () => {
  function createSheet(): IrpwCharacterSheetComponent {
    const sheet = Object.create(IrpwCharacterSheetComponent.prototype) as IrpwCharacterSheetComponent;
    Object.assign(sheet, { rollFormulaMode: 'manual', rollFormulaError: '', rollTargetValue: null, rollResults: [] });
    return sheet;
  }

  for (const sides of [4, 6, 10, 20]) {
    it('rolls d' + sides + ' with separate attempts and a modifier on each', () => {
      const sheet = createSheet();
      spyOn(Math, 'random').and.returnValues(0, 0.999999);
      sheet.onRollFormulaInputChange('2d' + sides + '-2');
      sheet.rollDice();
      expect(sheet.rollFormulaError).toBe('');
      expect(sheet.rollPreview.sides).toBe(sides);
      expect(sheet.rollResults.map(result => result.dieValue)).toEqual([1, sides]);
      expect(sheet.rollResults.map(result => result.total)).toEqual([-1, sides - 2]);
      expect(sheet.rollResults.every(result => result.resolutionLabel === '1d' + sides)).toBeTrue();
    });
  }

  it('accepts uppercase, whitespace, and an optional modifier', () => {
    const sheet = createSheet();
    sheet.onRollFormulaInputChange(' 3 D 20 + 4 ');
    expect(sheet.rollPreview.attempts).toBe(3);
    expect(sheet.rollPreview.totalModifier).toBe(4);
    sheet.onRollFormulaInputChange('1d4');
    expect(sheet.rollPreview.totalModifier).toBe(0);
  });

  it('rejects unsupported dice, unsafe integers and out-of-range counts', () => {
    const sheet = createSheet();
    for (const formula of ['1d8', '0d6', '51d20', '1d6+1.5', '1d4+9007199254740992', '2d6+1d4', '']) {
      sheet.onRollFormulaInputChange(formula);
      sheet.rollDice();
      expect(sheet.rollFormulaError).withContext(formula).not.toBe('');
      expect(sheet.rollResults).toEqual([]);
    }
    sheet.onRollFormulaInputChange('50d6');
    expect(sheet.rollFormulaError).toBe('');
  });

  it('compares each result with the configured target', () => {
    const sheet = createSheet();
    sheet.rollTargetValue = 10;
    spyOn(Math, 'random').and.returnValues(0.999999, 0);
    sheet.onRollFormulaInputChange('2d20');
    sheet.rollDice();
    expect(sheet.rollResults.map(result => result.status)).toEqual(['success', 'fail']);
  });

  it('keeps manual die preview when the manual adjustment changes', () => {
    const sheet = createSheet();
    sheet.onRollFormulaInputChange('2d6+3');
    sheet.rollManualModifier = 7;
    sheet.onRollManualModifierChange();
    expect(sheet.rollFormula).toBe('2d6+3');
    expect(sheet.rollPreview.sides).toBe(6);
    expect(sheet.rollPreview.totalModifier).toBe(3);
  });

  it('retains automatic d10 disadvantage resolution', () => {
    const sheet = createSheet();
    Object.assign(sheet, { buildAutoRollPreview: () => ({ attempts: 1, sides: 10, modifiers: [], totalModifier: 3, resolutionMode: 'disadvantage' }) });
    sheet.resetRollFormulaToAuto();
    spyOn(Math, 'random').and.returnValues(0.999999, 0);
    sheet.rollDice();
    expect(sheet.rollFormula).toBe('2d10+3 (desvantagem)');
    expect(sheet.rollResults[0].rolls).toEqual([10, 1]);
    expect(sheet.rollResults[0].total).toBe(4);
  });
});
