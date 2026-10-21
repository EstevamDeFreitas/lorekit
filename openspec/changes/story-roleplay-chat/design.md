## Context

Ver `proposal.md` para motivação e as cinco delta specs para o contrato observável.

O frontend Angular 20 roda no Electron e no navegador, com SQLite/sql.js e sincronização opcional. `SyncEngineService` usa debounce de 15 segundos e consulta periódica de 30 segundos. O servidor NestJS/Fastify usa PostgreSQL/Drizzle, autorização por `vault_members` e blobs sob `/vaults/:vaultId/blobs`. Essa autorização não atende convidados que acessam apenas uma História.

`workspaceGuard` inicializa o workspace web e `WorkspaceRuntimeService` espera um cofre da conta; o acesso à História precisa de uma entrada autenticada independente. As rolagens atuais estão principalmente no componente de ficha Ironpaw, com resultados de interface que não constituem histórico colaborativo. O Gerenciador de Conteúdo possui itens e moedas; PNJs são um domínio novo.

A implantação versionada usa uma API, PostgreSQL e Caddy na VPS. A CSP web autoriza HTTPS da API, mas não explicita WSS. Não foram encontrados gateway WebSocket, service worker de push ou notificações nativas no fluxo principal. No Windows, fechar todas as janelas encerra o processo Electron.

## Goals / Non-Goals

**Goals:**
- Separar autorização, histórico e cache de Histórias da sincronização genérica de cofres.
- Manter um resultado único e uma ordem verificável para cada operação confirmada.
- Compartilhar somente projeções aprovadas de identidade visual e mecânica, com revisões preservadas.
- Reutilizar regras Ironpaw sem dependência de Angular/Electron no motor e sem regressão da ficha local.
- Permitir evolução incremental do servidor existente e validação em homologação.

**Non-Goals:**
- Fila de comandos offline, edição simultânea de documentos, CRDT ou sincronização de rascunhos.
- Automação de dano, condições, recursos, iniciativa ou turnos; atualização da ficha pelo chat.
- IA ou sorteio para gerar PNJs, interpretação automática de prosa como regras, importação/exportação de pacotes de PNJs nesta entrega.
- Mensagens privadas, espectadores, cargos de mestre, permissão por personagem, edição/exclusão/reordenação do histórico e exclusão definitiva de Histórias. A primeira versão publica mensagens imutáveis; correções são novas mensagens.
- Imagens públicas, ZIP autossuficiente ou notificações com Electron encerrado. Presença e indicador de digitação não são necessários para o contrato.

## Decisions

### 1. Domínio colaborativo próprio, acessível sem montar o cofre

Criar módulos de Histórias, acesso, anexos, eventos e notificações no servidor. A História pertence a um proprietário administrativo (`owner_user_id`), não a um cofre como fronteira de autorização. Um vínculo opcional ao mundo/cofre é referência privada para a origem, nunca propagado como licença de leitura.

No frontend, oferecer Histórias como uma aba do shell existente, compartilhando a navegação, os painéis e o ciclo de vida das demais abas. As rotas autenticadas de acesso direto, convite e anexo abrem essa mesma aba, sem executar a inicialização/sincronização do cofre de origem. A troca entre rotas de Histórias e worldbuilding preserva o shell e os editores abertos; rascunhos do RP permanecem na aba e abas inativas não enviam recibos de visibilidade/leitura. O usuário pode continuar usando seu próprio workspace; a tela RP não depende dele para listar convites, ler ou escrever. Antes de carregar o workspace próprio, somente a navegação independente de Histórias fica ativa; quando ele é aberto explicitamente, restaurar suas abas sem descartar a aba RP. Guards de cache devem permitir consulta offline da conta previamente identificada sem permitir publicação com credenciais expiradas. Sem conta identificada, não abrir cache de outra conta.

Alternativa rejeitada: adicionar mensagens às entidades genéricas do sync. Isso herdaria a autorização ampla por cofre, resolução por relógios e latência inadequadas para chat.

### 2. Modelo persistente e revisões

Tabelas propostas no PostgreSQL, com nomes concretos adaptáveis às convenções Drizzle:

