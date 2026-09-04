## 1. Fundação de dados e dependências

- [x] 1.1 Adicionar dependências Tiptap Core, ProseMirror e extensões explicitamente necessárias, mantendo as dependências Editor.js, e verificar que a instalação e o build de produção do frontend concluem.
- [x] 1.2 Implementar o adaptador Tiptap bidirecional entre a árvore do editor e `LorekitDocument`, e verificar com testes unitários de ida e volta para blocos, listas aninhadas, marcas, links e menções.
- [x] 1.3 Cobrir no adaptador a desserialização de conteúdo canônico, legado do Editor.js e texto simples via `LorekitDocumentCodec`, e verificar que nenhum desses casos persiste JSON nativo do Tiptap.

## 2. Extensões e experiência Tiptap

- [x] 2.1 Configurar os nós e marcas Tiptap representáveis pelo contrato canônico, limitando comandos de tabela e outros recursos sem representação, e verificar a preservação do conteúdo ao salvar e reabrir.
- [x] 2.2 Implementar a extensão e o menu de @menções do Lorekit usando `EntityMentionService`, e verificar busca, inserção, persistência e abertura da entidade referenciada.
- [x] 2.3 Implementar o nó/NodeView de imagem do Lorekit com upload, referência de ativo, legenda e opções de layout, e verificar que uma imagem existente conserva todos os atributos após salvamento.
- [x] 2.4 Implementar nós próprios para citação com legenda e conteúdo não totalmente editável, e verificar que ambos apresentam indicação apropriada e não perdem dados em um ciclo de salvamento.

## 3. Seleção e integração do editor

- [x] 3.1 Transformar `app-editor` em uma fachada que preserve seus inputs, output, exportação e contratos de salvamento pendente, e verificar que seus consumidores existentes continuam compilando sem alteração de API.
- [x] 3.2 Integrar o componente Tiptap à fachada com toolbar, carregamento, salvamento por revisão e tratamento de flush/descarte, e verificar que o output emitido é um `LorekitDocument`.
- [x] 3.3 Adicionar a preferência global restrita a `editorjs` e `tiptap` em Configurações Gerais, com padrão seguro Editor.js e aviso de aplicação após reabrir campos, e verificar os dois cenários na interface.
- [x] 3.4 Garantir que a preferência seja respeitada por documentos, descrições de entidades e campos dinâmicos de editor, e verificar cada tipo de campo com ambos os motores.

## 4. Compatibilidade e validação

- [x] 4.1 Criar testes de regressão para abrir com Editor.js conteúdo salvo no Tiptap e abrir com Tiptap conteúdo canônico/legado do Editor.js, verificando blocos, marcas, menções, imagens e conteúdo limitado.
- [x] 4.2 Verificar prévias de moodboard e exportações texto/Markdown após edição nos dois motores, confirmando que continuam derivados exclusivamente de `LorekitDocument`.
- [x] 4.3 Executar a suíte de testes e o build de produção do frontend, revisar o tamanho do bundle e corrigir falhas ou regressões encontradas.
