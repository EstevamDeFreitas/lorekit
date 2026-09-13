## Purpose

Permitir recuperar alterações textuais de uma entidade durante a sessão do Lorekit, com uma sequência compartilhada entre seus campos e acesso equivalente por atalhos e botões.

## ADDED Requirements

### Requirement: Sequência de edição por entidade

O sistema SHALL manter uma sequência cronológica independente de alterações para cada entidade do workspace, incluindo nome ou título, campos textuais simples, textos ricos e campos textuais personalizados. Desfazer SHALL reverter a última etapa dessa entidade, independentemente do campo da entidade em foco; refazer SHALL reaplicar a última etapa desfeita. Alterações de entidades diferentes MUST NOT compartilhar a mesma sequência.

#### Scenario: Desfazer entre campos

- **WHEN** a pessoa altera o nome e depois a descrição de uma entidade e aciona desfazer duas vezes, mantendo o foco na descrição
- **THEN** o primeiro comando restaura a descrição anterior e o segundo restaura o nome anterior
- **AND** refazer duas vezes reaplica primeiro o nome e depois a descrição

#### Scenario: Entidades independentes

- **WHEN** a pessoa edita A, edita B e volta para A para desfazer
- **THEN** somente a última etapa de A é desfeita e o histórico de B permanece disponível

#### Scenario: Campos personalizados pertencem à entidade

- **WHEN** a pessoa edita um texto personalizado e depois um campo nativo da mesma entidade
- **THEN** ambos integram a mesma sequência, preservando a identidade de cada campo

### Requirement: Histórico durante a sessão

O sistema SHALL preservar o histórico ao alternar abas ou seções de campos, fechar e reabrir a aba de uma entidade e usar o F5 interno de recarga de componentes. O histórico SHALL ser descartado ao encerrar a sessão do workspace ou reiniciar a aplicação; no navegador, uma recarga completa inicia uma nova sessão de histórico. Carregar dados já salvos MUST NOT criar etapas de edição.

#### Scenario: Reabrir entidade e recarregar componentes

- **WHEN** uma entidade editada é fechada e reaberta na mesma sessão, e seus componentes são recarregados pelo F5 interno
- **THEN** desfazer e refazer continuam disponíveis para as etapas anteriores

#### Scenario: Nova sessão

- **WHEN** a pessoa encerra e reabre o aplicativo ou recarrega completamente a página web
- **THEN** o conteúdo salvo é carregado sem histórico da sessão anterior

### Requirement: Etapas significativas e ramificação

O sistema SHALL agrupar digitação contínua no mesmo campo em etapas. Uma pausa de digitação, troca de campo ou entidade, colagem, ação de formatação ou comando de histórico SHALL delimitar etapas. Uma composição de texto SHALL ser tratada como uma edição concluída, sem desfazer parcialmente uma composição em andamento. Uma nova edição após desfazer SHALL descartar somente o caminho de refazer da entidade editada. Alterações sem diferença de conteúdo MUST NOT criar etapas.

#### Scenario: Digitação e colagem

- **WHEN** a pessoa digita continuamente um trecho e depois cola outro trecho no mesmo campo
- **THEN** um desfazer remove a colagem e o seguinte reverte a etapa de digitação anterior

#### Scenario: Novo caminho após desfazer

- **WHEN** a pessoa desfaz uma etapa em A e realiza uma nova edição em A
- **THEN** o refazer anterior de A deixa de estar disponível, sem afetar o histórico de outras entidades

### Requirement: Atalhos com contexto da entidade

O sistema SHALL oferecer Ctrl+Z para desfazer e Ctrl+Y para refazer a sequência da entidade ativa, inclusive dentro dos campos textuais dessa entidade. Cada acionamento SHALL produzir no máximo uma operação de histórico. Ao editar a pesquisa, filtros ou formulários externos ao contexto da entidade, os atalhos MUST NOT alterar a entidade ao fundo. A entidade ativa SHALL acompanhar o painel e o contexto de edição que a pessoa acessou por mouse ou teclado.

#### Scenario: Atalho no editor rico

- **WHEN** a pessoa pressiona Ctrl+Z em um texto rico de uma entidade com etapas disponíveis
- **THEN** exatamente a última etapa da entidade é desfeita, sem um segundo desfazer local do editor

#### Scenario: Busca e configurações

- **WHEN** a pessoa usa Ctrl+Z ou Ctrl+Y enquanto edita a pesquisa ou um formulário de configuração
- **THEN** o histórico da entidade permanece intacto e o campo conserva seu tratamento local de edição

