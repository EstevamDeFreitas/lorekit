## Why

O Editor.js oferece uma experiência de edição baseada em blocos que usuários percebem como pouco natural para escrever e revisar documentos longos. O Lorekit já passou a persistir conteúdo no formato canônico `LorekitDocument`, criando a oportunidade de oferecer uma experiência contínua baseada em Tiptap sem migrar os documentos armazenados nem remover o editor atual.

## What Changes

- Adicionar um editor de texto rico baseado em Tiptap Core e extensões controladas pelo Lorekit.
- Permitir selecionar globalmente, em Configurações Gerais, entre `Editor.js` e `Tiptap`; instalações existentes permanecem em Editor.js por padrão.
- Preservar o contrato persistido `LorekitDocument`, permitindo que os dois editores abram e gravem o mesmo conteúdo.
- Migrar a experiência de @menção para o Tiptap usando a busca e navegação de entidades já existentes.
- Recriar no Tiptap os recursos canônicos de texto, listas, citações, tabelas e imagens, sem introduzir funcionalidades que não possam ser preservadas pelo contrato canônico.
- Manter conteúdo não totalmente editável pelo editor ativo, exibindo uma indicação controlada em vez de removê-lo.

## Capabilities

### New Capabilities

- `configurable-rich-text-editor`: seleção global e segura do motor de edição, experiência Tiptap e paridade de recursos sobre o formato canônico do Lorekit.

### Modified Capabilities

- Nenhuma.

## Impact

- Afeta o componente reutilizável `app-editor`, a tela de Configurações Gerais, o serviço de parâmetros globais e os fluxos de salvamento pendente.
- Adiciona dependências Tiptap Core, ProseMirror e extensões selecionadas; Editor.js continua instalado e disponível.
- Adiciona um adaptador Tiptap e extensões/nós próprios para menções, imagens e citações com legenda.
- Não requer migração de banco de dados nem alteração dos consumidores de prévia e exportação, que continuam usando `LorekitDocument`.
