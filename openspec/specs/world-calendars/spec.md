# World Calendars Specification

## Purpose

Permitir que autores configurem vários calendários por mundo e reutilizem regras coerentes de datas, relógio, contagem dos anos e apresentação em todo o Lorekit.

## Requirements

### Requirement: Calendários independentes por mundo
O sistema SHALL permitir criar, listar e editar vários calendários associados a um mundo. Cada calendário MUST manter regras independentes e poder ser utilizado por várias timelines desse mesmo mundo.

#### Scenario: Duas tradições no mesmo mundo
- **WHEN** o usuário cria um calendário imperial e um calendário lunar no mesmo mundo
- **THEN** ambos permanecem disponíveis e a edição de um não modifica as regras do outro

#### Scenario: Seleção limitada ao mundo
- **WHEN** uma timeline seleciona seu calendário
- **THEN** o sistema oferece somente calendários do seu mundo e identifica claramente o selecionado

### Requirement: Estrutura anual consistente
O sistema SHALL permitir configurar meses ordenados com nome, abreviação e quantidade inteira positiva de dias. O total anual MUST ser calculado pela soma dos meses. Para calendários sem meses, o sistema SHALL permitir definir diretamente os dias por ano.

#### Scenario: Ano com meses diferentes
- **WHEN** o usuário configura dois meses de 40 dias e um de 20 dias
- **THEN** o ano tem 100 dias e a interface mostra esse total calculado

#### Scenario: Ano sem meses
- **WHEN** o calendário usa 400 dias por ano e nenhum mês
- **THEN** datas são selecionadas pelo dia do ano e os controles de mês não aparecem

#### Scenario: Configuração inconsistente
- **WHEN** um mês possui zero dias, duração fracionária ou nome vazio
- **THEN** o sistema explica o erro e impede salvar a configuração inválida

### Requirement: Semanas configuráveis
O sistema SHALL permitir habilitar ou desabilitar semanas, configurar dias ordenados com nomes e abreviações e selecionar continuidade entre meses ou reinício em cada mês. A configuração MUST definir o dia da semana no início do ano canônico zero.

#### Scenario: Semana contínua
- **WHEN** um mês de 37 dias termina em uma semana de cinco dias configurada como contínua
- **THEN** o próximo mês começa no dia da semana seguinte ao último dia do mês anterior

#### Scenario: Reinício mensal
- **WHEN** a semana está configurada para reiniciar a cada mês
- **THEN** o primeiro dia de cada mês recebe o primeiro dia da semana configurada

#### Scenario: Semana desabilitada
- **WHEN** o calendário não utiliza semanas
- **THEN** a seleção de datas e a timeline não exigem nem exibem divisões semanais

### Requirement: Relógio e duração do dia
O sistema SHALL permitir configurar quantidades inteiras positivas de horas por dia, minutos por hora e segundos por minuto, com nomes e abreviações próprios. SHALL permitir duração opcional do dia em horas ou segundos terrestres, convertida de forma consistente e independente das subdivisões locais.

#### Scenario: Dia longo com relógio próprio
- **WHEN** um dia tem 30 horas locais, 60 minutos por hora, 60 segundos por minuto e duração de 36 horas terrestres
- **THEN** a prévia informa 108000 segundos locais por dia e equivalência de 72 minutos terrestres por hora local

#### Scenario: Equivalência não informada
- **WHEN** o usuário configura o relógio sem duração terrestre
- **THEN** o sistema aceita horários locais e informa que não há equivalência terrestre definida

#### Scenario: Horário fora dos limites
- **WHEN** um horário contém hora igual ao número de horas do dia ou minuto fora de sua faixa
- **THEN** o sistema rejeita o horário e apresenta os limites válidos

### Requirement: Marcos e contagem dos anos
O sistema SHALL permitir várias contagens dos anos por calendário, cada uma com um marco datado, nomes e abreviações antes e depois, e primeiro ano posterior igual a zero ou um. A mudança de ano SHALL seguir os limites anuais do calendário; o lado anterior SHALL contar regressivamente a partir de um.

#### Scenario: Contagem pós-revolução
- **WHEN** o usuário define Revolução como referência, primeiro ano posterior um e abreviações AR e PR
- **THEN** o sistema pode exibir datas como ano 4 PR e ano 2 AR sem alterar sua posição cronológica

#### Scenario: Referência no meio do ano
- **WHEN** um marco começa no meio do ano
- **THEN** o trecho imediatamente anterior é ano 1 do lado anterior, o trecho posterior é o primeiro ano configurado e as contagens mudam nos limites anuais do calendário

#### Scenario: Duas contagens da mesma data
- **WHEN** uma data é exibida pela Fundação ou pela Revolução
- **THEN** a posição temporal é a mesma e somente o ano e os rótulos apresentados mudam

### Requirement: Data estruturada e precisão
O sistema SHALL validar datas segundo o calendário e preservar precisão de ano, mês ou dia, com horário opcional apenas para datas com dia definido. MUST distinguir ausência de horário de meia-noite e MUST preservar a mesma data ao trocar seu formato ou sua contagem dos anos.

#### Scenario: Dia inexistente
- **WHEN** o usuário informa dia 37 em um mês de 36 dias
- **THEN** a data não é aceita e o sistema informa os dias válidos desse mês

#### Scenario: Data somente anual
- **WHEN** uma data é conhecida apenas como ano 4 PR
- **THEN** o sistema mantém precisão anual e não apresenta mês, dia ou horário inventados

#### Scenario: Data sem horário
- **WHEN** o usuário seleciona um dia e deixa o horário vazio
- **THEN** o valor continua sendo uma data sem horário e não um instante à meia-noite

