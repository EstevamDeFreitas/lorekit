# Spec Delta

## Purpose

Permitir navegar e registrar acontecimentos de mundos fictícios em timelines que reutilizam calendários, com conversão revisável das cronologias existentes e escalas adequadas à precisão das datas.

## ADDED Requirements

### Requirement: Vinculação opcional e compartilhada
Uma timeline SHALL poder utilizar um calendário e uma revisão do seu mundo e selecionar a contagem dos anos e o formato de exibição. Várias timelines SHALL poder compartilhar o calendário. Timelines sem calendário MUST manter sua unidade livre e seu comportamento existente.

#### Scenario: Calendário compartilhado
- **WHEN** duas timelines selecionam o mesmo calendário e revisão
- **THEN** ambas usam as mesmas regras e contagens, mantendo eventos e organização narrativa independentes

#### Scenario: Cronologia livre
- **WHEN** o usuário mantém uma timeline sem calendário
- **THEN** suas posições numéricas, unidade de tempo, eras e textos de data continuam utilizáveis

### Requirement: Revisão da conversão de posições existentes
Ao vincular calendário a uma timeline com conteúdo, o sistema SHALL solicitar uma correspondência entre posições legadas e datas do calendário. MUST apresentar prévia para eventos, grandes marcos e eras, identificar valores sem correspondência válida e persistir a conversão somente após confirmação explícita.

#### Scenario: Interpretar números como anos
- **WHEN** o usuário associa a posição zero a um ano escolhido e interpreta cada unidade antiga como um ano
- **THEN** a prévia mostra a posição temporal de cada item e registra precisão anual quando nenhum dia foi definido

#### Scenario: Texto sem interpretação automática
- **WHEN** um evento contém uma data textual como durante a guerra e uma posição numérica
- **THEN** o texto é preservado como descrição de data e não é interpretado silenciosamente como uma data exata

#### Scenario: Posição fracionária ou ambígua
- **WHEN** uma posição antiga não pode ser resolvida pelo mapeamento escolhido
- **THEN** a conversão exige associação manual para o item e não arredonda nem descarta o valor original

#### Scenario: Cancelamento da revisão
- **WHEN** o usuário cancela a vinculação antes da confirmação
- **THEN** calendário, posições, eras e eventos permanecem inalterados

### Requirement: Transformação revisável das eras
Na vinculação, o sistema SHALL avisar que eras podem ser transformadas em contagens dos anos do calendário e revisá-las individualmente. MUST permitir convertê-las ou mantê-las como períodos narrativos, preservar seu conteúdo e informar que contagens convertidas serão compartilhadas pelas timelines do calendário.

#### Scenario: Converter era
- **WHEN** o usuário converte uma era com nome, descrição, imagens, personalização e limites revisados
- **THEN** o calendário recebe a referência e contagem configuradas e o conteúdo original continua preservado e consultável

#### Scenario: Eras sobrepostas
- **WHEN** duas eras antigas representam guerras simultâneas
- **THEN** a revisão permite mantê-las como períodos narrativos sobrepostos sem forçar uma contagem dos anos incompatível

#### Scenario: Falha durante a transformação
- **WHEN** a confirmação encontra erro ao salvar a conversão
- **THEN** nenhum item fica parcialmente convertido e os registros legados continuam disponíveis

### Requirement: Datas de eventos e grandes marcos
Eventos e grandes marcos de uma timeline com calendário SHALL aceitar data ou intervalo estruturado, precisão de ano, mês ou dia e horário opcional. MUST validar os limites no calendário selecionado e preservar datas parciais sem apresentá-las como instantes exatos.

#### Scenario: Intervalo atravessando ano
- **WHEN** um evento começa no último mês de um ano e termina no primeiro mês do seguinte
- **THEN** a timeline o posiciona em ordem cronológica e apresenta os dois limites corretamente

