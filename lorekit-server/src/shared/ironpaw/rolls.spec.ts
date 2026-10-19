import {
  buildRollPreview,
  executeRoll,
  parseConditionImpact,
  parseRollFormula,
} from './rolls';
import {
  buildNpcRoll,
  calculateNpc,
  createNpcDefinition,
  NPC_THREAT_RULES,
  validateNpcDefinition,
} from './npcs';

describe('Shared Ironpaw rules without platform dependencies', () => {
  it('preserves manual dice and worst-of-two disadvantage', () => {
    expect(parseRollFormula(' 2 D 20 - 3 ')).toEqual({
      attempts: 2,
      sides: 20,
      modifier: -3,
    });
    const values = [10, 1];
    const preview = buildRollPreview(
      3,
      [{ key: 'source', label: 'Corpo', category: 'source', value: 3 }],
      [
        {
          key: 'condition',
          label: 'Desvantagem',
          type: 'disadvantage',
          value: 0,
          displayValue: '',
        },
      ],
    );
    expect(executeRoll(preview, () => values.shift()!, 5)[0]).toMatchObject({
      rolls: [10, 1],
      total: 4,
      status: 'near',
    });
  });
  it('turns zero dice into one die with -3 and matches condition targets', () => {
    const impact = parseConditionImpact(
      'BODY:MINUS 2D10',
      ['BODY'],
      'wound-light',
      'Ferimento',
    );
    expect(impact).not.toBeNull();
    expect(buildRollPreview(1, [], [impact!])).toMatchObject({
      attempts: 1,
      totalModifier: -3,
    });
    expect(
      parseConditionImpact('BODY:-2', ['MIND'], 'test', 'Test'),
    ).toBeNull();
  });
  it('calculates every threat level with explicit protection', () => {
    NPC_THREAT_RULES.forEach((rule, index) => {
      const npc = { ...createNpcDefinition(), threatLevel: index + 1 };
      expect(calculateNpc(npc)).toMatchObject({
        ...rule,
        life: 2 * (index + 1),
        resistance: 0,
      });
      expect(
        calculateNpc({
          ...npc,
          protection: 'Carapaça',
          resistanceAdjustment: 2,
        })?.resistance,
      ).toBe(index + 3);
    });
    expect(calculateNpc(createNpcDefinition())).toBeNull();
  });
  it('rejects invalid threat, adjustments, unsupported protection and severity', () => {
    const npc = createNpcDefinition();
    for (const change of [
      { threatLevel: 7 },
      { threatLevel: 1.5 },
      { lifeAdjustment: 6 },
      { resistanceAdjustment: 1 },
      { threatLevel: 1, lifeAdjustment: -5 },
    ]) {
      expect(
        validateNpcDefinition({ ...npc, ...change }).length,
      ).toBeGreaterThan(0);
    }
    expect(
      validateNpcDefinition({
        ...npc,
        threatLevel: 1,
        actions: [
          {
            id: 'hit',
            name: 'Hit',
            attribute: 'BODY',
            description: '',
            damage: 'devastating',
            target: '',
            resistance: '',
            usage: '',
            cost: '',
            cooldown: '',
          },
        ],
      }).length,
    ).toBeGreaterThan(0);
  });
  it('caps NPC dice and uses only the selected applicable competence', () => {
    const npc = { ...createNpcDefinition(), threatLevel: 6 };
    npc.actions.push({
      id: 'hit',
      name: 'Hit',
      attribute: 'BODY',
      description: '',
      damage: 'moderate',
      target: '',
      resistance: '',
      usage: '',
      cost: '',
      cooldown: '',
    });
    npc.tags.push({
      id: 'strong',
      name: 'Strong',
      type: 'competence',
      description: '',
      attribute: 'BODY',
      diceModifier: 3,
      modifier: 2,
      context: '',
    });
    npc.tags.push({
      id: 'smart',
      name: 'Smart',
      type: 'competence',
      description: '',
      attribute: 'MIND',
      diceModifier: 3,
      modifier: 3,
      context: '',
    });
    expect(buildNpcRoll(npc, 'hit', 'strong')).toMatchObject({
      attempts: 4,
      totalModifier: 5,
    });
    expect(() => buildNpcRoll(npc, 'hit', 'smart')).toThrow();
    expect(buildNpcRoll(npc, 'hit', null).totalModifier).toBe(3);
  });
});
