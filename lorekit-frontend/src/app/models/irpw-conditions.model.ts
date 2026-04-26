export const CONDITION_CATEGORY = {
  ATTRIBUTE: 'ATTRIBUTE',
  SPECIAL: 'SPECIAL',
  PERSISTENT_DAMAGE: 'PERSISTENT_DAMAGE',
  CRITICAL_STATE: 'CRITICAL_STATE',
} as const;

export type ConditionCategoryCode =
  (typeof CONDITION_CATEGORY)[keyof typeof CONDITION_CATEGORY];

export const CONDITION_SEVERITY = {
  LIGHT: 'LIGHT',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
} as const;

export type ConditionSeverityCode =
  (typeof CONDITION_SEVERITY)[keyof typeof CONDITION_SEVERITY];

export const CONDITION = {
  CLUMSY: 'CLUMSY',
  SHAKEN: 'SHAKEN',
  DISTRACTED: 'DISTRACTED',
  DISORIENTED: 'DISORIENTED',
  WEAKENED: 'WEAKENED',

  STUNNED: 'STUNNED',
  FRIGHTENED: 'FRIGHTENED',
  SLOWED: 'SLOWED',
  UNBALANCED: 'UNBALANCED',
  EXHAUSTION: 'EXHAUSTION',
  VULNERABLE: 'VULNERABLE',
  PANICKED: 'PANICKED',
  IMMOBILIZED: 'IMMOBILIZED',

  PERSISTENT_DAMAGE: 'PERSISTENT_DAMAGE',
  BLEEDING: 'BLEEDING',
  BURNING: 'BURNING',

  FAINTING: 'FAINTING',
  DYING: 'DYING',
} as const;

export type ConditionCode =
  (typeof CONDITION)[keyof typeof CONDITION];

export interface ConditionSeverityEffect {
  label: string;
  description: string;
  conditionEffect?: string | string[];

}

export interface ConditionDefinition {
  code: ConditionCode;
  label: string;
  category: ConditionCategoryCode;
  description?: string;
  effects?: Partial<Record<ConditionSeverityCode, ConditionSeverityEffect>>;
}

export interface ActiveConditionState {
  code: ConditionCode;
  severity: ConditionSeverityCode;
}

export const CONDITION_CATEGORY_LABEL: Record<ConditionCategoryCode, string> = {
  ATTRIBUTE: 'Atributo',
  SPECIAL: 'Especial',
  PERSISTENT_DAMAGE: 'Dano persistente',
  CRITICAL_STATE: 'Estado crítico',
};

export const CONDITION_SEVERITY_LABEL: Record<ConditionSeverityCode, string> = {
  LIGHT: 'Leve',
  MODERATE: 'Moderado',
  SEVERE: 'Severo',
};