| Entidade | Responsabilidade |
| --- | --- |
| `stories` | Título, proprietário, próxima sequência de eventos, datas |
| `story_members` | História, usuário, papel owner/participant, cursor e intervalos de mensagens vistas, preferências |
| `story_invites` | Hash de token, emissor, expiração, consumo e cancelamento |
| `story_scenes` | História, título, posição de criação estável |
| `story_speakers` | Identidade da História ou da cena, tipo character/npc/incidental, revisão atual |
| `story_speaker_revisions` | Nome/cor/retrato e projeção mecânica aprovados, imutáveis e versionados |
| `story_messages` | História, cena, sequência, autor usuário, revisão de locutor, texto ou rolagem, data do servidor |
| `story_assets` | Dono História, objeto físico, tipo/tamanho/hash, estado pending/ready, vínculo de uso |
| `story_message_assets` | Ordem dos anexos de cada mensagem |
| `story_operations` | Chave de idempotência, autor, hash do pedido, resultado persistido |
| `story_events` | Eventos duráveis para replay, despacho WebSocket e fila de notificações |
| `story_push_subscriptions` | Conta, instalação, endpoint e chaves push, estado e último erro |
| `story_notification_deliveries` | Evento/instalação/canal e situação de entrega |

Usar chaves estrangeiras compostas ou validação transacional equivalente para impedir referência a cena, locutor, anexo ou mensagem de outra História. Revisões e mensagens antigas mantêm sua identidade visual; recursos referenciados não são removidos ao atualizar retratos ou arquivar modelos.

O catálogo local usa `IRPWNpc` com definição JSON tipada/versionada, arquivamento e identidade própria, registrado nos dois contratos de sync. Histórias e seu cache não entram em `_SyncOutbox`. A versão do contrato anuncia `IRPWNpc` e clientes antigos continuam sincronizando tipos conhecidos; cliente novo não envia o tipo a servidor que não anuncia suporte.

### 3. Convites e compartilhamento explícito

Usar link com token aleatório de uso único, expiração inicial de sete dias e armazenamento somente do hash. Aceitação exige autenticação e transação que consuma o convite uma vez; remover o token da navegação após a aceitação. Não registrar token ou URL completa em logs. O link é um convite para quem o possui, não um acesso anônimo ao conteúdo. A emissão, cancelamento e remoção de membros ficam com o proprietário; todos os participantes narram igualmente.

Cada participante com acesso de leitura e escrita ao conteúdo de origem pode publicar uma projeção. A prévia mostra os campos efetivamente expostos. O adaptador constrói uma allowlist: nome, retrato, cor, atributos/perícias/percepções, condições e atalhos/equipamentos/habilidades necessários às ações escolhidas. Biografia, notas privadas, carteira e relações do mundo não são serializadas implicitamente. Descrições necessárias de uma ação são visíveis na prévia, porque também podem conter informação privada.

Dados locais são explicitamente publicados pelo usuário autenticado, sem o servidor resolver referências arbitrárias a cofres. Quando for necessário ler dados já remotos, verificar a autorização de origem antes da cópia. Todo upload gera um recurso da História. Não reutilizar URLs privadas de blobs do cofre como acesso para convidados. Manter origem e usuário publicador como metadados internos; somente o publicador ainda autorizado na origem ou o proprietário autorizado na origem pode atualizar essa projeção. Todos continuam podendo usá-la para narrar e rolar.

Alternativa rejeitada: acessar a ficha original ao executar a rolagem. Isso exige autorização no cofre e faz a reprodução histórica depender de dados mutáveis.

### 4. HTTP para comandos e histórico; WebSocket para eventos

