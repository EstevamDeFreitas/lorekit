## Purpose

Permite alternar entre abas do workspace preservando o estado de cada tela durante a sessão, com interações globais direcionadas ao contexto ativo e salvamentos pendentes coordenados.

## ADDED Requirements

### Requirement: Estado preservado enquanto a aba permanecer aberta

O sistema SHALL preservar o estado interativo de cada aba aberta durante a sessão do workspace. Alternar para outra aba e retornar SHALL restaurar a tela no estado anterior sem repetir seu carregamento inicial. Mover uma aba entre painéis SHALL preservar o mesmo estado. Fechar uma aba SHALL liberar esse estado; ao reabri-la, o sistema SHALL apresentar o conteúdo salvo mais recente.

#### Scenario: Retornar a um moodboard aberto

- **WHEN** a pessoa ajusta zoom, posição do canvas, seleção ou ferramenta no moodboard, alterna para outra aba e retorna
- **THEN** o moodboard reaparece com o mesmo estado interativo, sem recarregar seus dados

#### Scenario: Mover uma aba entre painéis

- **WHEN** a pessoa move uma aba aberta para outro painel ou fecha um painel que contém essa aba
- **THEN** a aba mantém seu estado interativo durante a reorganização

#### Scenario: Fechar e reabrir uma aba

- **WHEN** a pessoa fecha uma aba após seus salvamentos pendentes terem sido aplicados e depois a abre novamente
- **THEN** a tela é carregada a partir do conteúdo salvo e o estado transitório anterior deixa de ser retido

### Requirement: Ações globais direcionadas ao contexto ativo

O sistema SHALL encaminhar atalhos de teclado e ações globais de área de transferência somente à aba ativa do painel focado. Abas retidas que não estão ativas e abas em painéis não focados MUST NOT executar essas ações.

#### Scenario: Atalho com vários moodboards abertos

- **WHEN** mais de um moodboard aberto contém itens selecionados e a pessoa pressiona Delete ou Backspace
- **THEN** somente o moodboard ativo no painel focado remove os itens selecionados

#### Scenario: Colar com abas retidas

- **WHEN** a pessoa cola conteúdo enquanto uma aba está ativa no painel focado
- **THEN** somente essa aba processa o conteúdo colado

### Requirement: Salvamento coordenado ao desativar ou fechar uma aba

Antes de desanexar ou destruir uma tela, o sistema SHALL concluir a serialização e aplicação ao banco compartilhado de todos os salvamentos pendentes originados por essa aba, incluindo salvamentos assíncronos de editores ricos. Falhas MUST ser apresentadas sem descartar silenciosamente o estado pendente. Salvamentos de outras abas MUST continuar íntegros e não ser cancelados pela transição.

#### Scenario: Alternar após uma edição pendente

- **WHEN** a pessoa edita um campo ou item e alterna de aba antes do autosave terminar
- **THEN** a alteração é aplicada antes da tela ser desanexada e aparece corretamente ao retornar ou reabrir a entidade

#### Scenario: Alternar em um workspace com painéis simultâneos

- **WHEN** abas em dois painéis possuem alterações pendentes e a pessoa alterna a aba de apenas um painel
- **THEN** o salvamento dessa aba é concluído sem descartar nem sobrescrever a alteração pendente da outra aba

#### Scenario: Falha ao descarregar um salvamento

- **WHEN** um editor não consegue serializar uma alteração pendente durante a transição
- **THEN** o sistema informa a falha e mantém o conteúdo recuperável, sem concluir silenciosamente a transição como se a alteração estivesse salva

### Requirement: Atualização invalida telas retidas obsoletas

Após uma recarga interna ou reconciliação de conteúdo remoto, o sistema SHALL remover as telas retidas que possam refletir uma versão antiga do banco e recriá-las a partir do estado vigente. Salvamentos locais pendentes SHALL seguir a política de flush ou descarte já aplicada pela operação que iniciou a atualização.

#### Scenario: Recarga interna dos componentes

- **WHEN** a pessoa solicita a recarga interna do workspace
- **THEN** os salvamentos pendentes são concluídos antes de as telas retidas serem reconstruídas a partir do banco

#### Scenario: Conteúdo externo reconciliado

- **WHEN** uma sincronização aplica conteúdo externo ao banco e invalida as telas do workspace
- **THEN** as abas abertas mostram o conteúdo reconciliado e nenhuma tela retida reaplica valores obsoletos
