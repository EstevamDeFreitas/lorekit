## 1. Identidade e histórico de sessão

- [x] 1.1 Definir os contratos de entidade proprietária, campo, etapa e origem de atualização e mapear os pontos textuais das páginas, campos configurados, timelines, moodboards e fichas; verificar o inventário contra os controles existentes, incluindo títulos, subentidades e IDs de editor com sufixos ou IDs de valores dinâmicos.
- [x] 1.2 Implementar o serviço de histórico com sequência/cursor por sessão e entidade, valores imutáveis e estados derivados; verificar com testes de desfazer nome e descrição, isolamento entre entidades e descarte de redo após nova edição.
- [x] 1.3 Implementar agrupamento de digitação, limites de colagem/formatação/composição e reserva de ordem para capturas assíncronas; verificar com testes usando timers controlados e capturas concluídas fora de ordem.

## 2. Captura e aplicação dos campos

- [x] 2.1 Integrar captura opt-in aos inputs, textareas e títulos, antes do autosave/blur; verificar que editar dois campos produz a ordem correta e que pesquisa, filtros e formulários de configuração não registram etapas da entidade.
- [x] 2.2 Integrar os campos nativos e textuais personalizados ao contexto da entidade proprietária; verificar restauração de valores personalizados distintos e ausência de colisões entre campos/entidades.
- [x] 2.3 Criar adaptadores de leitura/aplicação/persistência por campo e integrar as páginas do inventário; verificar que um campo oculto pode ser desfeito e que nenhum campo ou relacionamento não envolvido retorna a um valor antigo.
- [x] 2.4 Integrar captura canônica e aplicação explícita no Editor.js, com origem de restauração e coordenação assíncrona; verificar colagem, formatação, blocos, menções, referências de imagens e ausência de etapas geradas pelo carregamento/restauração.
- [x] 2.5 Integrar captura e aplicação canônica no Tiptap usando a mesma sequência central; verificar os mesmos cenários ricos e desfazer após reabrir o campo com o outro editor, sem perder dados canônicos preserváveis.

## 3. Salvamento e ciclo de vida

- [x] 3.1 Coordenar comandos, filas de captura e saves de editor/página/campos dinâmicos por revisão e origem; verificar com testes de desfazer antes do debounce e conclusão tardia de save, inclusive com desmontagem de componente.
- [x] 3.2 Implementar bloqueio por entidade e atualização do cursor somente após aplicação/persistência local bem-sucedida, com reconciliação em falha; verificar falhas injetadas e comandos repetidos sem execução dupla ou estado salvo divergente.
- [x] 3.3 Manter etapas ao trocar/fechar/reabrir abas e usar F5 interno, desregistrando apenas controles destruídos; verificar a continuidade do histórico e ausência de callbacks para componentes desmontados.
- [x] 3.4 Limpar histórico ao encerrar/trocar workspace e excluir entidade, e invalidar com aviso alterações externas incompatíveis; verificar sincronização divergente, eco idêntico, importação/recuperação, remoção de campo e nova sessão sem reutilização de etapas antigas.

## 4. Atalhos e barra superior

- [x] 4.1 Resolver contexto ativo por painel e entidade/subentidade, acompanhando mouse e foco por teclado e isolando modais externos; verificar dois painéis e foco na pesquisa/configurações sem alterar a entidade ao fundo.
- [x] 4.2 Encaminhar Ctrl+Z/Ctrl+Y e eventos de entrada de histórico para um único caminho de comando, respeitando composição e impedindo fallback local concorrente; verificar um único desfazer por acionamento em input, textarea, Editor.js e Tiptap, inclusive com pilha vazia.
- [x] 4.3 Adicionar Desfazer e Refazer antes da pesquisa com disponibilidade, dicas de campo/atalho, nomes acessíveis e região `no-drag`; verificar equivalência com atalhos, alvo preservado ao clicar e navegação por teclado.

## 5. Validação integrada

- [x] 5.1 Executar os testes afetados com `npm.cmd test -- --watch=false --browsers=ChromeHeadless` no frontend e os builds `npm.cmd run build` e `npm.cmd run build:web`; concluir com comandos sem falhas e registrar os resultados.
- [x] 5.2 Validar no desktop e na web o fluxo nome → descrição → desfazer duas vezes → refazer duas vezes, alternando botões e atalhos; verificar ambos os editores, campos personalizados, campos ocultos, reabertura/F5 interno e conteúdo persistido.
- [x] 5.3 Verificar visualmente a barra em desktop e viewport estreito, foco e dicas acessíveis, e exercitar documento grande durante trocas repetidas de abas; registrar que os controles permanecem utilizáveis e que não há perda de conteúdo nem retenção de instâncias de editor desmontadas.