Usar gateway NestJS com Socket.IO, transporte WebSocket e salas por História, no mesmo serviço da API. Escolha reduz trabalho de reconexão e salas; comandos continuam HTTP para evitar qualquer buffer automático de comandos do transporte. A integração oficial oferece esse adaptador: [NestJS Gateways](https://docs.nestjs.com/websockets/gateways).

Contrato de rotas proposto:
- `/stories`: listar/criar; `/stories/:id`: consultar metadados.
- `/stories/:id/scenes` e `/speakers`: criar/listar; atualização restrita de título e criação de revisão de locutor.
- `/stories/:id/invites`, `/members`, `/leave` e `/story-invites/accept`: administrar/aceitar acesso.
- `/stories/:id/messages`: enviar e paginar por sequência; `/events?after=...`: recuperar eventos.
- `/stories/:id/operations/:operationId`: reconciliar resultado incerto; `/rolls`: executar/publicar uma rolagem.
- `/stories/:id/assets`: reservar, enviar, finalizar e recuperar anexos autorizados.
- `/stories/:id/read-position`, `/notification-preferences`, `/export.md`: leitura, preferências e exportação.
- `/stories/realtime-ticket` e `/story-push-subscriptions`: conexão e assinatura autenticadas.

Cada comando tem `operationId` UUID criado durante a ação online. Em transação, o servidor verifica sessão e participação, serializa a alocação de sequência por História com bloqueio de linha, grava o resultado, a operação e o evento e só então confirma. A chave de idempotência inclui História, autor e operação; o hash normalizado do pedido impede reutilização com conteúdo diferente. O cliente não define autor, resultado, posição ou data de confirmação.

Reverificar a operação depois de obter o bloqueio e antes de sortear dados ou inserir mensagens, inclusive em tentativas concorrentes. Preservar mensagens, revisões e metadados de idempotência durante a vida do histórico; não aplicar expiração de operações que permita duplicar um envio antigo. Eventos podem ser compactados somente quando houver recuperação equivalente por snapshot e cursor explícito, sem descartar mensagens do RP.

Um worker dentro da API despacha eventos persistidos após commit e recupera pendentes após reinício. Eventos têm identidade estável; os clientes reconciliam por ID/seq. Garantias não dependem de entrega única do Socket.IO, que por padrão não oferece replay durável: [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/). Registrar cursor somente após persistência local completa do lote. Histórico usa páginas limitadas; cena e sequência mantêm a ordem narrativa.

Conectar com ticket curto, de uso único e vinculado à sessão, emitido por HTTP autenticado e apresentado no payload de autenticação, sem bearer em URL. Validar origem e expiração, autorizar cada entrada em sala e revalidar sessão/participação no despacho. Expiração exige reconexão autenticada; logout, invalidação de sessão e revogação encerram o acesso. Eventos de remoção invalidam salas, assinaturas e cache. O dispatcher consulta destinatários atuais, inclusive ao processar filas antigas.

Se o canal cair, mostrar estado degradado, consultar eventos por HTTP e reabrir a conexão com backoff. Envio pode continuar quando a API autenticada está alcançável; `navigator.onLine` sozinho não prova conexão. Em timeout, manter somente a identidade de uma operação já iniciada online para consultar seu resultado. Não repetir automaticamente um comando que possa ainda não existir; uma tentativa manual online com a mesma identidade é idempotente. Reconectar nunca publica o texto do compositor.

Alternativas: SSE atenderia notificações unidirecionais, mas requer tratamento próprio de autenticação e reconexão; polling puro não oferece entrega imediata. Redis não é necessário com uma instância; múltiplas APIs exigirão despacho distribuído/adaptador antes de escalar horizontalmente.

### 5. Composição, imagens e cache offline

Manter conteúdo textual em um subconjunto Markdown fechado: parágrafos, quebras, negrito, itálico e citação; desabilitar HTML e esquemas de URL perigosos. O mesmo parser/serializador governa prévia, leitura e exportação. Não reutilizar o editor de documentos completo. Primeiros limites configuráveis: 20 mil caracteres por mensagem, quatro imagens raster JPEG/PNG/WebP e 10 MiB por arquivo; validar tipo real, dimensões e orçamento de pixels no servidor, não apenas extensão. Confirmar limites na interface.

Upload possui estado pending com prazo de limpeza; só publicar quando todos os anexos estiverem prontos e autorizados. Reaproveitar os mecanismos físicos de armazenamento/hash existentes, mantendo metadados e autorização por História e sem vincular a exclusão à vida do blob original do cofre. Mensagens preservam anexos na ordem do envio. Falhas de upload não publicam texto isoladamente e recursos órfãos expiram, sem apagar referências existentes.

Criar armazenamento de Histórias separado por conta: SQLite/sql.js próprio no desktop e persistência no navegador reaproveitando os adaptadores existentes. Não usar o `DbProvider` do cofre como dependência da tela. Tabelas de cache guardam dados confirmados, cursores, intervalos de histórico conhecidos e manifesto de recursos locais. Deduplicar lote e cursor na mesma transação. Uma falha de quota não deve perder o cursor anterior nem marcar o cache como completo. A consulta online continua possível com aviso de que o novo conteúdo não foi guardado offline.

Desktop persiste em caminho por conta no userData via IPC restrito; web isola banco e recursos por conta em IndexedDB/armazenamento privado equivalente. Logout remove bancos, imagens, URLs de objetos e estado do worker daquela conta. Revogação conhecida remove somente a História correspondente. Não prometer apagar dispositivos que permanecem offline. Expiração do token impede mutações mas não apaga automaticamente o histórico consultável da mesma conta. Abrir o app web offline também requer cache mínimo do shell; o service worker armazena assets versionados do shell, nunca respostas autenticadas genericamente.

### 6. Motor Ironpaw compartilhado e rolagem autoritativa

Extrair fórmula, modificadores, condições e resolução para um pequeno pacote TypeScript puro, consumido por Angular e NestJS, com builds incluídos no Docker e no empacotamento frontend. O motor recebe dados tipados e uma fonte de dados aleatórios injetável. Adaptadores mantêm as entradas e a interface atuais da ficha; o chat usa somente a revisão explicitamente publicada. Não transportar componentes Angular ao backend.

Na ficha local, preservar execução offline. No chat, a API valida ação e ajustes, calcula a fórmula a partir da revisão persistida e usa aleatoriedade do servidor; dados de resultado enviados pelo cliente são rejeitados. Gravar o resultado completo e a mensagem na mesma transação idempotente. Uma revisão desatualizada no pedido exige nova prévia antes de executar, em vez de trocar silenciosamente os parâmetros. Limitar dados/tamanhos de entrada e frequência por conta/História.

Ataques e defesas usam `targetSpeakerId` e `relatedRollMessageId` opcionais da mesma História. O registro pode explicar uma oposição; não há bloqueio de turnos nem mutação de ficha, cópia mecânica ou inventário. Sem alvo/dificuldade/oposição resolvida, apresentar valor numérico sem declarar um desfecho inventado.

### 7. PNJs seguem fórmulas normativas do manual

Fonte: `docs/Sistema Ironpaw.md`, seção PNJs e Inimigos. Implementar tabelas de NA, `CV=2*NA`, `CR=NA` com proteção explícita, ajustes independentes entre -5 e +5, teto de 4d10, até quatro ações básicas e severidade máxima por NA. Sem proteção, CR permanece zero; valores finais não podem ser negativos. Sem NA, permitir cadastro narrativo e bloquear execução mecânica até completar dados.

Tags têm tipo, descrição e modificadores estruturados opcionais com contexto. A escolha explícita de no máximo uma competência numérica evita acumulação automática; propriedades, gatilhos e resistências de texto não executam efeitos. Assinaturas não têm limite universal de quantidade ou recarga. Copiar um PNJ do catálogo cria revisão independente para a cena; nunca criar `Character` automaticamente.

O texto cita quatro atributos implícitos, mas sua tabela inclui Percepção; usar os cinco nomes expressos na tabela para permitir as ações descritas, sem criar atributos numéricos completos. Exemplos de CR divergem da fórmula em alguns pontos; o construtor aplica a fórmula normativa e representa diferenças como ajuste explícito, em vez de copiar exemplos como regra.

### 8. Exportação consistente e notificações por instalação

Exportação captura sequência máxima, títulos e ordem das cenas em um recorte consistente; percorre mensagens imutáveis até esse limite e gera Markdown com memória limitada. Novos envios não alteram o arquivo em geração. O cache registra cobertura de páginas até esse limite, permitindo provar completude para exportação offline. Links de imagem apontam à rota web de visualização autenticada do anexo, com legenda e aviso de dependência de conexão; não usar bearer, URLs assinadas duradouras ou `file://`. O exportador escapa nomes/títulos para não quebrar a estrutura Markdown.

Guardar leitura por participante com cursor monotônico e intervalos compactados de mensagens efetivamente vistas acima dele, além das preferências por História. Mesclar recibos de dispositivos como união de intervalos; avançar o cursor apenas quando não houver mensagens anteriores ainda não vistas. Isso evita que navegar para uma cena mais recente marque como lidas mensagens de outras cenas ou páginas ainda não apresentadas. No app visível, registrar somente mensagens efetivamente vistas, sem saltar para o fim quando a pessoa lê conteúdo antigo. A navegação mantém posição e informa novas mensagens sem forçar scroll.

Combinar sinalização interna, som ativado por gesto e ponte Electron restrita a notificações próprias do app. O IPC aceita somente dados validados, e o clique navega por identificador de História, sem executar URLs arbitrárias.

Para web, registrar service worker e Web Push com VAPID. Permissão é pedida somente por ação do usuário; usar assinatura vinculada à conta/instalação. O worker mostra conteúdo mínimo e abre a rota web após autenticação. A Push API usa service workers para receber eventos em segundo plano: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API). Não se promete entrega se o navegador/SO suspender serviços ou bloquear permissões.

