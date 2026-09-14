## Context

Consulte `proposal.md` para a motivação e `specs/entity-relation-graph/spec.md` para o contrato observável. Hoje o componente de relações exige `rootTable`/`rootId`, o `LinkService` percorre links a partir dessa raiz e o utilitário radial cria apenas os nós encontrados nessa travessia. A tela também aplica posições e dimensões salvas em `Link.configJson`.

O pertencimento ao mundo é representado pela tabela genérica `Relationship`, que pode encadear uma entidade a um mundo por meio de pais intermediários. As telas de listagem já observam `WorldStateService.currentWorld$`. A tela de relações usa SVG e não possui uma biblioteca de layout de grafos instalada.

## Goals / Non-Goals

**Goals:**

- Montar uma visão completa e automática do escopo, incluindo entidades isoladas.
- Aplicar uma precedência de escopo previsível: raiz explícita, mundo da raiz, mundo global selecionado e, por fim, visão global.
- Manter a raiz explícita estável quando o mundo global mudar.
- Representar nós circulares e arestas direcionais distinguíveis em redes cíclicas ou densas.
- Preservar a edição de links por seleção, com um painel mais focado e compatível com o escopo atual.
- Usar os recursos SVG e Angular já presentes, evitando dependência de biblioteca de grafos nesta etapa.

**Non-Goals:**

- Não alterar o modelo persistido de `Link` ou `Relationship`.
- Não migrar nem apagar posições, dimensões ou personalizações antigas salvas em `configJson`.
- Não permitir arrastar, redimensionar ou personalizar manualmente os nós nessa tela.
- Não criar uma ferramenta livre de composição; essa responsabilidade continua no moodboard.
- Não mudar o significado ou a direção dos links existentes.

## Decisions

### 1. Resolver o escopo antes de montar o grafo

Será introduzido um resolvedor reutilizável de pertencimento ao mundo, preferencialmente extraindo a lógica hoje privada do `MoodboardService`. Ele deverá carregar as relações de hierarquia e percorrer os filhos de um mundo com um conjunto de visitados, evitando consultas recursivas repetidas e ciclos de dados.

A prioridade será:

```text
raiz explícita
    -> mundo que contém a raiz, quando existir
    -> visão global enraizada, se a raiz não possuir mundo
sem raiz
    -> mundo global selecionado
    -> visão global
```

Essa ordem faz a raiz prevalecer sobre o contexto global sem alterar o mundo selecionado no restante da aplicação. Quando o escopo for um mundo, apenas entidades desse mundo serão consideradas e o mundo poderá aparecer como nó quando for a raiz ou participar de um link explícito.

Alternativa considerada: sempre aplicar o mundo global, invalidando uma raiz aberta em outro mundo. Foi descartada porque torna abas de relações abertas a partir de entidades instáveis e contradiz a intenção de manter a raiz como foco.

### 2. Montar uma visão completa, não uma travessia limitada pela raiz

O serviço de links deverá obter os resumos de todas as tabelas selecionáveis dentro do escopo resolvido e carregar todos os links disponíveis em uma única montagem de visão. Um link só será incluído quando suas duas pontas estiverem no conjunto de entidades visíveis. A raiz define centralidade e escopo, mas não limita o grafo a uma profundidade.

Essa montagem também deverá ser usada para preencher o seletor da entidade principal e os destinos do editor. O filtro de tipo altera somente as opções do seletor da raiz; ele não reduz os nós já visíveis.

Alternativa considerada: chamar os serviços específicos de personagens, espécies, locais etc. individualmente. Foi descartada porque esses serviços priorizam relações diretas com `World`, enquanto a tela precisa incluir descendentes e documentos/entidades cujo mundo pode ser herdado por uma cadeia de pais.

### 3. Usar layout híbrido determinístico

O layout será implementado nos utilitários do grafo, sem dependência externa:

1. Ordenar nós por uma chave estável e distribuir componentes/conjuntos inicialmente em círculos concêntricos.
2. Fixar a raiz no centro quando existir.
3. Aplicar um número limitado de iterações de relaxamento: atração entre pontas conectadas, repulsão entre nós, colisão baseada no raio e uma força suave em direção ao centro/limite circular.
4. Distribuir nós isolados em uma órbita externa, evitando que sejam confundidos com entidades conectadas.
5. Fixar o resultado no canvas e recalcular quando o escopo, a raiz ou os links mudarem.

O resultado deverá ser determinístico para que a tela não reorganize a rede de forma imprevisível em cada detecção de mudança. Em redes pequenas, o relaxamento melhora a leitura da teia; em redes grandes, o número de iterações e o cálculo de repulsão deverão ser limitados, com o arranjo circular como fallback seguro.

