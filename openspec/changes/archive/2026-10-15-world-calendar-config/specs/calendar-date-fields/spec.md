# Spec Delta

## Purpose

Permitir registrar datas de mundos fictícios como campos dinâmicos de entidades, com seleção de calendário, validação compartilhada e apresentação coerente com a cronologia do mundo.

## ADDED Requirements

### Requirement: Tipo Data do calendário
O catálogo de campos dinâmicos SHALL oferecer Data do calendário. Sua configuração SHALL permitir calendário fixo ou seleção entre calendários do mundo da entidade, formato de apresentação e permissão de horário. Cada valor MUST identificar o calendário e a revisão realmente utilizados.

#### Scenario: Campo fixo
- **WHEN** o usuário configura Nascimento para um calendário específico
- **THEN** o formulário utiliza esse calendário e não permite selecionar outro ao preencher o valor

#### Scenario: Calendário selecionável
- **WHEN** o campo permite selecionar calendário
- **THEN** o usuário escolhe entre os calendários do mundo da entidade e o valor registra essa escolha

#### Scenario: Campo global em vários mundos
- **WHEN** uma definição fixa aponta para calendário que não pertence ao mundo da entidade
- **THEN** a interface informa a incompatibilidade e exige configurar ou associar um calendário permitido antes de preencher, sem alterar valores existentes

### Requirement: Entrada compartilhada e precisão
O campo SHALL oferecer contagem dos anos, ano, mês e dia conforme o calendário e a precisão escolhidos, com horário opcional quando permitido. SHALL aceitar valor vazio e MUST preservar precisão anual, mensal ou diária e distinguir ausência de horário de meia-noite.

#### Scenario: Calendário sem meses
- **WHEN** o usuário preenche uma data em um calendário sem meses
- **THEN** o controle utiliza ano e dia do ano, sem exigir mês

#### Scenario: Data anual
- **WHEN** o nascimento é conhecido apenas como ano 4 PR
- **THEN** o campo apresenta e persiste somente a precisão anual

#### Scenario: Limpar o valor
- **WHEN** o usuário limpa a data preenchida
- **THEN** o campo fica vazio sem criar uma data padrão

### Requirement: Validação e exibição coerentes
O campo SHALL validar e formatar datas pelas mesmas regras usadas nas timelines. Entradas inválidas MUST apresentar erro contextual e não substituir o último valor válido. Mudanças de formato ou de contagem MUST preservar a data registrada.

#### Scenario: Dia fora do mês
- **WHEN** o usuário informa dia 37 para um mês com 36 dias
- **THEN** o controle explica o limite e mantém o valor válido anteriormente salvo

#### Scenario: Trocar exibição
- **WHEN** o usuário altera o formato curto para o narrativo
- **THEN** o campo passa a mostrar a mesma data com a nova apresentação

### Requirement: Dependências e troca de configuração
Ao trocar calendário ou revisão de um campo com valores, o sistema SHALL revisar os valores afetados antes de confirmar a mudança. Dependências ausentes MUST manter valores preservados e identificáveis, sem aplicar outro calendário ou invalidar silenciosamente o conteúdo.

#### Scenario: Calendário ausente
- **WHEN** uma entidade possui valor cujo calendário ou revisão está indisponível
- **THEN** o campo informa a dependência ausente e preserva o valor para resolução posterior

#### Scenario: Alterar calendário fixo
- **WHEN** uma nova configuração aponta para calendário diferente do utilizado nos valores
- **THEN** o sistema apresenta os valores afetados e exige associação explícita antes de convertê-los


### Requirement: Campo compacto e seleção fora da célula
O campo SHALL apresentar um input compacto com botão de calendário embutido na lateral. O painel de seleção SHALL ser renderizado fora dos ancestrais com recorte, respeitar os limites da viewport e oferecer rolagem do sistema. Confirmar uma data válida SHALL gravar o valor pelo fluxo dos campos dinâmicos; fechar ou cancelar sem confirmar MUST preservar o valor anterior.

#### Scenario: Célula pequena
- **WHEN** o campo ocupa uma célula de uma linha numa ficha
- **THEN** input e botão permanecem contidos na célula e o painel abre fora dela, sem esconder os controles de confirmação

#### Scenario: Confirmar e reabrir
- **WHEN** o usuário escolhe calendário e data e aciona Usar data
- **THEN** o valor versionado é salvo imediatamente e permanece disponível após reabrir o banco

#### Scenario: Cancelar ou informar data inválida
- **WHEN** o usuário apenas troca a seleção de calendário, fecha o painel ou informa uma data inválida
- **THEN** o último valor salvo permanece preservado, sem converter automaticamente a data para o novo calendário
