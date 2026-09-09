## Purpose

Permitir que usuários organizem os campos de todas as entidades suportadas em layouts consistentes, portáveis e visualmente estruturados por abas, separadores e destaques de cor.

## ADDED Requirements

### Requirement: Templates com múltiplas abas nomeadas
O sistema SHALL permitir que cada template de layout contenha uma ou mais abas com identificador estável, nome não vazio e ordem configurável. Os nomes das abas SHALL ser únicos dentro do mesmo template.

#### Scenario: Criar e ordenar abas
- **WHEN** o usuário adiciona duas abas ao template, define nomes distintos e altera sua ordem
- **THEN** o sistema salva as abas e volta a apresentá-las com os mesmos nomes e na ordem configurada

#### Scenario: Impedir nomes inválidos
- **WHEN** o usuário tenta salvar uma aba sem nome ou com o mesmo nome de outra aba do template
- **THEN** o sistema rejeita o salvamento e informa que cada aba precisa de um nome único e não vazio

#### Scenario: Excluir uma aba
- **WHEN** o usuário confirma a exclusão de uma aba
- **THEN** o sistema remove a aba e disponibiliza novamente no catálogo os campos que estavam nela

### Requirement: Campos distribuídos entre abas
O sistema SHALL permitir posicionar e redimensionar campos em qualquer aba do template e SHALL impedir que o mesmo campo seja colocado em mais de uma aba do mesmo template.

#### Scenario: Mover campo para outra aba
- **WHEN** o usuário remove um campo de uma aba e o posiciona em outra
- **THEN** o campo passa a ser exibido somente na nova aba, preservando o valor armazenado na entidade

#### Scenario: Campo já utilizado
- **WHEN** um campo está presente em qualquer aba do template
- **THEN** o catálogo o identifica como utilizado e impede uma segunda inclusão no mesmo template

### Requirement: Abas configuradas integradas à navegação da entidade
O sistema SHALL exibir as abas do layout resolvido no mesmo nível das abas fixas da tela da entidade, substituindo a aba fixa "Propriedades". A seleção de uma aba configurada SHALL mostrar apenas os itens daquela aba.

#### Scenario: Entidade com layout de múltiplas abas
- **WHEN** uma entidade é aberta com um layout que contém as abas "Identidade" e "Combate"
- **THEN** a navegação apresenta "Identidade" e "Combate" junto às abas fixas aplicáveis à entidade e não apresenta uma aba adicional chamada "Propriedades"

#### Scenario: Aba anteriormente selecionada não existe mais
- **WHEN** a tela restaura uma seleção de aba configurada que foi removida do layout
- **THEN** o sistema seleciona a primeira aba configurada disponível sem impedir a abertura da entidade

### Requirement: Separadores configuráveis
O sistema SHALL permitir adicionar ao grid separadores visuais horizontais e verticais, posicioná-los, redimensioná-los e configurar um label opcional e uma cor opcional.

#### Scenario: Separador horizontal com label
- **WHEN** o usuário adiciona um separador horizontal, informa um label e escolhe uma cor
- **THEN** a entidade exibe uma linha horizontal nessa cor com o label centralizado

#### Scenario: Separador vertical com label
- **WHEN** o usuário adiciona um separador vertical com label
- **THEN** a entidade exibe uma linha vertical com o label centralizado e rotacionado em 90 graus

#### Scenario: Separador sem label
- **WHEN** o usuário deixa o label vazio
- **THEN** o sistema exibe somente a linha na orientação configurada

### Requirement: Destaque de cor dos campos
O sistema SHALL permitir definir ou limpar uma cor hexadecimal opcional para cada campo do layout. A cor SHALL destacar o label e a borda do campo sem preencher o fundo do controle nem alterar o valor armazenado.

#### Scenario: Aplicar cor da paleta
- **WHEN** o usuário seleciona para um campo uma cor disponível na mesma paleta do editor de texto
- **THEN** o campo é exibido com label e borda destacados pela cor escolhida

