## 1. Modelo canônico e compatibilidade de persistência

- [x] 1.1 Definir os tipos estritos de `LorekitDocument` v1, blocos, conteúdo inline, referências de menção, opções de imagem e capacidades de editor; verificar com compilação TypeScript sem introduzir `any` no novo contrato.
- [x] 1.2 Implementar o codec puro de leitura e serialização que reconhece documento Lorekit, saída legada do Editor.js, JSON inválido e texto puro; verificar com testes unitários para cada formato de entrada e para migração somente ao salvar.
- [x] 1.3 Implementar a conversão e sanitização de HTML inline legado para marcas, links e menções estruturadas do modelo canônico; verificar com testes de negrito, itálico, cor, marcador, link, menção e texto preservado.
- [x] 1.4 Implementar projeções canônicas para texto puro e Markdown; verificar com testes de título, lista aninhada/checklist, citação, tabela, imagem e conteúdo inline.

## 2. Adaptador Editor.js

- [x] 2.1 Criar a abstração tipada de adaptador de editor e a implementação Editor.js que converte todos os blocos e recursos atuais nos dois sentidos; verificar com testes de ida e volta sem perda dos recursos suportados.
- [x] 2.2 Implementar tratamento de recurso não suportado baseado nas capacidades do adaptador, com fallback controlado e preservação do nó canônico ao salvar; verificar com teste que confirma a ausência de descarte silencioso.
- [x] 2.3 Integrar o adaptador e o codec ao `app-editor`, trocando carregamento e emissão de dados brutos do Editor.js por `LorekitDocument`; verificar manualmente autosave, flush pendente, descarte e reabertura de conteúdo legado.
- [x] 2.4 Atualizar as tipagens dos outputs e handlers de campos ricos para aceitar o documento canônico sem alterar a persistência `TEXT`; verificar edição e novo salvamento em documento, mundo, entidades e campo dinâmico.

## 3. Consumidores de conteúdo rico

- [x] 3.1 Migrar a prévia de documento no moodboard para usar a projeção canônica e a leitura compatível; verificar prévias de conteúdo Lorekit, legado do Editor.js e texto puro.
- [x] 3.2 Migrar a exportação TXT e Markdown do editor para partir do documento canônico; verificar os arquivos exportados com blocos e formatações atualmente suportados.
- [x] 3.3 Remover interpretações diretas restantes de estruturas persistidas do Editor.js fora do adaptador; verificar por busca estática que consumidores de conteúdo rico não dependem de `OutputData.blocks`.

## 4. Regressão e entrega segura

- [x] 4.1 Adicionar uma suíte de regressão com amostras de conteúdo legado realista, incluindo cabeçalho, imagem, lista, tabela e menção; verificar que abrir e salvar não perde conteúdo semântico.
- [x] 4.2 Validar que backup, transferência de entidade e sincronização continuam transportando documentos canônicos como valores de texto sem mudança de schema; verificar com os testes existentes e um fluxo manual de exportação/importação.
- [x] 4.3 Executar `npm run build` no frontend e `openspec validate lorekit-editor-middleware --strict`; verificar que build e validação terminam sem erros.
