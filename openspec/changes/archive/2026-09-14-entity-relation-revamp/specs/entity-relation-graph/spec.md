## Purpose

Oferecer uma visão automática e navegável da teia de relações das entidades, respeitando o contexto de mundo sem perder o foco explícito escolhido pelo usuário.

## ADDED Requirements

### Requirement: Visão geral respeita o escopo de mundo
Sem uma entidade raiz explícita, a tela SHALL usar o mundo atualmente selecionado como escopo da visão quando existir. Todas as entidades pertencentes a esse mundo, inclusive descendentes hierárquicos e entidades sem relações, SHALL poder ser exibidas. Sem mundo selecionado, a tela SHALL usar uma visão global.

#### Scenario: Mundo selecionado abre a visão geral
- **WHEN** a tela é aberta sem entidade raiz e existe um mundo atualmente selecionado
- **THEN** o grafo exibe as entidades pertencentes a esse mundo e não exibe entidades de outros mundos

#### Scenario: Nenhum mundo selecionado
- **WHEN** a tela é aberta sem entidade raiz e não existe mundo atualmente selecionado
- **THEN** o grafo exibe a visão global das entidades disponíveis

#### Scenario: Entidade sem relações
- **WHEN** uma entidade pertence ao escopo ativo e não possui nenhum link
- **THEN** ela aparece na visão como um nó isolado, sem exigir uma relação para ser incluída

### Requirement: Entidade raiz explícita prevalece sobre o mundo global
Quando a tela receber ou selecionar uma entidade raiz explícita, essa raiz SHALL permanecer visível e centralizada mesmo que o mundo global atualmente selecionado seja diferente. Quando a raiz pertencer a um mundo, esse mundo SHALL definir o escopo da visão enraizada; quando não for possível determinar um mundo para a raiz, a tela SHALL manter a raiz e usar uma visão global enraizada.

#### Scenario: Raiz pertence a outro mundo
- **WHEN** existe um mundo global selecionado e a tela é aberta com uma raiz pertencente a outro mundo
- **THEN** a raiz continua sendo exibida no centro e o escopo da visão passa a ser o mundo da raiz

#### Scenario: Troca do mundo global com uma raiz ativa
- **WHEN** o usuário troca o mundo global enquanto uma visão enraizada está aberta
- **THEN** a raiz e o escopo da visão enraizada permanecem inalterados

### Requirement: Filtros não reduzem a visão completa
O filtro de tipo SHALL restringir apenas as opções disponíveis para escolha da entidade principal. A entidade principal SHALL ser opcional e sua escolha SHALL definir o nó central sem remover os demais tipos ou entidades do grafo.

#### Scenario: Filtro de tipo
- **WHEN** o usuário seleciona um tipo de entidade
- **THEN** o seletor de entidade principal mostra apenas entidades daquele tipo dentro do escopo ativo, enquanto o grafo mantém todos os tipos do escopo

#### Scenario: Remover entidade principal
- **WHEN** o usuário limpa a entidade principal
- **THEN** a tela retorna à visão completa do escopo ativo e deixa de destacar um nó central como raiz

### Requirement: Nós circulares e layout automático
Cada entidade visível SHALL ser representada por um nó circular, com indicação visual do tipo e suporte à imagem ou a um fallback textual. A tela SHALL gerar automaticamente uma disposição próxima de uma composição circular, acomodando nós conectados, ciclos, relações cruzadas e nós isolados sem depender de posições manuais persistidas.

#### Scenario: Geração inicial do grafo
- **WHEN** a visão é carregada ou seu escopo é atualizado
- **THEN** todos os nós são posicionados automaticamente e a entidade principal, quando existir, fica no centro

#### Scenario: Relações em teia
- **WHEN** existem ciclos ou links entre entidades que não estão na mesma camada radial
- **THEN** o layout mantém essas entidades visíveis e distribui os nós para representar a teia sem exigir reposicionamento manual

#### Scenario: Configuração antiga de posição
- **WHEN** uma entidade ou link possui posições ou tamanhos salvos pela versão anterior
- **THEN** a tela ignora essas configurações para o novo layout e não altera os dados antigos apenas por carregá-los

### Requirement: Arestas comunicam direção e multiplicidade
Cada link visível SHALL indicar sua direção por uma seta. Relações inversas, múltiplas relações entre o mesmo par e autorrelações SHALL possuir geometria distinguível. O nome da relação SHALL estar disponível sem tornar a visão inteira ilegível.

#### Scenario: Relação direcional
- **WHEN** existe um link de uma entidade para outra
- **THEN** a aresta aponta visualmente da origem para o destino

#### Scenario: Relações inversas ou paralelas
- **WHEN** há links nos dois sentidos ou mais de um link entre o mesmo par
- **THEN** as arestas são separadas visualmente e continuam selecionáveis individualmente

#### Scenario: Autorrelação
- **WHEN** a origem e o destino do link são a mesma entidade
- **THEN** a relação é exibida como um loop associado ao nó

### Requirement: Escopo de links evita relações entre mundos
Em uma visão com escopo de mundo, a tela SHALL exibir somente links cujas duas entidades pertençam ao escopo. Links entre mundos ou com uma ponta fora do escopo SHALL permanecer armazenados, mas não SHALL aparecer nessa visão.

#### Scenario: Link cruza o limite do mundo
- **WHEN** um link conecta uma entidade do escopo a uma entidade de outro mundo
- **THEN** o link não é exibido no grafo e continua disponível no banco de dados

### Requirement: Seleção abre edição contextual
Ao selecionar um nó, a tela SHALL mostrar um painel contextual com a entidade, suas relações de saída e de chegada e ações de edição. O usuário SHALL poder criar, editar, inverter e excluir links pelo painel, sem precisar mover ou redimensionar nós.

#### Scenario: Selecionar entidade
- **WHEN** o usuário seleciona um nó
- **THEN** o painel mostra as relações de saída e chegada da entidade e destaca visualmente suas arestas relacionadas

#### Scenario: Editar relação
- **WHEN** o usuário seleciona uma relação no painel ou no grafo
- **THEN** o formulário mostra origem, destino e nome atuais e permite salvar, inverter ou excluir a relação

#### Scenario: Criar relação
- **WHEN** o usuário inicia uma nova relação a partir de uma entidade selecionada
- **THEN** o formulário oferece entidades de destino compatíveis com o escopo ativo e atualiza o grafo após o salvamento

### Requirement: Atualização reage ao contexto e às alterações
A tela SHALL atualizar a visão automaticamente quando o mundo global relevante mudar, quando a entidade principal mudar ou quando uma relação for criada, editada, invertida ou excluída. A tela SHALL apresentar um estado vazio contextual quando não houver entidades no escopo.

#### Scenario: Mudança do mundo na visão geral
- **WHEN** o mundo global é alterado sem uma raiz explícita ativa
- **THEN** o conjunto de nós e links é recalculado para o novo escopo sem exigir recarregamento manual da página

#### Scenario: Escopo sem entidades
- **WHEN** não existem entidades no escopo ativo
- **THEN** a tela mostra uma mensagem explicando o escopo vazio em vez de um canvas em branco