#### Scenario: Painéis distintos

- **WHEN** A e B estão em painéis distintos e a pessoa move o foco para B por teclado antes de desfazer
- **THEN** o comando afeta B

### Requirement: Botões globais de desfazer e refazer

O sistema SHALL apresentar, nesta ordem, os botões Desfazer e Refazer imediatamente à esquerda da pesquisa global. Eles SHALL usar a mesma sequência dos atalhos e a entidade do painel/contexto ativo. Cada botão SHALL ter nome acessível e dica com ação, campo e atalho quando houver uma etapa disponível. O botão SHALL estar desabilitado sem entidade elegível, sem etapa correspondente ou durante uma restauração. Acionar um botão MUST NOT trocar a entidade alvo por perda de foco do campo.

#### Scenario: Equivalência entre controles

- **WHEN** a pessoa usa Ctrl+Z e em seguida clica em Refazer
- **THEN** o botão reaplica exatamente a etapa desfeita pelo atalho

#### Scenario: Indisponibilidade e acessibilidade

- **WHEN** não existe entidade ativa ou não há etapa para desfazer
- **THEN** Desfazer aparece desabilitado, com identificação acessível
- **AND** os controles permanecem utilizáveis por teclado e visíveis no layout estreito

### Requirement: Compatibilidade dos textos ricos

O sistema SHALL permitir desfazer/refazer com Editor.js e Tiptap, preservando texto, formatação, estrutura, menções, referências de imagens e dados canônicos de blocos preserváveis. Reabrir um campo com outro editor na mesma sessão SHALL preservar as etapas compatíveis com o documento canônico. Restaurar texto rico MUST NOT excluir arquivos de imagem ou alterar outras entidades.

#### Scenario: Restaurar formatação e estrutura

- **WHEN** a pessoa formata texto ou altera a estrutura de um bloco e desfaz a ação
- **THEN** o conteúdo e a formatação anteriores são restaurados sem perda de menções ou dados de outros blocos

#### Scenario: Trocar editor na sessão

- **WHEN** a pessoa edita um campo, muda a preferência de editor e reabre esse campo na mesma sessão
- **THEN** as etapas canônicas continuam disponíveis para desfazer e refazer

### Requirement: Restauração coordenada com salvamento

O sistema SHALL aplicar desfazer/refazer ao conteúdo em edição e ao fluxo de persistência, mesmo quando a alteração mais recente ainda aguarda salvamento automático. Uma gravação anterior pendente MUST NOT sobrescrever o conteúdo restaurado. A restauração MUST NOT criar uma nova etapa de edição. O sistema SHALL restaurar o campo alvo mesmo quando ele não estiver visível na seção atual da entidade, sem substituir outros campos por versões antigas.

#### Scenario: Desfazer antes do autosave

- **WHEN** a pessoa edita texto e desfaz imediatamente antes de o salvamento automático terminar
- **THEN** o texto anterior é exibido e salvo, e permanece correto ao reabrir a entidade
- **AND** a etapa desfeita continua disponível para refazer

#### Scenario: Campo oculto

- **WHEN** a última etapa pertence a um campo em outra seção da entidade e a pessoa aciona desfazer
- **THEN** esse campo é restaurado e aparece com o valor restaurado ao ser aberto
- **AND** os demais campos permanecem com seus valores atuais

#### Scenario: Falha de restauração

- **WHEN** uma operação de restauração falha
- **THEN** o sistema informa a falha e não apresenta a etapa como concluída com sucesso
- **AND** mantém estado e posição do histórico coerentes para recuperação, sem executar refazer indevidamente

### Requirement: Proteção contra histórico obsoleto

O sistema MUST NOT usar um histórico antigo para sobrescrever silenciosamente conteúdo incompatível recebido por sincronização, importação ou restauração de dados. Quando a continuidade do histórico não puder ser preservada, o sistema SHALL invalidar o histórico da entidade afetada e informar essa condição. Exclusão de entidade SHALL remover seu histórico. Troca de workspace SHALL impedir reutilização de histórico do workspace anterior.

#### Scenario: Alteração externa incompatível

- **WHEN** uma entidade com histórico recebe conteúdo externo que diverge da base esperada
- **THEN** o histórico incompatível é invalidado e o motivo fica visível à pessoa
- **AND** a atualização externa não é registrada como uma edição local desfazível

#### Scenario: Exclusão e troca de workspace

- **WHEN** a entidade é excluída ou a sessão muda de workspace
- **THEN** suas etapas anteriores não podem ser executadas no novo contexto