export const CONDITIONS: Record<ConditionCode, ConditionDefinition> = {
  CLUMSY: {
    code: CONDITION.CLUMSY,
    label: 'Atrapalhado',
    category: CONDITION_CATEGORY.ATTRIBUTE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description: '-2 em rolagens de Técnica.',
        conditionEffect: 'TECHNIQUE:-2',
      },
      MODERATE: {
        label: 'Moderado',
        description: '-1d10 em rolagens de Técnica.',
        conditionEffect: 'TECHNIQUE:MINUS 1d10',
      },
      SEVERE: {
        label: 'Severo',
        description: 'Desvantagem em rolagens de Técnica.',
        conditionEffect: 'TECHNIQUE:DISADVANTAGE',
      },
    },
  },

  SHAKEN: {
    code: CONDITION.SHAKEN,
    label: 'Abalado',
    category: CONDITION_CATEGORY.ATTRIBUTE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description: '-2 em rolagens de Presença.',
        conditionEffect: 'PRESENCE:-2',
      },
      MODERATE: {
        label: 'Moderado',
        description: '-1d10 em rolagens de Presença.',
        conditionEffect: 'PRESENCE:MINUS 1d10',
      },
      SEVERE: {
        label: 'Severo',
        description: 'Desvantagem em rolagens de Presença.',
        conditionEffect: 'PRESENCE:DISADVANTAGE',
      },
    },
  },

  DISTRACTED: {
    code: CONDITION.DISTRACTED,
    label: 'Desconcentrado',
    category: CONDITION_CATEGORY.ATTRIBUTE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          '-2 em rolagens de Mente ou Técnica, dependendo da fonte, e Conjuração.',
        conditionEffect: ['MIND:-2', 'TECHNIQUE:-2', 'CONJURATION:-2'],
      },
      MODERATE: {
        label: 'Moderado',
        description:
          '-1d10 em rolagens de Mente ou Técnica, dependendo da fonte, e Conjuração.',
        conditionEffect: ['MIND:MINUS 1d10', 'TECHNIQUE:MINUS 1d10', 'CONJURATION:MINUS 1d10'],
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Desvantagem em rolagens de Mente, Técnica e Conjuração.',
        conditionEffect: ['MIND:DISADVANTAGE', 'TECHNIQUE:DISADVANTAGE', 'CONJURATION:DISADVANTAGE'],
      },
    },
  },

  DISORIENTED: {
    code: CONDITION.DISORIENTED,
    label: 'Desorientado',
    category: CONDITION_CATEGORY.ATTRIBUTE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description: '-2 em rolagens de Percepção.',
        conditionEffect: 'PERCEPTION:-2',
      },
      MODERATE: {
        label: 'Moderado',
        description:
          '-1d10 em rolagens de Percepção e ataques por trás possuem +2 na rolagem.',
        conditionEffect: 'PERCEPTION:MINUS 1d10',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Desvantagem em rolagens de Percepção e ataques por trás possuem +1d10 na rolagem.',
        conditionEffect: 'PERCEPTION:DISADVANTAGE',
      },
    },
  },

  WEAKENED: {
    code: CONDITION.WEAKENED,
    label: 'Enfraquecido',
    category: CONDITION_CATEGORY.ATTRIBUTE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description: '-2 em rolagens de Corpo.',
        conditionEffect: 'BODY:-2',
      },
      MODERATE: {
        label: 'Moderado',
        description: '-1d10 em rolagens de Corpo.',
        conditionEffect: 'BODY:MINUS 1d10',
      },
      SEVERE: {
        label: 'Severo',
        description: 'Desvantagem em rolagens de Corpo.',
        conditionEffect: 'BODY:DISADVANTAGE',
      },
    },
  },

  STUNNED: {
    code: CONDITION.STUNNED,
    label: 'Atordoado',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      MODERATE: {
        label: 'Moderado',
        description:
          '-1d10 em rolagens de Mente, Presença, Técnica e Percepção.',
        conditionEffect: ['MIND:MINUS 1d10', 'PRESENCE:MINUS 1d10', 'TECHNIQUE:MINUS 1d10', 'PERCEPTION:MINUS 1d10'],
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Desvantagem em rolagens de Mente, Presença, Técnica e Percepção.',
        conditionEffect: ['MIND:DISADVANTAGE', 'PRESENCE:DISADVANTAGE', 'TECHNIQUE:DISADVANTAGE', 'PERCEPTION:DISADVANTAGE'],
      },
    },
  },

  FRIGHTENED: {
    code: CONDITION.FRIGHTENED,
    label: 'Amedrontado',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          '-2 em rolagens e testes que não envolvem fugir ou evitar a fonte de medo.',
        conditionEffect: ['MIND:-2', 'PRESENCE:-2'],
      },
      MODERATE: {
        label: 'Moderado',
        description:
          '-1d10 em rolagens e testes que não envolvem fugir ou evitar a fonte de medo.',
        conditionEffect: ['MIND:MINUS 1d10', 'PRESENCE:MINUS 1d10'],
      },
      SEVERE: {
        label: 'Severo',
        description:
          'O personagem perde o controle e apenas tenta evitar a fonte do medo, sempre tendo desvantagem em qualquer ação que não seja para esse fim.',
        conditionEffect: ['MIND:DISADVANTAGE', 'PRESENCE:DISADVANTAGE'],
      },
    },
  },

  SLOWED: {
    code: CONDITION.SLOWED,
    label: 'Desacelerado',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          'A criatura tem a movimentação reduzida em geral e possui -2 em testes que envolvem movimento.',
        conditionEffect: ['MOVEMENT:-2'],
      },
      MODERATE: {
        label: 'Moderado',
        description:
          'A criatura tem a movimentação reduzida tremendamente e possui -1d10 em testes que envolvem movimento.',
        conditionEffect: ['MOVEMENT:MINUS 1d10'],
      },
      SEVERE: {
        label: 'Severo',
        description:
          'A criatura não consegue correr e tem desvantagem em testes que envolvem movimento.',
        conditionEffect: ['MOVEMENT:DISADVANTAGE'],
      },
    },
  },

  UNBALANCED: {
    code: CONDITION.UNBALANCED,
    label: 'Desequilibrado',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      LIGHT: {
        label: 'Leve',
        description: '-2 em rolagens de esquivas.',
        conditionEffect: 'REFLEXES:-2',
      },
      MODERATE: {
        label: 'Moderado',
        description: '-1d10 em rolagens de Reflexos.',
        conditionEffect: 'REFLEXES:MINUS 1d10',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'O próximo ataque que acertar derruba a criatura no chão e a torna Desorientado Moderado.',
        conditionEffect: 'REFLEXES:DISADVANTAGE',
      },
    },
  },

  EXHAUSTION: {
    code: CONDITION.EXHAUSTION,
    label: 'Exaustão',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      LIGHT: {
        label: 'Leve',
        description: '-1 em rolagens de Corpo e Mente.',
        conditionEffect: ['BODY:-1', 'MIND:-1'],
      },
      MODERATE: {
        label: 'Moderado',
        description: '-1d10 em rolagens de Corpo ou Mente, usando o pior caso.',
        conditionEffect: ['BODY:MINUS 1d10', 'MIND:MINUS 1d10'],
      },
      SEVERE: {
        label: 'Severo',
        description:
          'O personagem possui desvantagem em qualquer ação prolongada.',
        conditionEffect: ['EXHAUSTION:DISADVANTAGE'],
      },
    },
  },

  VULNERABLE: {
    code: CONDITION.VULNERABLE,
    label: 'Vulnerável',
    category: CONDITION_CATEGORY.SPECIAL,
    description:
      'A criatura tornou-se vulnerável de alguma forma, tornando ataques físicos mais danosos, que causam +1 CV de dano. Após ser atacada, independente de acerto ou não, a condição termina.',
  },

  PERSISTENT_DAMAGE: {
    code: CONDITION.PERSISTENT_DAMAGE,
    label: 'Dano Persistente',
    category: CONDITION_CATEGORY.PERSISTENT_DAMAGE,
    description:
      'Enquanto tiver essa condição, a criatura recebe dano por rodada. Essa condição age como uma condição guarda-chuva que pode abranger múltiplos tipos de dano diferente.',
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Leve ao final de cada rodada.',
      },
      MODERATE: {
        label: 'Moderado',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Leve ao final de cada rodada + uma Condição de Atributo Leve.',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Moderado ao final de cada rodada + uma Condição de Atributo Moderado ou algum outro efeito devastador.',
      },
    },
  },

  BLEEDING: {
    code: CONDITION.BLEEDING,
    label: 'Sangramento',
    category: CONDITION_CATEGORY.PERSISTENT_DAMAGE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Leve ao final de cada rodada.',
      },
      MODERATE: {
        label: 'Moderado',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Leve ao final de cada rodada + Enfraquecido Leve.',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Moderado ao final de cada rodada + Enfraquecido Moderado, sendo considerado ter uma hemorragia grave.',
      },
    },
  },

  BURNING: {
    code: CONDITION.BURNING,
    label: 'Em chamas',
    category: CONDITION_CATEGORY.PERSISTENT_DAMAGE,
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Leve ao final de cada rodada.',
      },
      MODERATE: {
        label: 'Moderado',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Leve ao final de cada rodada + Desconcentrado Leve.',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Até a condição ser tratada ou terminar, a criatura recebe dano Moderado ao final de cada rodada + Atrapalhado Moderado, e a criatura cai no chão tentando apagar o fogo de si.',
      },
    },
  },

  FAINTING: {
    code: CONDITION.FAINTING,
    label: 'Desmaiando',
    category: CONDITION_CATEGORY.CRITICAL_STATE,
    description:
      'O personagem imediatamente cai no chão e solta tudo em suas mãos, conseguindo se levantar apenas no turno seguinte. Todas as rolagens, exceto Fortitude, têm -1d10. A movimentação em geral é reduzida. Ao final de toda ação Livre ou Ofensiva, o personagem faz um teste com a perícia Fortitude para continuar acordado; caso falhe três vezes, desmaia e fica inconsciente. A condição termina automaticamente quando a fonte que está provocando ela se extingue.',
  },

  DYING: {
    code: CONDITION.DYING,
    label: 'Morrendo',
    category: CONDITION_CATEGORY.CRITICAL_STATE,
    description:
      'O personagem imediatamente cai no chão beirando a inconsciência e solta tudo em suas mãos. Todas as rolagens possuem desvantagem, exceto Fortitude. Ao final de uma rodada, o personagem faz um teste com a perícia Fortitude com dificuldade crescente, começando como Rotineiro e indo até Difícil. Em uma falha, ele tem uma parada cardíaca e precisa de primeiros socorros o mais rápido possível. A dificuldade pausa quando a condição termina e resume seu crescimento ao adquiri-la novamente. Ela apenas retorna à Rotineira no final de um Descanso Completo. A condição termina automaticamente quando a fonte que está provocando ela se extingue.',
  },

  PANICKED: {
    code: CONDITION.PANICKED,
    label: 'Em Pânico',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      LIGHT: {
        label: 'Leve',
        description:
          '-1 em rolagens em testes de Técnica e Mente, e o personagem não consegue ignorar ameaças.',
      },
      MODERATE: {
        label: 'Moderado',
        description:
          '-1d10 em testes sob pressão. O personagem passa a tomar ações levemente irracionais.',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'O personagem possui desvantagem em testes que exigem racionalidade ou complexidade e não consegue agir livremente quando sob ameaça; suas ações devem sempre responder diretamente à ameaça mais imediata.',
      },
    },
  },

  IMMOBILIZED: {
    code: CONDITION.IMMOBILIZED,
    label: 'Imobilizado',
    category: CONDITION_CATEGORY.SPECIAL,
    effects: {
      MODERATE: {
        label: 'Moderado',
        description:
          'Incapaz de se mover e possui -1d10 em rolagens que precisam de movimento preciso. Ataques para atingir essa criatura ganham +1d10.',
      },
      SEVERE: {
        label: 'Severo',
        description:
          'Incapaz de se mover e agir até que a condição termine.',
      },
    },
  },
};