O despachante usa evento/instalação como chave de deduplicação, prioriza sessão ativa e aguarda brevemente um recibo de apresentação; sem recibo, tenta push. Worker e página usam um registro comum de eventos exibidos e `tag` por História para agrupar/substituir alertas. Para o desktop, usar o coordenador de alertas da instalação, sem inscrição push concorrente no mesmo runtime. Heartbeat de visibilidade tem validade curta; não suprime avisos indefinidamente após queda. Replay atualiza não lidas sem reemitir alertas antigos. Assinaturas inválidas são desativadas e logout desassocia a instalação.

A entrega em serviços externos não é transacional com PostgreSQL: a deduplicação no dispositivo é necessária para evitar alertas repetidos após crash entre envio e gravação do recibo. A revogação é verificada imediatamente antes de cada envio; o servidor não consegue recolher um push já entregue ao serviço do navegador.

### 9. Tela de RP integrada ao shell existente

A tela de Histórias abre como aba de conteúdo no workspace atual e reaproveita o painel lateral compartilhado do Lorekit. A navegação da lateral representa a História como raiz e cada cena como uma continuação, permitindo endereços diretos a cenas sem criar uma segunda navegação paralela. O cabeçalho mantém o estado de conexão compacto e agrupa exportação, participantes, cenas e preferências em ações secundárias. O compositor concentra contexto, busca de locutor, formatação e texto em uma área curta, com expansão apenas quando a pessoa escreve mais. A busca de locutores é local à História e mostra a projeção visual compartilhada; a ação de publicar personagem parte da biblioteca autenticada do próprio participante e mantém a allowlist do contrato existente.

