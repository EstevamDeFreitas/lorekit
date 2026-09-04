## Context

O componente `app-editor` é reutilizado por documentos, descrições de entidades e campos dinâmicos. O conteúdo é persistido como `LorekitDocument` versionado desde o middleware introduzido recentemente; `EditorJsAdapter` converte esse contrato para o formato do Editor.js. A especificação de portabilidade existente exige que consumidores de prévia e exportação permaneçam independentes do editor concreto.

## Goals / Non-Goals

**Goals:**

- Acrescentar Tiptap sem alterar a representação persistida, os fluxos de exportação ou as telas consumidoras de `app-editor`.
- Permitir uma preferência global previsível e reversível entre os dois editores.
- Manter paridade com todos os blocos e marcas atualmente representados pelo contrato canônico, incluindo menções, imagens e conteúdo com suporte parcial.
- Preservar o ciclo atual de salvamento pendente ao trocar a implementação do editor.

**Non-Goals:**

- Remover Editor.js ou converter em massa conteúdos legados.
- Armazenar JSON nativo do Tiptap, HTML do editor ou dependências de um editor no banco.
- Incluir colaboração em tempo real, revisão, IA, importação/exportação DOCX ou funcionalidades de edição sem representação no `LorekitDocument`.
- Alterar a semântica da prévia de moodboards ou das exportações existentes.

## Decisions

### Preservar `app-editor` como fachada estável

`EditorComponent` passa a atuar como orquestrador com a mesma API de inputs e output atuais. Ele resolve a preferência efetiva e hospeda uma implementação Editor.js ou Tiptap, encaminhando `document`, identificação da entidade e eventos de salvamento. Assim, os componentes chamadores não precisam ser reescritos.

Alternativas consideradas:

- Atualizar cada tela para escolher um editor: rejeitada por duplicar regra global em todos os consumidores e aumentar o risco de divergência.
- Substituir Editor.js diretamente: rejeitada porque elimina o caminho de retorno e impede comparar a experiência durante a adoção.

### Preferência persistida e aplicação em novas instâncias

Uma chave global restrita aos valores `editorjs` e `tiptap` definirá o motor ativo. Valor ausente ou inválido resolve para `editorjs`. Ao trocar a preferência, a configuração é salva imediatamente, mas instâncias existentes não são desmontadas automaticamente; a interface informa que a alteração será usada após reabrir o campo.

Essa decisão evita destruir uma instância com alterações pendentes. Uma evolução futura poderá oferecer troca imediata apenas depois de flush explícito e confirmação do usuário.

### Usar Tiptap Core com extensões explícitas e adaptador próprio

O Tiptap será integrado diretamente ao componente Angular por sua API de DOM, sem wrapper de framework. As dependências devem ser instaladas em versões compatíveis entre si e incluir apenas Core/ProseMirror e extensões necessárias para os recursos canônicos. Um `TiptapAdapter` fará a conversão bidirecional entre a árvore JSON do Tiptap e `LorekitDocument`.

Extensões explícitas evitam que um kit genérico introduza blocos que o contrato canônico não representa. O adaptador será a única fronteira entre o editor e os dados persistidos; ele não serializará `editor.getJSON()` diretamente.

Alternativas consideradas:

- Salvar o JSON nativo do Tiptap: rejeitada por vincular dados a uma biblioteca e invalidar a portabilidade recém-introduzida.
- Usar apenas um conjunto genérico de extensões: rejeitada porque marcas e nós adicionais poderiam ser perdidos na conversão.

### Modelar recursos exclusivos do Lorekit como extensões Tiptap

O Tiptap usará extensões/nós do Lorekit para representar dados que não correspondem diretamente a um nó padrão:

- `mention`: atributos de tabela, id e rótulo; o popup consulta `EntityMentionService` e a ativação abre a entidade pelo serviço existente.
- `lorekitImage`: URL, legenda e opções de layout; o NodeView reutiliza `ImageService` e a resolução de referências de imagens do Lorekit.
- `lorekitQuote`: conteúdo e legenda da citação.
- `unsupported`: bloco atômico e visível que retém fonte, tipo e dados originais sem permitir perda durante o salvamento.

Listas, tabelas e marcas padrão serão mapeadas somente na superfície representável pelo contrato canônico. Comandos de tabela que criem mesclas, atributos ou distinções de cabeçalho não representadas serão ocultados ou bloqueados até que uma versão futura do contrato os adicione.

### Salvamento e carregamento sem perda

As duas implementações emitem `LorekitDocument` pelo output existente. A implementação Tiptap acompanhará revisões de alteração e responderá aos eventos globais de flush/descarte de salvamentos, como o editor atual. Na carga, todo valor passa primeiro por `LorekitDocumentCodec.deserialize`, preservando a compatibilidade de conteúdo legado do Editor.js e texto simples.

## Risks / Trade-offs

- [Imagem, legenda e layout exigem NodeView próprio] → Construir testes de conversão e de interação antes de disponibilizar o seletor Tiptap.
- [Citações com legenda e blocos desconhecidos não existem como nós padrão] → Usar nós Lorekit que preservam integralmente os dados e os sinalizam visualmente.
- [Tiptap e Editor.js coexistem no pacote] → Manter Editor.js somente como implementação de compatibilidade e carregar a implementação Tiptap de forma adiada quando viável; medir o bundle de produção.
- [Troca da preferência pode coincidir com edição não salva] → Aplicar a mudança somente a novas instâncias e comunicar esse comportamento.
- [Conversões silenciosas podem causar perda de dados] → Cobrir todos os tipos de `LorekitDocument` com testes de ida e volta e bloquear recursos sem mapeamento canônico.

## Migration Plan

1. Adicionar dependências, adaptador e extensões Tiptap mantendo Editor.js intacto.
2. Introduzir a fachada de editor e a preferência global com padrão `editorjs`.
3. Validar conteúdo legado, novo conteúdo Tiptap e alternância entre os dois motores em cada tipo de campo rico.
4. Liberar Tiptap como opção; não executar migração de banco, pois os conteúdos existentes continuam sendo desserializados pelo codec.

Rollback consiste em selecionar Editor.js novamente. Como ambos persistem `LorekitDocument`, o conteúdo criado no Tiptap continua abrível pelo Editor.js para os recursos canônicos.
