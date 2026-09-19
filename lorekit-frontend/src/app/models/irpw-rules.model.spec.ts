import { ATTRIBUTE_GROUP, SKILL } from './irpw-attributes-skills.model';
import {
  getIronpawLifeMinimum,
  parseIrpwPerceptions,
  getVocationSkillMinimums,
  parseVocationSkills,
  serializeVocationSkills,
} from './irpw-rules.model';

describe('Ironpaw rules helpers', () => {
  it('reads legacy vocation values but serializes only skills', () => {
    const raw = JSON.stringify({
      [ATTRIBUTE_GROUP.BODY]: {
        value: 3,
        skills: { [SKILL.ATHLETICS]: 2 },
      },
    });

    const parsed = parseVocationSkills(raw);
    const serialized = JSON.parse(serializeVocationSkills(parsed));

    expect(parsed.BODY.skills[SKILL.ATHLETICS]).toBe(2);
    expect(serialized.BODY.value).toBeUndefined();
    expect(serialized.BODY.skills[SKILL.ATHLETICS]).toBe(2);
  });

  it('extracts vocation skill minimums from every attribute group', () => {
    const raw = JSON.stringify({
      [ATTRIBUTE_GROUP.MIND]: {
        skills: { [SKILL.FOCUS]: 3 },
      },
      [ATTRIBUTE_GROUP.TECHNIQUE]: {
        skills: { [SKILL.STEALTH]: 1 },
      },
    });

    const minimums = getVocationSkillMinimums(raw);

    expect(minimums[SKILL.FOCUS]).toBe(3);
    expect(minimums[SKILL.STEALTH]).toBe(1);
    expect(minimums[SKILL.ATHLETICS]).toBe(0);
  });

  it('calculates life from the base plus vocation and species contributions', () => {
    expect(getIronpawLifeMinimum('3', '2')).toBe(6);
    expect(getIronpawLifeMinimum(null, '2')).toBe(3);
    expect(getIronpawLifeMinimum('invalid', null)).toBe(1);
  });

  it('normalizes species perceptions while preserving nullable values', () => {
    expect(parseIrpwPerceptions(JSON.stringify({ smell: '4.8', vision: 'invalid' }))).toEqual({
      smell: 4,
      vision: null,
      hearing: null,
    });
  });
});