Atualizações do histórico são agendadas em um único frame e reavaliam se o participante ainda está no fim antes de acompanhar mensagens novas. O carregamento de páginas anteriores preserva a mensagem de referência e o ajuste de rolagem atua somente na região do chat, sem rolar os ancestrais do workspace.

## Risks / Trade-offs

- Cópias mecânicas ficam desatualizadas em relação à ficha -> revisão visível, atualização explícita com prévia e histórico imutável.
- Vazamento por anexos ou serialização de ficha -> projeções por allowlist, cópia de recursos e testes de acesso direto entre Histórias e cofres.
- Queda após commit e antes de broadcast -> eventos duráveis, operações idempotentes e recuperação por cursor.
- Histórico extenso e API com memória limitada -> paginação, leitura incremental, renderização por janelas e exportação sem carregar tudo em memória; validar com volume representativo.
- Cache pode ser removido pelo navegador ou exceder quota -> informar cobertura real e manter consulta online; não prometer disponibilidade offline de dados ausentes.
- Permissões e entrega de notificações variam por plataforma -> capability detection, estados claros e validação em desktop Windows e Chrome Android; indicadores internos permanecem disponíveis.
- Duas abas podem receber o mesmo evento -> coordenação por instalação, deduplicação persistente e monotonicidade de leitura/cursor.
- Retenção local/exportada após revogação -> remover quando conhecida e explicar o limite, sem prometer recolhimento remoto.
- O servidor atual ainda não foi inspecionado ao vivo -> validar WSS, CSP, carga, backup e entrega push em homologação antes de habilitar em produção.

## Migration Plan

1. Introduzir pacote de regras e testes de equivalência sem mudar a experiência atual; adicionar catálogo `IRPWNpc` e negociação de capacidades de sync.
2. Aplicar migrações aditivas de Histórias, índices e fila de eventos com backup previamente verificado. Não converter documentos ou conversas externas automaticamente.
3. Publicar API inicialmente com Histórias desabilitadas por configuração; validar HTTP, transações, revogação, anexos e replay. Incluir novas tabelas e recursos nos backups e verificar restauração.
4. Preparar WSS/CSP, origem do service worker, segredos VAPID fora do repositório, saída HTTPS aos serviços push e limites de upload. Não alterar a instância em execução como parte do planejamento.
5. Publicar frontend/desktop compatíveis com detecção de capacidades; habilitar gradualmente em ambiente de teste com contas distintas, convidados sem acesso ao cofre e dois dispositivos.
6. Validar consulta offline após recarregar, exportação completa, notificações, consumo de memória e cenários de falha antes de habilitar produção. Compatibilidade de push é validada nos dispositivos disponíveis, com fallback especificado para os demais.
7. Rollback: desabilitar novas mutações e notificações por flag, interromper worker/gateway novo e retornar versões de aplicação compatíveis. Preservar tabelas e arquivos novos para não perder RP confirmado; não executar down migration destrutiva. Clientes antigos ignoram os novos recursos e o sync de entidades conhecidas continua funcionando.
