## Why

Os campos de texto rico do Lorekit persistem diretamente o formato de saída do Editor.js, vinculando o banco, as prévias e a sincronização a uma biblioteca de interface. Um documento canônico do Lorekit elimina esse acoplamento e permite adotar outro editor futuramente sem migrar novamente os dados dos usuários.

## What Changes

- Introduzir o formato versionado `LorekitDocument` como a única representação persistida para novos salvamentos de texto rico.
- Adicionar uma camada de adaptadores que converte entre `LorekitDocument` e o formato de cada editor, começando pelo Editor.js.
- Converter conteúdo legado do Editor.js e texto puro ao carregá-los; o conteúdo passa ao formato Lorekit no próximo salvamento, sem regravação global do banco.
- Centralizar geração de prévias e exportações sobre o modelo canônico, em vez de interpretar blocos do Editor.js fora do adaptador.
- Preservar títulos, parágrafos, listas aninhadas e checklists, citações, tabelas, imagens, formatação inline e menções a entidades durante a conversão.
- Definir tratamento explícito para recursos não suportados por um editor: preservá-los no documento canônico e nunca descartá-los silenciosamente.

## Capabilities

### New Capabilities

- `rich-document-portability`: representação canônica, versionada e independente de editor para conteúdo rico, incluindo conversão compatível com o Editor.js e com dados legados.

### Modified Capabilities

- Nenhuma.

## Impact

- Afeta o wrapper reutilizável `app-editor`, seus plugins Editor.js e todos os campos de entidades e campos dinâmicos que recebem seu evento de salvamento.
- Afeta a prévia de documentos do moodboard e a exportação de texto/Markdown.
- Não requer alteração no schema SQLite: os conteúdos permanecem em colunas `TEXT`; backups, transferência de entidades e sincronização transportarão o novo valor serializado normalmente.
- Exige testes de conversão bidirecional, regressões de conteúdo legado e preservação de recursos em adaptadores com capacidades diferentes.
