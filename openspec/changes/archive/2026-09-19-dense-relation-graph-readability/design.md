## Context

Ver proposal.md para motivação. Revisão estática realizada em 2026-09-14; nenhuma captura de um mundo real foi inspecionada nesta análise.

Evidências:
- relation-graph.component.ts, edgeGeometry: normal perpendicular depende da direção real, mas o deslocamento depende da posição no par não direcionado. Para A=(0,0), B=(100,0), dois links inversos recebem offsets -13 e +13; as normais também invertem e ambos os controles ficam em (50,-13). Os caminhos são geometricamente coincidentes apesar de strings SVG distintas. O teste atual compara strings e não detecta isso.
- A curva não verifica obstáculos; o texto fica no ponto médio com deslocamento fixo de 7 unidades. Desenhar texto acima dos nós mascara a colisão.
- showEdgeLabel usa limite global de 24 links; selecionar um hub revela todos os rótulos incidentes sem considerar espaço disponível ou zoom.
- edgeGeometry procura nós e reagrupa/ordena links a cada chamada do template, em dois loops. Isso acrescenta trabalho aproximadamente quadrático em arestas durante interações.
- world-overview-layout usa componentes conectados, não comunidades: uma ponte une dois grupos em um só. A simulação ignora links incidentes ao mundo e tem 180 iterações síncronas de repulsão par a par. As caixas dos textos e colisões de arestas não participam.
- O layout com raiz organiza primeiro nível por chave e usa incrementos radiais fixos. Reduzir sobreposição de círculos não minimiza cruzamentos.

## Goals / Non-Goals

Goals: distinguir relações, garantir rótulos exibidos legíveis e oferecer consulta completa mesmo quando a geometria geral fica densa. Preservar precedência da raiz, escopo, primeiro nível radial, mundo central, edição por id e dados completos.

Non-goals: garantir zero cruzamentos para todo grafo, criar hierarquia semântica a partir de Link, migrar banco, alterar moodboard, adicionar serviço remoto ou comprar licença de layout.

## Decisions

### 1. Separar dados, apresentação, layout, rotas e rótulos

Manter GraphView completo como fonte e criar uma projeção visual derivada. Índices por nó/par e cache de caminhos por versão do layout substituem cálculos repetidos no template. Pan não recalcula física; zoom/resize recalculam somente rótulos e representação visual em requestAnimationFrame. Edição invalida a projeção por ids.

Pipeline: escopo completo → projeção/foco → posições → rotas → caixas de rótulos → SVG acessível.

### 2. Corrigir rotas antes de trocar a física

Ordenar chaves do par para uma normal canônica; calcular faixas por id e só depois orientar o caminho para a seta real. Separar loops por setor e raio. Agrupar mais de três links no mesmo par em modo automático numa conexão com contagens por direção. Clique abre lista completa; selecionar um link revela sua rota exclusiva. Oferecer modo expandido.

Rotas consideram caixas dos nós e nomes com margem. Primeiro testar curvas candidatas; se todas colidirem, usar desvio por waypoints com curvas arredondadas, custando comprimento, curvas e cruzamentos. Para uma rota ainda sem corredor, sinalizar a relação como congestionada e dar acesso ao foco/lista; não omitir silenciosamente. Não confundir cruzamento pontual inevitável com segmento coincidente.

### 3. Rótulos em coordenadas da tela

Medir texto após carregar fontes; usar caixas de nomes e rótulos com margem de 4 CSS px. Prioridade: link em edição, link focado, entidade selecionada/raiz, vizinhos, demais. Testar posições ao longo de 25%, 50%, 75% da curva e offsets normais. Só mostrar candidato que não intersecte caixa ocupada/nó.

Se não couber, esconder apenas o rótulo automático e manter acesso pelo foco, teclado e painel. O texto ativo sem posição viável aparece num cartão fixo no painel, nunca sobre outro texto. Não revelar todos os rótulos de um hub de uma vez. Nenhum zoom pode forçar sobreposição; nomes inteiros continuam acessíveis.

### 4. Visão geral e foco explícito

Abertura mantém teia completa. Controles: Rótulos automáticos, Resumir paralelas, Focar entidade (1 nível / 2 níveis / Teia completa), Ajustar à tela.

Foco é opcional e transitório, não substitui entidade principal nem muda o banco. Contagens mostram relações visíveis/total do escopo. Voltar restaura viewport e seleção; busca/lista alcança todos os links do escopo. Hubs continuam consultáveis via lista pesquisável com origem, nome, destino e direção.

