## Context

Ver `proposal.md` para a motivação e `specs/entity-edit-history/spec.md` para o contrato de comportamento. Esta mudança atravessa componentes, serviços de persistência e navegação, justificando este design.

- `EditorComponent` escolhe Editor.js ou Tiptap, transforma dados via adaptadores e emite o documento canônico após 600 ms sem alterações. Sua destruição salva alterações pendentes e destrói o editor. A configuração atual de extensões Tiptap não registra histórico.
- `WorkspacePaneComponent` monta somente a aba ativa e o F5 interno remonta componentes. O histórico não pode depender da vida dessas instâncias.
- `EntityConfiguredFieldsComponent` concentra textos nativos e personalizados; campos dinâmicos têm persistência própria. Existem também títulos e editores diretamente nas páginas.
- O identificador passado a um editor nem sempre é o identificador da entidade proprietária: há campos dinâmicos que passam o ID do valor e um campo de objeto que usa sufixo `_history`.
- `TabManagerService` já conhece painel focado e aba ativa. O painel atualmente observa `mousedown`; acesso por teclado exige também atualização de foco.
- A barra com `app-search` está em `app.component.html`, na região superior arrastável do Electron. Os botões precisam de `no-drag` e layout responsivo.
- Há saves em camadas: editor, página e campos dinâmicos, além do fluxo global de flush/discard e da sincronização externa.

## Goals / Non-Goals

**Goals:**

- Separar armazenamento do histórico, contexto de navegação, captura de edição e aplicação/persistência de um campo.
- Usar uma única autoridade para ordenar etapas entre os diferentes controles de uma entidade.
- Restaurar somente o campo alterado, com suporte a campos temporariamente desmontados e documentos canônicos.

**Non-Goals:**

- Serializar histórico no banco, sincronizá-lo entre dispositivos ou manter instâncias de editor vivas para reter histórico.
- Implementar undo genérico de SQL, restauração integral de entidades ou histórico de operações estruturais do aplicativo.
- Alterar arquivos de imagem ao desfazer uma referência contida em texto rico.

## Decisions

### 1. Serviço de sessão com chaves explícitas e valores imutáveis

Criar um serviço Angular singleton com histórico por `(workspaceSessionId, entityTable, entityId)`. Normalizar nomes de tipos da navegação para as tabelas de domínio; não usar o ID da aba como identidade. Cada etapa referencia um campo estável: chave de schema para nativos, ID do template para personalizados. Títulos traduzidos, IDs DOM e IDs usados por upload não identificam histórico.

Uma etapa contém chave e rótulo do campo, valor anterior e posterior, tipo de edição, ordem e metadados opcionais de seleção. Texto simples usa string e texto rico usa o documento Lorekit imutável. Manter sequência e cursor, com disponibilidade de undo/redo derivada por signals. Registrar apenas diferenças semânticas, ignorando timestamps transitórios de serialização. Reutilizar snapshots imutáveis adjacentes e agrupar digitação para reduzir memória; não guardar blobs nem referências a componentes desmontados.

Alternativas: snapshots da entidade inteira poderiam restaurar campos não envolvidos e relações antigas; capturar todo UPDATE do banco misturaria saves, sincronização e ações externas. Histórico local de cada editor não preservaria ordem entre campos nem a continuidade das abas.

### 2. Captura separada do autosave e agrupamento comum

Capturar intenção e ordem de edição antes do debounce de persistência, inclusive em títulos hoje salvos por blur. Usar 600 ms de inatividade como valor inicial de agrupamento de digitação no mesmo campo; separar troca de campo/contexto, colagem, formatação, blur e comandos de histórico. Concluir a composição antes de fechar uma etapa. Operações equivalentes não geram entradas.

No Editor.js, reservar a ordem quando a alteração for observada e serializar a captura assíncrona; nunca ordenar etapas pela conclusão de `editor.save()`. No Tiptap, observar as transações de edição e classificá-las antes da conversão canônica. Capturas em andamento devem ser concluídas antes de restaurar ou desmontar o contexto. Carregamento, sincronização e restauração recebem origem distinta de edição local.

Alternativas: registrar apenas `saveDocument` ou `requestSave` perderia limites de colagem/formatação e permitiria uma captura atrasada entrar depois de uma edição em outro campo. Registrar uma etapa por tecla seria oneroso e pouco útil.

### 3. Adaptadores de campo e restauração independente de visibilidade

Adicionar contexto de histórico separado dos inputs legados de upload do editor: entidade proprietária, chave estável e rótulo do campo. Integrar inputs/textareas por contrato opt-in ou diretiva, sem fazer todo campo reutilizável pertencer automaticamente à entidade ativa. Passar o contexto pelos campos configurados e pelas páginas com títulos/editores diretos.

Cada contexto de entidade fornece leitura e aplicação/persistência dos campos suportados mesmo quando o controle não está montado. Os adaptadores reutilizam serviços de domínio e de campos dinâmicos, atualizando somente o campo alvo sobre o estado atual. As visualizações montadas observam a restauração; ao reaparecer, um campo lê o valor atual. Não reter callbacks de componentes destruídos no serviço de sessão.

Para textos ricos, restaurar via adaptador canônico na instância ativa, sem registrar a atualização programática. Preservar seleção quando ela ainda puder ser mapeada; caso contrário, posicionar o cursor de modo válido. Não depender de `document` como valor inicial apenas: o contrato precisa aplicar explicitamente restaurações após a inicialização.