#### Scenario: Aplicar cor personalizada
- **WHEN** o usuário escolhe uma cor hexadecimal personalizada válida
- **THEN** o sistema salva e aplica exatamente essa cor ao destaque do item

#### Scenario: Limpar destaque
- **WHEN** o usuário limpa a cor configurada
- **THEN** o campo volta a usar os estilos padrão da tela

### Requirement: Renderização uniforme em todas as entidades suportadas
O sistema SHALL oferecer os mesmos comportamentos de layout, abas, separadores, cores e campos dinâmicos para Character, Culture, Location, Object, Organization, Species e World. O tipo de controle dos campos nativos SHALL ser determinado por metadados do catálogo, incluindo input, textarea e editor rico.

#### Scenario: Renderizar campo nativo pelo catálogo
- **WHEN** o layout contém um campo nativo cujo catálogo declara o controle textarea
- **THEN** o sistema renderiza um textarea ligado à propriedade correspondente e persiste alterações pelo fluxo de salvamento da entidade

#### Scenario: Renderizar campo dinâmico em entidades distintas
- **WHEN** layouts de duas entidades suportadas contêm campos dinâmicos do mesmo tipo
- **THEN** o sistema oferece em ambas o mesmo controle e o mesmo comportamento de persistência

#### Scenario: Salvar editor rico nativo
- **WHEN** o usuário altera um campo nativo configurado como editor rico
- **THEN** o conteúdo é serializado e salvo na propriedade correspondente da entidade sem depender de tratamento específico daquela tela

### Requirement: Resolução por escopo preserva o layout completo
O sistema SHALL resolver o template ou layout aplicável seguindo a precedência existente de entidade, entidade pai, global e padrão do sistema, preservando todas as abas e configurações dos itens da origem selecionada.

#### Scenario: Layout exclusivo da entidade
- **WHEN** existe um layout exclusivo para a entidade e também um layout global
- **THEN** o sistema exibe todas as abas e itens do layout exclusivo da entidade

#### Scenario: Layout herdado da entidade pai
- **WHEN** não existe layout exclusivo e existe um layout aplicável pela entidade pai
- **THEN** o sistema exibe todas as abas e itens do layout herdado da entidade pai

### Requirement: Compatibilidade com layouts anteriores
O sistema SHALL aceitar layouts internos da versão anterior que contenham um único array de itens e normalizá-los em memória como um layout de aba única sem perda de posicionamento ou campos.

#### Scenario: Layout anterior ligado a template
- **WHEN** um layout anterior ligado a um template é carregado
- **THEN** o sistema cria em memória uma aba única usando o nome do template e preserva todos os itens do grid

#### Scenario: Layout anterior sem template
- **WHEN** um layout anterior sem nome de template é carregado
- **THEN** o sistema cria em memória uma aba única chamada "Propriedades" e preserva todos os itens do grid

#### Scenario: Persistir layout normalizado
- **WHEN** o usuário salva um layout anterior carregado e normalizado
- **THEN** o sistema o persiste no formato atual com sua aba única e sem perder campos, posições ou dimensões

### Requirement: Portabilidade de layouts expandidos
O sistema SHALL exportar todas as abas, itens, separadores, cores e definições de campos dinâmicos do layout no formato portátil atual. O sistema SHALL continuar aceitando documentos portáteis da versão anterior e SHALL validar integralmente um documento antes de alterar dados locais.

#### Scenario: Exportar layout com múltiplas abas
- **WHEN** o usuário exporta um layout com campos dinâmicos, separadores e cores distribuídos em múltiplas abas
- **THEN** o documento exportado contém toda a estrutura e pode recriar o mesmo layout em uma instalação compatível

#### Scenario: Importar documento anterior
- **WHEN** o usuário importa um documento portátil válido da versão anterior
- **THEN** o sistema o converte em uma aba única e permite aplicá-lo como configuração global ou novo template

#### Scenario: Rejeitar documento inválido sem escrita parcial
- **WHEN** o documento possui abas inválidas, campos duplicados, referências desconhecidas ou propriedades de item inválidas
- **THEN** o sistema informa o erro e não cria campos dinâmicos nem altera configurações ou templates existentes
