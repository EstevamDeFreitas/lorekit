/**
 * Códigos estáveis dos grupos de atributo
 */
export const ATTRIBUTE_GROUP = {
  BODY: 'BODY',
  MIND: 'MIND',
  PRESENCE: 'PRESENCE',
  TECHNIQUE: 'TECHNIQUE',
} as const;

export type AttributeGroupCode =
  (typeof ATTRIBUTE_GROUP)[keyof typeof ATTRIBUTE_GROUP];

/**
 * Códigos estáveis das perícias
 */
export const SKILL = {
  ATHLETICS: 'ATHLETICS',
  BRUTE_STRENGTH: 'BRUTE_STRENGTH',
  FORTITUDE: 'FORTITUDE',
  REFLEXES: 'REFLEXES',
  FIGHT: 'FIGHT',

  INVESTIGATION: 'INVESTIGATION',
  KNOWLEDGE: 'KNOWLEDGE',
  MEDICINE: 'MEDICINE',
  STRATEGY: 'STRATEGY',
  FOCUS: 'FOCUS',

  DIPLOMACY: 'DIPLOMACY',
  INTIMIDATION: 'INTIMIDATION',
  DECEPTION: 'DECEPTION',
  PERFORMANCE: 'PERFORMANCE',
  WILLPOWER: 'WILLPOWER',
  INTUITION: 'INTUITION',

  ACCURACY: 'ACCURACY',
  CRAFTS_AND_TRADES: 'CRAFTS_AND_TRADES',
  SLEIGHT_OF_HAND: 'SLEIGHT_OF_HAND',
  STEALTH: 'STEALTH',
  TOOLS_AND_DEVICES: 'TOOLS_AND_DEVICES',
} as const;

export type SkillCode = (typeof SKILL)[keyof typeof SKILL];

/**
 * Labels exibidos na tela.
 * Pode trocar à vontade sem quebrar o domínio do app.
 */
export const ATTRIBUTE_GROUP_LABEL: Record<AttributeGroupCode, string> = {
  BODY: 'Corpo',
  MIND: 'Mente',
  PRESENCE: 'Presença',
  TECHNIQUE: 'Técnica',
};

export const SKILL_LABEL: Record<SkillCode, string> = {
  ATHLETICS: 'Atletismo',
  BRUTE_STRENGTH: 'Força Bruta',
  FORTITUDE: 'Fortitude',
  REFLEXES: 'Reflexos',
  FIGHT: 'Briga',

  INVESTIGATION: 'Investigação',
  KNOWLEDGE: 'Conhecimento',
  MEDICINE: 'Medicina',
  STRATEGY: 'Estratégia',
  FOCUS: 'Foco',

  DIPLOMACY: 'Diplomacia',
  INTIMIDATION: 'Intimidação',
  DECEPTION: 'Enganação',
  PERFORMANCE: 'Performance',
  WILLPOWER: 'Vontade',
  INTUITION: 'Intuição',

  ACCURACY: 'Precisão',
  CRAFTS_AND_TRADES: 'Artesanato & Ofícios',
  SLEIGHT_OF_HAND: 'Mãos ardilosas',
  STEALTH: 'Furtividade',
  TOOLS_AND_DEVICES: 'Ferramentas & Aparelhos',
};

/**
 * Estrutura principal de referência
 */
export const ATTRIBUTE_GROUP_SKILLS: Record<AttributeGroupCode, SkillCode[]> = {
  BODY: [
    SKILL.ATHLETICS,
    SKILL.BRUTE_STRENGTH,
    SKILL.FORTITUDE,
    SKILL.REFLEXES,
    SKILL.FIGHT,
  ],
  MIND: [
    SKILL.INVESTIGATION,
    SKILL.KNOWLEDGE,
    SKILL.MEDICINE,
    SKILL.STRATEGY,
    SKILL.FOCUS,
  ],
  PRESENCE: [
    SKILL.DIPLOMACY,
    SKILL.INTIMIDATION,
    SKILL.DECEPTION,
    SKILL.PERFORMANCE,
    SKILL.WILLPOWER,
    SKILL.INTUITION,
  ],
  TECHNIQUE: [
    SKILL.ACCURACY,
    SKILL.CRAFTS_AND_TRADES,
    SKILL.SLEIGHT_OF_HAND,
    SKILL.STEALTH,
    SKILL.TOOLS_AND_DEVICES,
  ],
};
