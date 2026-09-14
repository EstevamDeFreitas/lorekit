## 1. Escopo por mundo e precedência da raiz

- [x] 1.1 Extrair ou criar `EntityWorldScopeService` para resolver o mundo de uma entidade e enumerar descendentes a partir de `Relationship`, com proteção contra ciclos e referências inválidas; verificar com testes unitários de pertencimento direto, herdado e cíclico.
- [x] 1.2 Implementar a precedência `raiz explícita > mundo da raiz > mundo global selecionado > visão global`; verificar com testes que uma raiz de outro mundo permanece centralizada e não muda quando o mundo global é trocado.
- [x] 1.3 Integrar o resolvedor ao `MoodboardService` sem alterar o comportamento observável do moodboard; verificar que a suíte existente do moodboard continua passando.

## 2. Montagem dos dados do grafo

- [x] 2.1 Atualizar os tipos de grafo para representar nós circulares, raio, estado de isolamento, grau/conectividade e raiz opcional, removendo a dependência do conceito de cartão; verificar compilação dos consumidores do grafo.
- [x] 2.2 Adaptar o `LinkService` para obter todos os resumos de entidades selecionáveis no escopo resolvido, incluindo entidades sem links e imagens/fallbacks; verificar testes com entidade isolada e com todos os tipos de entidade.
- [x] 2.3 Adaptar a montagem de links para carregar a visão completa sem limite de profundidade e manter somente links cujas duas pontas estejam no escopo; verificar que links entre mundos ficam ocultos sem serem excluídos do banco.
- [x] 2.4 Fazer os seletores de entidade principal e de destino de relação usarem o mesmo escopo da visão, mantendo o filtro de tipo restrito à seleção da raiz; verificar cenários com mundo selecionado, visão global e raiz de outro mundo.

## 3. Layout e geometria automática

- [x] 3.1 Implementar a distribuição inicial determinística em círculos/componentes e o relaxamento híbrido com atração, repulsão, colisão, limite circular e raiz fixada; verificar testes de repetibilidade, raiz no centro, ciclos e nós isolados.
- [x] 3.2 Implementar fallback de layout para redes grandes ou iterações interrompidas, mantendo todos os nós visíveis; verificar tempo/resultado com um conjunto sintético de alta densidade.
- [x] 3.3 Implementar geometria de arestas curvas agrupando links por par, separando links inversos/paralelos e gerando loops para autorrelações; verificar testes de pontos/caminhos e seleção individual por id.

## 4. Nova apresentação da tela

- [x] 4.1 Fazer o componente observar `WorldStateService.currentWorld$`, carregar a visão geral automaticamente e recalcular o escopo quando o mundo mudar; verificar manualmente a troca de mundo com a tela aberta.
- [x] 4.2 Ajustar inputs, query params e seletores para suportar entidade principal opcional, preservar uma raiz explícita e exibir o escopo efetivo; verificar que limpar a raiz retorna à visão geral correta.
- [x] 4.3 Substituir retângulos por círculos com imagem recortada, fallback textual, indicação de tipo e destaque da raiz/seleção; verificar visualmente nós com e sem imagem em diferentes tamanhos de viewport.
- [x] 4.4 Renderizar arestas direcionais curvas com setas, labels sob foco/seleção e destaque das relações da entidade selecionada; verificar manualmente relações normais, inversas, paralelas e autorrelações.
- [x] 4.5 Remover arraste/redimensionamento de nós e chamadas de leitura/gravação de posições ou tamanhos salvos, mantendo apenas pan, zoom e centralização da viewport; verificar por inspeção de código e teste manual de navegação.
- [x] 4.6 Implementar estados vazios, indicador de quantidade/escopo e mensagens para visão global, mundo sem entidades e entidade selecionada sem relações; verificar cada estado com dados correspondentes.

## 5. Edição contextual de relações

- [x] 5.1 Reorganizar o painel lateral para iniciar em modo de inspeção, mostrar tipo/contagens e separar relações de saída e chegada; verificar seleção de nós e destaque sincronizado no grafo.
- [x] 5.2 Abrir o formulário somente ao criar ou editar uma relação e manter salvar, inverter e excluir usando os links existentes; verificar que cada operação atualiza o grafo e persiste no banco.
- [x] 5.3 Adicionar ação explícita para tornar uma entidade selecionada a principal e manter ações de abrir entidade/abrir relações em nova aba; verificar centralização e atualização do título/estado da aba.
- [x] 5.4 Garantir navegação por teclado, labels acessíveis para nós/arestas e alternativa textual para entidades sem imagem; verificar foco, ativação e leitura dos controles principais.

## 6. Verificação integrada

- [x] 6.1 Adicionar ou ajustar testes unitários do serviço, utilitários e componente para os cenários da delta spec, incluindo precedência da raiz, escopo, isolamento, layout e edição; verificar execução completa da suíte do frontend.
- [x] 6.2 Executar o build de produção do frontend e corrigir erros de template, tipagem ou bundling; verificar conclusão bem-sucedida de `npm run build` dentro de `lorekit-frontend`.
- [x] 6.3 Executar validação OpenSpec e revisão de diff/whitespace; verificar `openspec validate --change "entity-relation-revamp" --strict` e `git diff --check` sem erros.
