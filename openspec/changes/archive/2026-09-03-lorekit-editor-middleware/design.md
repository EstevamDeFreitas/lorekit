## Context

Veja a motivação em `proposal.md`. Atualmente o componente reutilizável `app-editor` carrega a string persistida diretamente no Editor.js e emite seu `save()` bruto; os diversos editores de entidade apenas serializam esse evento. O moodboard também interpreta diretamente `blocks` para produzir prévias. Os conteúdos ricos ocupam colunas SQLite `TEXT`, incluindo `Document.content`, descrições de entidades e valores de campos dinâmicos.

O Editor.js usa estruturas de bloco e conteúdo inline em HTML, além de plugins próprios para cabeçalhos, imagens e menções. Backups, transferência de entidades e sincronização transportam as linhas persistidas sem interpretar o conteúdo.

## Goals / Non-Goals

**Goals:**

- Definir um AST JSON `LorekitDocument` versionado como fonte de verdade para conteúdo rico.
- Isolar Editor.js atrás de um adaptador substituível e manter os consumidores de conteúdo no modelo canônico.
- Permitir leitura de Editor.js legado e texto puro sem migração global do banco.
- Preservar todos os recursos atualmente oferecidos, inclusive conteúdo que outro editor futuro não consiga editar.

**Non-Goals:**

- Trocar o Editor.js nesta mudança.
- Alterar a estrutura das tabelas SQLite, formatos de backup ou protocolos de sincronização.
- Criar uma interface nova para edição de recursos que o Editor.js atual não suporta.
- Reescrever todos os registros existentes antecipadamente.

## Decisions

### Um AST Lorekit pequeno, semântico e versionado será persistido

`LorekitDocument` terá um identificador de formato e versão, seguido por blocos semânticos: `heading`, `paragraph`, `list`, `quote`, `table` e `image`. Conteúdo inline será uma sequência tipada de texto e marcas (negrito, itálico, cor, marcador, link e menção); listas manterão estilo, início, estado de checklist e filhos; imagens manterão referência, legenda e opções de layout. Menções serão referências estruturadas de tabela, id e rótulo, e não âncoras HTML como fonte de verdade.

O formato não armazenará metadados transitórios do Editor.js, como tempo, versão da biblioteca ou dados de holder. HTML legado será analisado para as marcas e links permitidos; a saída para o Editor.js será gerada a partir do AST, com sanitização dos elementos e atributos suportados.

Alternativa considerada: manter `blocks` e somente adicionar uma versão ao JSON do Editor.js. Isso é uma migração superficial e manteria nomes, dados e limites dos plugins como contrato de persistência, sem resolver a troca futura de editor.

### Adaptadores serão a única fronteira com motores de edição

Uma abstração tipada de adaptador receberá e devolverá `LorekitDocument`, com uma implementação inicial para Editor.js. O componente Angular continuará a controlar ciclo de vida, upload de imagem, autosave e exportação, mas delegará carregamento e normalização ao adaptador. Seu output passará a ser `LorekitDocument`; os handlers existentes poderão continuar serializando o valor emitido.

O adaptador declarará as capacidades do editor. Quando um editor futuro não suportar um recurso, ele receberá uma representação de fallback não destrutiva, e a reconversão preservará o bloco canônico original. Essa regra torna possível introduzir outro editor sem expor seus tipos ao banco, à prévia ou às telas de entidade.

Alternativa considerada: expor métodos `toEditorJs` e `fromEditorJs` diretamente no componente. Isso reduziria o acoplamento imediato, porém instituiria Editor.js como segunda API central e exigiria alterar o componente e seus consumidores para cada novo editor.

### O leitor aceitará três formatos e a escrita será preguiçosa

Um codec de persistência detectará, nesta ordem, `LorekitDocument` válido, saída legada do Editor.js e texto puro. As duas últimas formas serão normalizadas em memória e só serão substituídas no próximo salvamento iniciado pela pessoa. Conteúdo JSON inválido seguirá o mesmo caminho seguro de texto puro.

Não haverá migração SQLite em massa: as colunas não mudam e regravar todos os campos acionaria uma quantidade desnecessária de alterações para sincronização. Como o leitor do novo app aceita os três formatos, rollback dentro da nova versão continua possível enquanto os registros legados existirem.

Alternativa considerada: migrar todos os dados no startup. Ela aumenta o risco de falha, gera conflitos e mudanças de sincronização em massa, e não traz benefício funcional para conteúdos que nunca forem abertos.

### Prévia e exportação usarão projeções do modelo canônico

O codec/projetor de documentos oferecerá conversões para blocos de prévia, texto puro e Markdown. O moodboard deixará de acessar `parsed.blocks` e as rotinas de exportação deixarão de consumir diretamente o retorno de `editor.save()`.

Alternativa considerada: manter as projeções específicas de Editor.js como ponte. Isso permitiria a primeira entrega, mas deixaria o moodboard e a exportação acoplados ao editor, anulando parte relevante da mudança.

## Risks / Trade-offs

- [HTML inline legado tem variações e conteúdo inesperado] -> Converter apenas elementos e atributos permitidos, preservar conteúdo textual e cobrir exemplos reais em testes de regressão.
- [Editor futuro suporta menos recursos que o documento canônico] -> Declarar capacidades, renderizar fallback controlado e preservar os nós originais ao salvar.
- [Versões antigas do aplicativo não entendem o novo formato sincronizado] -> Distribuir a versão leitora dos três formatos antes de depender de documentos recém-salvos em instalações atualizadas; documentar a compatibilidade mínima no release.
- [Conversões podem perder detalhes de plugins] -> Testes de ida e volta para cada bloco e marca atualmente suportados, incluindo menções e opções de imagem.
- [Autosave concorrente] -> Manter o mecanismo existente de revisão/flush do componente e tornar conversões puras e determinísticas.

## Migration Plan

1. Adicionar tipos, codec e adaptador Editor.js com testes unitários de documentos canônicos, legados e texto puro.
2. Integrar o adaptador ao `app-editor` para que novos salvamentos emitam o documento Lorekit.
3. Migrar prévia e exportação para projeções canônicas e testar todos os campos ricos e o moodboard.
4. Liberar sem migração global: registros legados permanecem legíveis e são atualizados individualmente ao salvar.
5. Em caso de regressão, restaurar o componente para leitura/escrita legada; o codec da versão nova permanece apto a ler os valores já migrados para permitir recuperação controlada.