### Requirement: Formatos de data configuráveis
O sistema SHALL permitir definir formatos curto e narrativo com texto literal e componentes de dia, ordinal, mês numérico, nome e ordinal do mês, ano, lado e abreviação da contagem e horário. A prévia MUST respeitar a precisão da data e MUST rejeitar componentes desconhecidos.

#### Scenario: Formato narrativo
- **WHEN** o usuário combina dia ordinal, nome do mês, ano e nome do lado posterior
- **THEN** a prévia pode mostrar 37º dia do Sexto mês, ano 4 pós-revolução

#### Scenario: Formato curto
- **WHEN** o formato usa dia e mês com preenchimento de zeros, ano com largura mínima de quatro dígitos e abreviação
- **THEN** a mesma data pode aparecer como 37/06/0004 PR sem truncar números maiores que a largura definida

#### Scenario: Precisão inferior ao formato
- **WHEN** uma data anual é exibida por um formato que também contém dia e mês
- **THEN** o sistema usa a apresentação correspondente à precisão anual e não deixa separadores ou placeholders incompletos

### Requirement: Estações recorrentes
O sistema SHALL permitir configurar estações com nome, cor e início e fim no ciclo anual. Estações MUST poder atravessar a virada do ano e sobrepor-se, sem exigir cobertura de todos os dias do ano.

#### Scenario: Estação na virada do ano
- **WHEN** uma estação começa no último mês e termina no segundo mês
- **THEN** dias nos dois trechos anuais são identificados como pertencentes à estação

#### Scenario: Estações sobrepostas
- **WHEN** duas estações incluem a mesma data
- **THEN** o sistema apresenta as duas sem alterar a data nem a duração do ano

### Requirement: Edição segura de calendários utilizados
Alterações estruturais em um calendário utilizado SHALL criar uma revisão explícita, mantendo datas e vínculos na revisão anterior até migração confirmada. Renomear rótulos ou ajustar formatos SHALL atualizar a apresentação sem mover datas. O sistema MUST impedir excluir calendários ou revisões referenciados.

#### Scenario: Reduzir um mês utilizado
- **WHEN** o usuário reduz para 30 dias um mês que possui uma data registrada no dia 37
- **THEN** o sistema preserva a revisão anterior e exige resolver a data inválida antes de migrar esse vínculo

#### Scenario: Renomear um mês
- **WHEN** o usuário altera somente o nome de um mês
- **THEN** a data permanece no mesmo dia e sua exibição passa a usar o novo nome

#### Scenario: Excluir calendário utilizado
- **WHEN** o calendário possui timelines ou valores dinâmicos vinculados
- **THEN** a exclusão é bloqueada e o sistema indica os usos que precisam ser resolvidos

### Requirement: Configuração com prévia e acessibilidade
As telas SHALL seguir os padrões visuais do Lorekit e organizar estrutura, semana, tempo, contagem dos anos, estações e formatos em seções claras. SHALL oferecer prévia das regras e datas, erros junto ao campo e operação por teclado, incluindo alternativas ao arraste para reordenar meses e dias.

#### Scenario: Ajustar uma regra
- **WHEN** o usuário modifica a duração de um mês ou a semana
- **THEN** a prévia e o resumo do ano refletem o rascunho sem persistir alterações inválidas

#### Scenario: Configuração por teclado
- **WHEN** o usuário navega sem mouse
- **THEN** consegue selecionar seções, reordenar meses, preencher datas e salvar com foco visível e rótulos acessíveis

### Requirement: Operação local e sincronização compatível
Os calendários e seus cálculos SHALL funcionar offline. Quando a sincronização opcional estiver habilitada, o sistema MUST transportar regras, revisões e vínculos sem reinterpretar datas e MUST informar dependências indisponíveis em vez de substituí-las por outro calendário.

#### Scenario: Uso offline
- **WHEN** o usuário configura um calendário e cria uma data sem conexão
- **THEN** regras e datas são persistidas localmente e permanecem disponíveis ao reabrir o aplicativo

#### Scenario: Referência indisponível
- **WHEN** uma data recebida referencia revisão ainda indisponível
- **THEN** o sistema preserva o valor e informa a dependência ausente sem apresentar uma data calculada por regras diferentes

### Requirement: Ordem e textos condicionais de formatos
O montador SHALL permitir reordenar todas as partes de cada variante de formato por controles acessíveis. SHALL permitir textos condicionais com comparações declarativas de componentes numéricos, combinação por todas/qualquer condição e resultados para verdadeiro, falso e informação desconhecida. MUST preservar a precisão da data, rejeitar comparações inválidas e não executar código fornecido pelo usuário.

#### Scenario: Reordenar partes
- **WHEN** o usuário move o ano antes do dia e do mês
- **THEN** a prévia e o formato salvo seguem a ordem escolhida sem alterar a data

#### Scenario: Limite do dia configurável
- **WHEN** a regra usa dia menor que 13 com textos Dia de luz e Dia da noite
- **THEN** o dia 12 mostra Dia de luz e o dia 13 mostra Dia da noite; o operador permite incluir o dia 13 no primeiro caso

#### Scenario: Precisão insuficiente
- **WHEN** uma regra depende do dia ou horário e essa informação não consta da data
- **THEN** o componente é desconhecido, sem presumir dia 1 ou meia-noite, e a avaliação usa o texto configurado para informação desconhecida quando o resultado não puder ser determinado

#### Scenario: Regras combinadas e segurança
- **WHEN** o autor combina limites de dia e horário ou fornece uma comparação desconhecida
- **THEN** os limites válidos são avaliados por E/OU e comparações desconhecidas são rejeitadas sem executar conteúdo
