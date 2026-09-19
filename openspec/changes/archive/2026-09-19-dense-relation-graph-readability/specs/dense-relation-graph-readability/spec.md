## Purpose

Permitir explorar redes densas de relações com rótulos legíveis, ligações distinguíveis e acesso completo aos dados, preservando o contexto de mundo e entidade principal.

## ADDED Requirements

### Requirement: Preservação do escopo e contexto
O sistema SHALL preservar a precedência da raiz explícita sobre o mundo global, carregar sua teia conectada completa por padrão e manter o mundo centralizado na visão geral. O primeiro nível de uma raiz SHALL manter organização circular e as relações persistidas SHALL permanecer intactas.

#### Scenario: Abrir entidade em outro mundo
- **WHEN** uma raiz de outro mundo é aberta
- **THEN** seu escopo prevalece e sua teia conectada completa permanece disponível, sem incluir componentes desconectados

#### Scenario: Visão geral
- **WHEN** há mundo selecionado sem raiz explícita
- **THEN** o mundo fica centralizado e todas as entidades do escopo, inclusive isoladas, ficam disponíveis

### Requirement: Relações distinguíveis
O sistema SHALL distinguir geometricamente relações inversas e paralelas quando expandidas, manter direção e identidade de cada link e oferecer acesso individual quando houver resumo visual.

#### Scenario: Dois links inversos
- **WHEN** A aponta para B e B aponta para A
- **THEN** as curvas expandidas não percorrem o mesmo trajeto em sentidos opostos e cada seta identifica seu destino

#### Scenario: Paralelas e autorrelações
- **WHEN** um par possui múltiplos links ou um nó possui múltiplas autorrelações
- **THEN** é possível selecionar cada id por rota distinguível ou pela lista do resumo, sem editar outro link

### Requirement: Rótulos legíveis
O sistema SHALL evitar sobreposição dos rótulos automáticos efetivamente exibidos com outros rótulos ou nós em coordenadas da tela, inclusive após zoom e resize. Nomes sem espaço SHALL continuar acessíveis no painel ou foco individual.

#### Scenario: Selecionar hub
- **WHEN** uma entidade com 80 relações é selecionada
- **THEN** os rótulos não são revelados simultaneamente sobrepostos e todas as 80 relações podem ser consultadas individualmente

#### Scenario: Relação ativa sem espaço
- **WHEN** nenhum local livre comporta o nome da relação ativa
- **THEN** o texto completo aparece no painel sem ser desenhado sobre outro texto ou entidade

### Requirement: Rotas e nomes considerados na organização
O sistema SHALL considerar o espaço dos nomes ao posicionar entidades e tentar desviar relações de nós não incidentes. Rotas sem corredor legível SHALL oferecer indicação de congestionamento e acesso por foco ou lista.

#### Scenario: Nó entre duas entidades relacionadas
- **WHEN** a rota direta atravessa um terceiro nó
- **THEN** o sistema usa um desvio livre quando viável ou sinaliza a limitação e permite consultar a relação em detalhe

### Requirement: Resumo reversível por par
O sistema SHALL oferecer resumo de múltiplas relações do mesmo par com quantidade e direção, mantendo contagens exatas e possibilidade de expansão.

#### Scenario: Abrir resumo
- **WHEN** o usuário abre uma conexão resumida
- **THEN** encontra todos os links originais com origem, destino e nome, e seleciona o link exato para editar

### Requirement: Foco opcional e retorno
O sistema SHALL oferecer foco em 1 ou 2 níveis de uma entidade e retorno à teia completa, com contagens do que está visível. Selecionar um nó para inspeção SHALL NOT mudar automaticamente o escopo de dados.

#### Scenario: Explorar vizinhança
- **WHEN** o usuário solicita foco de 1 nível
- **THEN** vê a entidade e seus vizinhos diretos com relações entre os nós visíveis, e pode retornar ao contexto anterior

#### Scenario: Consultar relações fora do foco
- **WHEN** o foco oculta parte da teia
- **THEN** a lista ou busca permite localizar todos os links do escopo e revelar a relação escolhida

### Requirement: Navegação fluida e acessível
O sistema SHALL manter pan visual 1:1 e zoom livre, oferecer ajuste à área disponível incluindo rótulos e permitir ações equivalentes por teclado e toque. Animações SHALL respeitar movimento reduzido.

#### Scenario: Alterar zoom e ajustar
- **WHEN** o usuário aproxima, afasta e solicita ajuste à tela
- **THEN** o grafo cabe na área disponível, continua navegável e os rótulos são reavaliados sem recalcular o layout a cada arrasto

### Requirement: Resultados estáveis e verificáveis
O sistema SHALL manter a interface utilizável durante layouts grandes, descartar resultados obsoletos e preservar acesso completo aos links mesmo quando não for possível eliminar cruzamentos.

#### Scenario: Trocar mundo durante cálculo
- **WHEN** um cálculo do mundo anterior termina após a troca
- **THEN** ele não substitui a visualização do mundo atual

#### Scenario: Rede densa não planar
- **WHEN** todos os cruzamentos não podem ser eliminados
- **THEN** relações continuam individualmente consultáveis, sem rótulos exibidos sobrepostos nem perda silenciosa de links
