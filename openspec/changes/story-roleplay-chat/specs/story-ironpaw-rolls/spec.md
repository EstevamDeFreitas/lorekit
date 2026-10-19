## Purpose

Registrar testes e ações de combate Ironpaw junto à narrativa, usando dados explicitamente disponibilizados à História e preservando resultados sem alterar fichas ou recursos de personagens.

## ADDED Requirements

### Requirement: Rolagem baseada no locutor selecionado
O chat SHALL oferecer testes comuns, ataques e defesas a partir do locutor atual com ficha Ironpaw disponibilizada, permitindo escolher a ação, modificadores contextuais explícitos e dificuldade quando aplicável. SHALL mostrar a fórmula e as fontes dos modificadores antes de executar. Sem dados mecânicos, SHALL explicar a ausência de ficha e manter disponível a escrita narrativa. Todos os participantes SHALL poder realizar essas ações com qualquer locutor disponibilizado, sem necessidade de posse do personagem de origem.

#### Scenario: Participante usa personagem compartilhado
- **WHEN** um convidado seleciona um personagem com ficha disponibilizada e escolhe um ataque
- **THEN** vê a ação e sua fórmula com base na revisão compartilhada, sem precisar consultar o cofre de origem

#### Scenario: Locutor sem ficha
- **WHEN** um participante seleciona um locutor apenas visual
- **THEN** pode escrever normalmente e a interface informa que ações Ironpaw exigem uma ficha disponibilizada

### Requirement: Resultados persistentes e imutáveis
A execução online SHALL produzir no servidor um único resultado persistido por operação, com usuário autor, locutor e revisão, tipo de teste, ação, fórmula, fontes dos modificadores, valores dos dados, critério de resolução, dificuldade se houver, resultado e referência de versão das regras. O resultado SHALL aparecer como registro próprio no chat e na exportação Markdown. Dados enviados pelo cliente como resultado MUST NOT ser aceitos como rolagem executada. Repetir a operação após falha de confirmação MUST retornar o mesmo resultado, sem sortear novamente. Resultados publicados MUST NOT ser editados; correções SHALL exigir um novo registro.

#### Scenario: Ficha muda após o teste
- **WHEN** a ficha disponibilizada é atualizada depois de uma rolagem
- **THEN** o registro antigo conserva seus dados e novas rolagens usam a nova revisão

#### Scenario: Repetição após timeout
- **WHEN** o cliente repete uma operação de rolagem já persistida
- **THEN** recebe exatamente os mesmos dados e resultado e não gera outro registro no chat

### Requirement: Combate registrado sem mutação de ficha
Ataques e defesas SHALL poder referenciar um locutor alvo e um registro anterior da mesma História para contextualizar uma oposição, sem impor uma ordem de turnos. Sem dificuldade ou oposição definida, o registro SHALL apresentar o resultado numérico sem inventar sucesso, dano ou consequência. Ações do chat MUST NOT aplicar dano, condições, feridas, consumo de itens, mana, vigor ou outros recursos, nem à origem nem à cópia compartilhada. Efeitos narrativos SHALL permanecer sob controle dos participantes.

#### Scenario: Registrar ataque e defesa
- **WHEN** um participante registra um ataque e outro registra uma defesa relacionada
- **THEN** ambos aparecem no histórico com o vínculo da oposição e nenhuma ficha ou recurso é alterado

### Requirement: Regras de PNJs e compatibilidade das fichas
Rolagens de PNJs SHALL usar a base do NA, no máximo uma Tag de Competência numérica escolhida para a ação, condições e outros efeitos explicitamente aplicáveis, respeitando máximo de 4d10 e as regras gerais de mínimo de dados, desvantagem e modificadores. Descrições de tags MUST NOT ser interpretadas automaticamente como efeitos não estruturados. Reutilizar o motor no chat MUST preservar o comportamento atual das rolagens na tela de ficha, incluindo ajustes manuais e condições, sem passar a exigir conexão para o uso local da ficha.

#### Scenario: Duas competências aplicáveis
- **WHEN** duas Tags de Competência poderiam modificar o atributo da ação de um PNJ
- **THEN** o participante escolhe no máximo uma e a prévia não soma ambas automaticamente

#### Scenario: Ficha local offline
- **WHEN** o usuário realiza uma rolagem na ficha local sem conexão após a introdução do chat
- **THEN** a funcionalidade existente continua disponível e não publica registros na História
