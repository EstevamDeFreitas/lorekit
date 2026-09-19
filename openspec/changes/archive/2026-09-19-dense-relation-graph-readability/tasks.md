## 1. Baseline e regressões

- [x] 1.1 Criar fixtures determinísticas descritas no design e registrar screenshots, colisões, cruzamentos e tempos do comportamento atual; verificar relatório reproduzível com viewport, seed e equipamento.
- [x] 1.2 Reproduzir dois links inversos coincidentes com comparação geométrica amostrada, incluindo sentido reverso; verificar que a regressão falha no algoritmo atual.

## 2. Geometria e projeção

- [x] 2.1 Separar índices por nó/par, projeção e cache de geometria do template; verificar que pan não recalcula layout nem reagrupa todos os links.
- [x] 2.2 Implementar normal canônica, faixas para links inversos/paralelos e setores para loops; verificar geometria distinguível e edição por id em todos os casos.
- [x] 2.3 Implementar detecção de obstáculos e rotas alternativas com indicação de congestionamento; verificar desvio de terceiro nó e acesso ao link quando não houver corredor.
- [x] 2.4 Implementar resumo reversível por par com contagens direcionais e lista de links originais; verificar integridade após expandir, editar, inverter e excluir.

## 3. Rótulos e exploração

- [x] 3.1 Medir nomes e rótulos em coordenadas de tela, alocar candidatos por prioridade e recalcular após fontes, zoom e resize; verificar zero colisões de caixas exibidas na matriz visual.
- [x] 3.2 Mostrar texto ativo sem espaço no painel e implementar lista pesquisável de todas as relações do escopo; verificar nomes completos, navegação por teclado e consulta de 80 links de um hub.
- [x] 3.3 Adicionar foco explícito de 1/2 níveis, contagens e retorno à teia completa com restauração da viewport; verificar que seleção simples não muda escopo e abertura da raiz mantém o componente completo.

## 4. Layout e navegação

- [x] 4.1 Criar adaptador de layout e avaliar Cytoscape.js/fCoSE local em modo headless; registrar versão, licença, tamanho, worker e comparação com baseline conforme gate do design.
- [x] 4.2 Integrar o motor aprovado ou melhorar o adaptador existente conforme resultados do gate; verificar mundo central, isolados, nomes reservados e ausência de links inventados.
- [x] 4.3 Reordenar primeiro anel por conectividade e expandir raios pela ocupação mantendo raiz fixa; verificar circularidade, afinidade dos ramos e métricas de cruzamento.
- [x] 4.4 Executar cálculos pesados de forma cancelável e descartar gerações antigas; verificar troca de mundo durante cálculo, progresso e orçamentos 200/800 e 500/2000.
- [x] 4.5 Implementar fit com limites de rotas e rótulos e transição final curta; verificar pan 1:1, zoom livre, painel aberto, toque e movimento reduzido.

## 5. Aceitação integrada

- [x] 5.1 Executar comparação visual antes/depois de todas as fixtures nas viewports e zooms do design; entregar capturas e métricas sem marcar como concluído apenas por build/testes unitários.
- [x] 5.2 Verificar regressões de escopo, raiz, dados completos, CRUD e acessibilidade; executar suíte frontend e build de produção e registrar resultados.
- [x] 5.3 Validar a nova change com openspec validate dense-relation-graph-readability --strict e revisar git diff --check; verificar que o arquivo histórico anterior permanece intacto.