O levantamento de integração inclui as páginas de entidades, documentos, campos configurados e textos diretamente editáveis em timelines, moodboards e fichas. Formulários de criação/configuração ficam fora do contexto. Quando uma tela edita uma subentidade existente, resolver sua identidade proprietária real, sem atribuir o texto automaticamente à entidade que hospeda a tela.

Alternativa: limitar a aplicação ao campo montado quebraria o undo entre seções e o histórico ao reabrir entidades.

### 4. Um caminho de comando para atalhos e botões

Resolver a entidade no painel ativo e no contexto explícito de edição. Atualizar foco por mouse e `focusin`, incluindo navegação por teclado. Pesquisa, filtros, formulários externos e modais sem contexto de entidade bloqueiam o encaminhamento global. A barra superior mantém o último alvo elegível do painel ao receber foco; os botões não dependem de `document.activeElement` continuar sendo o editor.

Encaminhar Ctrl+Z e Ctrl+Y para o serviço antes de qualquer tratamento local concorrente em um campo participante; consumir o atalho reconhecido mesmo quando a pilha estiver vazia, evitando um fallback nativo que diverge da sequência. Fora desse contexto, não interceptar o campo. Tratar eventos de entrada de histórico, quando emitidos pelo navegador, sem duplicar o comando de teclado e respeitar composição em andamento.

Não instalar um histórico independente no Tiptap ou Editor.js em paralelo ao histórico da entidade. Os adaptadores de conteúdo e a coordenação central fornecem o comportamento acordado. Isso também permite compartilhar a sequência ao reabrir o campo com outro motor.

Botões exibem rótulos acessíveis, dicas da etapa e estados derivados da mesma fonte, com bloqueio durante restauração. Inserir antes de `app-search`, garantindo `no-drag`, foco visível e espaço para pesquisa e ações já presentes no layout estreito.

Alternativa: usar undo nativo dentro do campo e histórico global fora dele produziria resultados diferentes para o mesmo comando conforme o foco, contrariando a decisão do usuário.

### 5. Restauração serializada e proteção de saves pendentes

O comando adquire um bloqueio por entidade, conclui capturas e fecha o grupo atual. Coordena o flush dos saves anteriores antes de aplicar a restauração e invalida callbacks antigos por revisão/origem; callbacks novos não podem reintroduzir conteúdo anterior. O alvo e sua revisão são fixados no início do comando.

Depois, verifica se o valor atual do campo coincide com a base esperada, aplica o snapshot ao estado atual da entidade e aos controles montados e persiste pelo caminho normal com origem de restauração. Só avança o cursor após sucesso da aplicação/persistência local. Sincronização posterior segue o mecanismo normal de edição. Em falha, mantém o cursor, reconcilia visualização e estado local e informa o erro; não mascara uma falha parcial como sucesso.

Aplicação, revisão e fila de capturas devem impedir que `ngOnDestroy`, debounce de página ou `editor.save()` atrasado recoloquem texto desfeito. O flush existente pode ser reaproveitado, mas a ordem entre camadas precisa ser garantida explicitamente.

Alternativa: apenas atribuir um snapshot na interface deixaria o conteúdo salvo divergente e permitiria corridas com timers existentes.

### 6. Ciclo de vida e invalidação externa

Troca/fechamento de aba e F5 interno desregistram controles sem apagar as etapas. Encerramento/troca de workspace, logout que encerra o workspace e recarga completa descartam a sessão. Excluir entidade remove seu histórico.

Alterações provenientes de sincronização/importação/recuperação não entram na sequência local. Ao divergir da base esperada, invalidar o histórico da entidade e avisar. Validar a base também ao reabrir ou executar um comando, para cobrir mudanças ocorridas sem componente montado. Um eco de sincronização semanticamente idêntico não invalida o histórico. Se um campo deixar de existir, invalidar a sequência incompatível sem recriar configuração removida.

Alternativa: reaplicar etapas cegamente poderia sobrescrever conteúdo externo. Fazer rebase colaborativo do histórico seria uma capacidade adicional fora desta change.

## Risks / Trade-offs

- Captura assíncrona pode alterar a ordem entre campos → reservar ordem antes da serialização e testar digitação seguida de navegação/desfazer imediato.
- Documentos extensos podem consumir memória → snapshots somente do campo, compartilhamento imutável, agrupamento e medição com conteúdo grande; evitar cópias da entidade inteira e blobs.
- Diferenças de representação entre editores podem parecer edições → comparação canônica que ignore metadados transitórios e testes com blocos preservados.
- Salvamento de entidade completa pode carregar dados antigos → aplicar o campo sobre o estado atual e testar que campos e relações não envolvidos permanecem intactos.
- Desfazer pode atingir campo oculto → dica identifica o campo e o valor restaurado deve aparecer ao abrir sua seção, sem exigir montagem permanente.
- Invalidação por alteração externa perde etapas locais → informar o motivo; preservar dados atuais tem prioridade sobre executar uma sequência incompatível.

## Migration Plan

Não há migração de schema ou dados. Implementar serviço e adaptadores, integrar os contextos textuais e só então habilitar atalhos e botões sobre a mesma fonte de estado. Validar os cenários antes de disponibilizar a interface.

O rollback remove a integração e seus controles; o conteúdo continua no formato canônico existente e o histórico em memória é descartado ao reiniciar. Nenhum arquivo de dados precisa ser convertido.
