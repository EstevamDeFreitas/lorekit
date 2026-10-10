## 1. Modelos e normalizacao

- [x] 1.1 Adicionar os tipos `slider`, `list` e `chart` e os contratos JSON versionados de configuracao/valor, com defaults e validacao cobrindo limites, colunas e dados de grafico
- [x] 1.2 Atualizar catalogo, editor e portabilidade para reconhecer, exportar, importar e comparar as novas definicoes sem alterar tipos legados; verificar com os testes de servicos existentes e novos testes de normalizacao

## 2. Componentes de entrada e visualizacao

- [x] 2.1 Criar o componente de Slider com limites, passo, unidade, valor inicial seguro e emissao de valor numerico; verificar com cenarios de valor valido e fora da faixa
- [x] 2.2 Criar o componente de Listagem com modos tabela/headless, formulario de linha, validacao de Text/Number/Boolean/Date e reordenacao; verificar inclusao, edicao, remocao, ordem e estado vazio
- [x] 2.3 Criar o componente SVG de Grafico para Radar, Barra e Linha com titulo, legenda, cor, labels, uma serie e estados vazios/invalidos; verificar cada tipo e acessibilidade basica

## 3. Integracao na ficha e no editor

- [x] 3.1 Integrar os componentes ao renderizador de campos configurados, incluindo parse/serialize de valores, debounce de salvamento e preservacao de valores existentes ao trocar configuracoes
- [x] 3.2 Adicionar ao editor de layout os tipos, formularios de configuracao, defaults, labels e validacao dos novos campos; verificar criacao, edicao e disponibilidade no catalogo/layout

## 4. Validacao final

- [x] 4.1 Adicionar ou ajustar testes de portabilidade para preservar configuracoes dos tres tipos e compatibilidade com documentos legados
- [x] 4.2 Executar testes e build de producao do frontend, corrigir erros de template/tipagem e verificar o fluxo completo por tipo via compilacao, testes e integracao do renderizador