#### Scenario: Evento no mesmo dia
- **WHEN** dois eventos têm o mesmo dia mas somente um possui horário
- **THEN** o sistema distingue a data sem horário e não presume que ela ocorreu à meia-noite

#### Scenario: Intervalo impossível
- **WHEN** o fim é anterior ao início ou os limites parciais não permitem estabelecer ordem consistente
- **THEN** o sistema exige correção ou maior precisão antes de salvar o intervalo

### Requirement: Zoom por escala temporal
A timeline SHALL oferecer escalas de séculos, décadas, anos, meses, semanas e dias conforme as divisões disponíveis no calendário. Os limites e larguras MUST refletir sua duração real, e o zoom MUST manter a data focal. Semanas desabilitadas e meses inexistentes MUST ser omitidos.

#### Scenario: Meses de durações distintas
- **WHEN** o usuário aproxima até meses em um ano com meses de 40 e 20 dias
- **THEN** o mês de 40 dias ocupa o dobro da largura temporal do mês de 20 dias

#### Scenario: Mudança de escala
- **WHEN** o usuário aproxima uma data de uma visão por séculos para uma visão por dias
- **THEN** a data continua sendo a referência focal e as divisões passam a respeitar o calendário

#### Scenario: Séculos atravessando referência
- **WHEN** a régua atravessa um marco com contagem sem ano zero
- **THEN** os rótulos respeitam os lados e sua numeração, sem criar um ano zero fictício nem deslocar os eventos

### Requirement: Navegação e edição temporal acessíveis
A timeline SHALL oferecer seletor de escala, ação Ir para data e edição por formulário como alternativa ao arraste. O arraste SHALL mostrar a data proposta e usar ajuste temporal explícito; mover um intervalo MUST preservar sua duração e sua precisão.

#### Scenario: Mover intervalo por dias
- **WHEN** um intervalo de três dias é arrastado com ajuste diário
- **THEN** a prévia informa suas novas datas e a duração permanece três dias após confirmação

#### Scenario: Edição sem mouse
- **WHEN** o usuário seleciona um evento pelo teclado
- **THEN** consegue editar sua data no mesmo seletor utilizado no formulário, com foco visível

#### Scenario: Precisão anual ao arrastar
- **WHEN** um evento conhecido somente pelo ano é reposicionado
- **THEN** ele mantém precisão anual e o sistema não cria mês ou dia para adequá-lo à posição do cursor

### Requirement: Densidade e extensão temporal
A timeline SHALL carregar e desenhar as divisões necessárias ao trecho visível, inclusive em cronologias extensas. Eventos densos SHALL ser agrupados de forma identificável, permitindo acessar todos os itens sem perder suas datas ou ordem.

#### Scenario: Cronologia extensa
- **WHEN** uma timeline cobre milhares de anos e o usuário visualiza um mês
- **THEN** a navegação continua utilizável sem construir uma divisão visual para cada dia de toda a cronologia

#### Scenario: Eventos agrupados
- **WHEN** vários eventos ocupam espaço insuficiente na escala atual
- **THEN** a timeline indica sua quantidade e permite listar ou aproximar os eventos do grupo

### Requirement: Troca e remoção de calendário
Trocar calendário ou revisão SHALL exigir prévia e associação explícita das datas; nenhuma equivalência automática entre calendários SHALL ser presumida. Remover o vínculo SHALL exigir confirmação e conservar as datas originais e a projeção legada para consulta, sem modificar outras timelines do calendário.

#### Scenario: Trocar calendário
- **WHEN** o destino tem meses ou dias diferentes
- **THEN** a revisão mostra os itens afetados, exige resolver datas incompatíveis e aplica somente o plano confirmado

#### Scenario: Remover vínculo
- **WHEN** o usuário confirma voltar a uma cronologia livre
- **THEN** a timeline usa sua projeção numérica, conserva as datas anteriores e não exclui contagens compartilhadas do calendário