Alternativas consideradas: radial puro, que é simples mas não acomoda bem cruzamentos e ciclos; e D3/força externa, que resolveria parte do layout mas adicionaria peso e uma nova API ao frontend offline. O híbrido local preserva o controle sobre a geometria e a dependência atual do SVG.

### 4. Separar geometria visual de persistência

`GraphNode` passará a representar raio e metadados visuais do nó, em vez de dimensões de cartão. O componente não deverá ler nem salvar posições ou tamanhos em `Link.configJson`. Os métodos antigos de persistência podem permanecer para compatibilidade de dados ou remoção posterior, mas não serão chamados por esta experiência.

As imagens existentes continuarão disponíveis dentro do círculo, com recorte circular e fallback textual. A identificação por tipo usará uma paleta estática da tela, não a personalização individual persistida.

### 5. Rotear arestas para preservar a teia

Antes da renderização, as arestas serão agrupadas por par de nós. A geometria deverá atribuir deslocamentos opostos para links inversos e deslocamentos graduais para links paralelos. Autorrelações receberão um caminho de loop. Cada aresta manterá seu id para seleção individual, mesmo quando compartilhar as mesmas pontas.

Os marcadores de seta indicarão a direção. Labels completos serão priorizados para a aresta selecionada ou sob foco; as demais poderão usar indicação compacta/tooltip para preservar legibilidade. O caminho visual terá uma área de interação maior que o traço aparente, facilitando a seleção sem engrossar permanentemente o desenho.

### 6. Simplificar o estado e a interação do componente

O componente observará `WorldStateService.currentWorld$` usando o mesmo ciclo de vida adotado pelas telas de listagem. A mudança do mundo atualizará a visão geral; uma visão enraizada manterá o escopo derivado da raiz. O estado local poderá ser organizado com signals e `OnPush`, aproveitando a remoção da mutação de posições durante arraste.

Pan, zoom e centralização da viewport permanecem como navegação do canvas. Nós não serão arrastáveis nem redimensionáveis. Clique em um nó apenas o selecionará e abrirá o painel contextual; uma ação explícita como “Tornar entidade principal” será responsável por trocar o centro.

O painel deverá começar em estado de inspeção, com nome/tipo da entidade, contagens e listas de relações de saída/chegada. O formulário de link será aberto somente ao criar ou editar, mantendo criar, salvar, inverter e excluir. A seleção de destino deverá usar o mesmo escopo da visão, impedindo que o editor introduza uma ponta invisível no grafo atual.

### 7. Tratar links entre mundos sem mutação

Em qualquer visão escopada a um mundo, um link com uma ponta fora do mundo será filtrado apenas para a apresentação. Nenhuma operação de limpeza ou exclusão será executada sobre esses links. A visão global sem raiz/mundo poderá mostrar links desde que ambas as pontas estejam no conjunto global carregável.

Para reduzir surpresa quando uma raiz de outro mundo for aberta, o cabeçalho deverá informar o escopo efetivo, por exemplo `Foco: entidade X` e `Escopo: mundo Y`, sem alterar o mundo global da aplicação.

## Risks / Trade-offs

- **[Grafo muito grande]** -> A repulsão pode custar O(n²) e tornar a abertura lenta; limitar iterações, ordenar de modo determinístico e usar agrupamento espacial/fallback circular quando necessário.
- **[Relacionamentos hierárquicos cíclicos ou inconsistentes]** -> O resolvedor de mundo usará conjunto de visitados e ignorará referências duplicadas ou inexistentes.
- **[Muitas arestas e labels sobrepostos]** -> Curvas por grupo, labels sob foco e destaque contextual reduzem a poluição sem esconder a relação selecionável.
- **[Raiz fora do mundo global]** -> O cabeçalho mostrará o escopo efetivo da raiz, evitando que o usuário interprete a visão como uma troca do mundo global.
- **[Dados antigos de personalização]** -> As configurações permanecerão intactas e serão ignoradas pelo novo renderer, permitindo rollback sem migração destrutiva.
- **[Destino fora do escopo durante a edição]** -> O seletor de destino será filtrado pelo escopo; links antigos fora dele continuarão consultáveis apenas em uma visão compatível.

## Migration Plan

1. Criar o resolvedor compartilhado de escopo e cobrir a resolução por mundo, descendência e precedência da raiz.
2. Adaptar a montagem de `GraphView` para incluir entidades isoladas, links filtrados e nós circulares.
3. Substituir a renderização e os controles do componente de relações, preservando pan/zoom e edição de links.
4. Adicionar testes de geometria, layout determinístico, seleção e atualização após alterações.
5. Validar o frontend com os cenários da delta spec e executar o build existente.

Não há migração de banco. O rollback consiste em voltar o código da tela/serviços para a versão anterior; os campos legados de `configJson` não são modificados pela nova experiência.
