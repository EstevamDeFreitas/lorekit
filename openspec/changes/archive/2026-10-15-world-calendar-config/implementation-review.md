# Revisão da implementação

Data: 2026-10-15. Mudança: world-calendar-config.

## Comparação com as telas existentes

A comparação de código utilizou as telas de espécie, vocações e ficha de personagem do Ironpaw, os estilos compartilhados de configuração do Ironpaw e os componentes app-input, app-button e app-nav-button. Os calendários mantêm a composição aprovada pelo usuário: seções à esquerda, formulário central e prévia à direita.

Os ajustes removem o fundo opaco independente do editor, adotam entity-properties-panel para herdar o tema glass do aplicativo, aproximam títulos e textos das proporções dos editores Ironpaw e usam as cores e os contornos dos controles existentes. A navegação de seções reutiliza app-nav-button. Os controles nativos de calendário compartilham calendar-controls.css para manter rótulos associados, formulários reativos e a mesma apresentação entre seletor, configuração e revisão. As quebras do editor usam a largura do contêiner da aba, inclusive quando o workspace é dividido.

Esta comparação não é evidência de revisão visual renderizada. A ferramenta de computador informa apps e browsers vazios; abrir Chrome retorna Browser is not available: chrome. A etapa 7.4 permanece pendente até um navegador estar acessível. Nenhuma captura foi produzida nem contabilizada como rodada de inspeção visual.

## Cobertura funcional

| Especificação | Implementação e evidência |
| --- | --- |
| world-calendars | Motor e contratos versionados; CRUD por mundo; revisões, nomes e exclusão protegida; testes de domínio, SQL, editor, lista, seletor e sync. |
| calendar-timelines | Plano sem mutações; cancelamento das quatro etapas; transação, falhas e repetição idempotente; troca e remoção de vínculo; datas parciais, escalas, amostragem por viewport, agrupamento e gravação de arraste. |
| calendar-date-fields | Campo no catálogo e renderer; configurações fixas por mundo ou selecionáveis; validação e preservação de valores; revisão transacional de impacto e estados de referência ausente. |
| field-layout-portability | Exportação v3 sem IDs locais ou valores; associação antes da comparação de campos; diferenças explícitas e conflitos; leitores v1/v2 e rejeição de versões futuras. |

O cenário integrado usa dois calendários no mesmo mundo, duas timelines compartilhando um deles, publicação de revisão e migração de apenas um vínculo, evento, marco, campo dinâmico e exportação/reabertura do banco offline. O teste de sync exercita o motor real com API simulada, recepção fora de ordem, revisões concorrentes com identidades distintas e envio de alterações locais ao reativar sync. Não acessa contas nem nuvem reais.

A repetição após erro de gravação preserva a identidade dos calendários, revisões, contagens e acontecimentos. A alteração de contagem no seletor recalcula os rótulos de ano sem mover a data canônica. A duração terrestre aparece na prévia, incluindo 30 horas locais/36 horas terrestres equivalentes a 72 minutos terrestres por hora local.

## Documentação e limites

As instruções de uso estão em docs/world-calendars.md e docs/calendar-layout-portability.md. O servidor utiliza o schema genérico de registros JSON da sincronização; as novas entidades são adicionadas à allowlist, sem migração de tabelas físicas de calendário no PostgreSQL.

Continuam excluídos anos bissextos, dias intercalares, ciclos lunares, feriados e equivalência automática entre calendários. Não houve deploy nem alteração de banco pessoal. A migração local é aditiva e não ativa calendários em timelines existentes.

## Verificação

Os resultados consolidados de testes e build são registrados abaixo após a execução. A inspeção manual de teclado, contraste e textos longos nos dois tamanhos de viewport está pendente, junto à comparação visual lado a lado com as telas citadas.


### Resultados registrados

- Frontend, execução consolidada das suítes relevantes de calendário e regressão: **102/102 passaram** em ChromeHeadless, pelo runner Angular.
- Após o ajuste de agrupamento de intervalos que começam fora da viewport: **4/4 testes de interação da timeline passaram**, incluindo o novo cenário. Três desses testes também pertencem à execução consolidada anterior.
- Servidor: **6/6 testes passaram** nas suítes calendar-sync e sync-clock. Typecheck do servidor passou.
- Build de produção Angular: **passou**. Permanecem avisos existentes de Sass, dependência CommonJS de sql.js e orçamentos de estilos de outras superfícies; nenhum aviso novo de orçamento dos calendários foi identificado.
- OpenSpec: validação estrita da mudança passou. git diff --check passou.
- Progresso: **44/45 tarefas concluídas**. Única pendência: **7.4, inspeção visual renderizada**. A comparação dos componentes no código não foi usada para marcar essa inspeção como concluída.


## Refinamento posterior: formatos ordenáveis e condicionais

O pedido adicional foi implementado no montador de formatos: controles de subir/descer para todas as partes e um editor compartilhado de textos condicionais. As regras usam comparações numéricas declarativas, E/OU e resultado para informação desconhecida; não executam código. A ordem e os textos acompanham a exportação/importação de layouts. Formatos anteriores permanecem válidos.

Verificação desta extensão: **69/69 testes relevantes passaram**, incluindo interação do editor, dia 12/13, alteração do operador para incluir o limite, horário ausente, precisão anual, calendário sem meses, combinação de regras, rejeição de operadores inválidos e portabilidade. O build de produção passou. A implementação passou a **49/50 tarefas concluídas**; a tarefa 7.4 de inspeção visual renderizada permanece pendente conforme registrado acima.


## Correção posterior: campo dinâmico compacto e gravação

O formulário expandido estava dentro de config-grid-item com altura limitada e overflow hidden. Escolher um calendário apenas habilitava esse formulário; os controles de data e confirmação podiam ficar recortados. O campo passou a usar input compacto, botão lateral embutido e ConnectedOverlay global, comparado à implementação de ComboBox. O painel usa limite de viewport, scrollbar-dark, foco protegido e reposicionamento quando seu conteúdo cresce.

A confirmação validada descarrega o debounce de gravação dos campos. O percurso renderizado foi exercitado com SQLite real, incluindo escolha de outro calendário, clique em Usar data, consulta do valor, exportação/reabertura do banco e renderização do valor salvo. Também foram verificados célula de uma linha com 220px de largura, overlay fora do elemento recortado, Escape, cancelamento sem alterações, data inválida, calendário fixo, precisão anual, limpeza e referência ausente.

Resultado: **18/18 testes relevantes passaram** e o **build de produção passou**. Progresso atualizado: **52/53 tarefas concluídas**, com a inspeção visual 7.4 ainda pendente; a ferramenta continua sem navegador ou janela acessível. Nenhum banco pessoal foi alterado pelos testes.


## Arquivamento aprovado

Em 2026-10-15, o usuário aprovou a funcionalidade e autorizou arquivar world-calendar-config. O arquivo preserva 52 de 53 tarefas concluídas: a inspeção visual automatizada 7.4 permanece registrada como não realizada, sem ser substituída pelo aceite funcional.

As quatro especificações foram sincronizadas com as principais e validadas individualmente em modo estrito; todos os 29 requisitos da change estão presentes e os requisitos anteriores de field-layout-portability foram preservados. A change também passou na validação estrita.

A validação global de specs encontrou três erros preexistentes, em ironpaw-content-portability, ironpaw-inventory-equipment e ironpaw-item-catalog, por ausência da seção Requirements. Os três arquivos foram comparados com HEAD, estão inalterados e já apresentavam esses erros. Esses arquivos não foram modificados neste arquivamento.
