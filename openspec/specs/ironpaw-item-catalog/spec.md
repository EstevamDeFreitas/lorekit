## Purpose

Permitir cadastrar, consultar e reutilizar definições de itens Ironpaw em um catálogo acessível pelo workspace, preservando a distinção entre regras mecânicas e descrições narrativas.

## ADDED Requirements

### Requirement: Gerenciador acessível pelo workspace
O sistema SHALL apresentar Gerenciador de Conteúdo imediatamente abaixo de Vocações na navegação Ironpaw e abrir ou focar sua aba no workspace. O catálogo SHALL funcionar offline, tanto no desktop quanto na versão web, com busca por nome e filtros por categoria e raridade.

#### Scenario: Acessar catálogo novamente
- **WHEN** o usuário aciona Gerenciador de Conteúdo com sua aba já aberta
- **THEN** a aba existente é focada, sem perder a seleção ou criar uma duplicata

#### Scenario: Filtrar catálogo
- **WHEN** o usuário combina texto de busca e categoria
- **THEN** a lista apresenta somente itens correspondentes e informa quando não há resultados

### Requirement: Cadastro tipado de itens
O sistema SHALL permitir criar, editar, duplicar e arquivar definições com nome obrigatório, descrição, ícone, imagem opcional, etiquetas, categoria, raridade opcional e configuração de empilhamento. As categorias SHALL incluir item comum, ferramenta, consumível, arma, proteção e vestível. Os campos específicos SHALL depender da categoria, e valores inválidos MUST impedir o salvamento com mensagens identificando os campos.

#### Scenario: Cadastrar arma
- **WHEN** o usuário salva uma arma válida
- **THEN** o catálogo preserva propriedades básicas selecionadas, tipos de dano múltiplos, propriedade específica, espaços compatíveis e ocupação das mãos, sem inferir dano a partir de raridade

#### Scenario: Configurar consumível
- **WHEN** o usuário cadastra um consumível
- **THEN** pode definir subtipo recuperação, ofensivo ou utilitário, descrição do efeito e eventual teste exigido, sendo apresentado custo padrão de uma ação e consumo de uma unidade

#### Scenario: Limite de pilha inválido
- **WHEN** o usuário define limite de pilha não inteiro ou menor que um
- **THEN** o salvamento é recusado sem alterar a definição anterior

### Requirement: Representação fiel das regras narrativas
O sistema SHALL tratar raridade como opcional e sem escalonamento numérico. Ferramentas SHALL apresentar bônus contextual de +1, vestíveis comuns MUST NOT conceder dano ou defesa automaticamente, e tipos de dano físicos SHALL permanecer descritores. A característica item único SHALL coexistir com qualquer categoria, permitindo benefícios e custos, consequências, limitações ou vínculo narrativo. Mais de dois benefícios sem contrapartida SHALL gerar aviso de regra no editor, sem impedir exceções deliberadas do narrador.

#### Scenario: Vestível único
- **WHEN** um vestível recebe a característica item único e benefícios descritos
- **THEN** esses benefícios aparecem nos detalhes sem criar modificadores automáticos não suportados

#### Scenario: Ferramenta no inventário
- **WHEN** uma ferramenta é cadastrada com sua finalidade
- **THEN** sua descrição informa que +1 depende da adequação à ação e não representa bônus permanente

### Requirement: Proteções com categorias explícitas
O sistema SHALL oferecer leve, média e pesada, com contribuições de +1, +2 e +3 PR respectivamente. SHALL apresentar o benefício contextual de mobilidade da leve e, na pesada, as descrições de redução de dano e penalidades de Desequilibrado/Atrapalhado Leve. Efeitos adicionais SHALL ser identificados como características de item único; esta entrega MUST NOT resolver dano nem aplicar condições automaticamente.

#### Scenario: Consultar proteção pesada
- **WHEN** o usuário consulta uma proteção pesada
- **THEN** vê sua contribuição de +3 PR e os efeitos descritos, sem alteração automática de rolagens ou condições

### Requirement: Ciclo de vida independente das posses
O sistema SHALL distinguir definição do catálogo de cópias dos personagens. Arquivar SHALL retirar a definição da seleção padrão para novas posses, mantendo-a consultável por filtro. Editar ou arquivar MUST NOT modificar ou remover cópias existentes. Duplicar SHALL criar nova identidade portável.

#### Scenario: Arquivar item possuído
- **WHEN** o usuário arquiva uma definição usada em uma ficha
- **THEN** a ficha mantém o item e suas características e a definição deixa de aparecer na seleção padrão de adicionar itens

#### Scenario: Reutilizar nomes
- **WHEN** duas definições diferentes têm o mesmo nome
- **THEN** ambas permanecem identificáveis e não são mescladas apenas pelo nome