Adiar colapso automático de comunidades e bundling entre pares diferentes: ambos exigem explicação extra e podem dificultar seguir uma relação individual. A agregação inicial é exclusivamente por par.

### 5. Layout orientado à qualidade, com adaptador

Avaliar Cytoscape.js + fCoSE como motor de posições em modo headless, mantendo SVG e controles acessíveis. Referência de implementação, não promessa de roteamento ou garantia de colisões. Confirmar versão, licença e capacidade de execução em worker antes da integração; empacotar localmente e carregar sob demanda.

Mundo permanece fixo no centro com área de reserva. Medidas dos nomes entram nas dimensões dos nós; links do mundo participam sem inventar ligações. Empacotar componentes para não desperdiçar área com muitos isolados.

Com raiz, preservar primeiro anel circular: ordenar vizinhos por conectividade e realizar trocas locais que diminuam cruzamentos; expandir raio pela ocupação real. Fixar esse anel no adaptador; restantes usam posições anteriores e afinidade com os ramos. Distância BFS é somente organização visual, não parentesco.

Gate do motor: comparar fixture a fixture com baseline; aceitar se cumprir integridade e colisões, não piorar mediana de cruzamentos e melhorar casos densos dentro do orçamento. Se fCoSE não atender, manter adaptador com layout existente melhorado; documentar medidas, sem dispensar critérios da spec.

### 6. Navegação e desempenho

Fit usa limites de nós, rotas e rótulos mais padding, incluindo painel aberto. Zoom proporcional livre continua; transformação de coordenadas deve manter pan 1:1. Evitar animação de física contínua; animar apenas transição final breve quando não houver arrasto e respeitar prefers-reduced-motion.

Processar layouts pesados fora da thread principal ou em lotes canceláveis. Identificar pedidos por geração; resultados antigos de outro mundo/raiz nunca substituem o atual. Mostrar progresso após 150ms e manter último layout utilizável. Orçamento inicial: redes 200 nós/800 links prontas em até 2s e 500/2000 em até 5s no equipamento de referência registrado; p95 de interação abaixo de 32ms e sem tarefas de layout na UI acima de 50ms. Orçamento é critério a verificar, não medição já obtida.

### 7. Evidência de qualidade

Fixtures: dois links inversos; dez paralelos; múltiplos loops; estrela de 80 vizinhos; ciclo com cordas; dois grupos unidos por ponte; muitos isolados; cadeia de 180; K5; K3,3; nomes de 60 caracteres; redes 200/800 e 500/2000 com seed fixa.

Medir caixas em tela, interseções linha/nó, segmentos coincidentes, cruzamentos, tempo e integridade de ids. Comparar antes/depois nas mesmas viewports: 1440x900, 1024x768 e 390x844; zoom 25%, 100%, 250% e fit. Aceitar zero colisões de rótulos efetivamente exibidos, curvas inversas distinguíveis e acesso a 100% dos links. Zero cruzamentos não é requisito para grafos não planares.

Inspeção visual obrigatória com screenshots e registro do modo/zoom; testes de string e build isoladamente não comprovam legibilidade. Casos não solucionáveis visualmente devem demonstrar foco e lista utilizáveis.

## Risks / Trade-offs

- [Rede arbitrária não cabe legível inteira] → foco opcional, resumo reversível por par e lista completa.
- [Dependência adiciona peso e varia posições] → lazy loading, seed/ordenação estáveis, posições anteriores, medição e adaptador.
- [Roteamento com obstáculos aumenta custo] → cache, índice espacial e prioridade para links ativos.
- [Rótulos variam com fonte/zoom] → medição em CSS px e recalcular após fonts.ready/resize.
- [Foco pode parecer exclusão] → contagens visíveis, botão Teia completa e restauração de contexto.

## Migration Plan

Implementar em etapas: regressões geométricas; cache/rotas; rótulos; projeção e foco; motor; validação visual e desempenho. Ativação local com possibilidade de retorno ao layout anterior durante desenvolvimento. Nenhuma migração de dados. No fechamento, sincronizar esta capability principal antes de arquivar; a change anterior continua intacta.

## References

- Cytoscape, escolha do subgrafo e limitações de redes densas: https://blog.js.cytoscape.org/2020/05/11/layouts/
- fCoSE, motor e restrições: https://github.com/iVis-at-Bilkent/cytoscape.js-fcose
- Obsidian, grafo local e profundidade: https://obsidian.md/help/plugins/graph
- yWorks, exemplo de bundling para reduzir ruído (referência de UX, sem dependência comercial): https://www.yworks.com/demos/layout/edgebundling/
