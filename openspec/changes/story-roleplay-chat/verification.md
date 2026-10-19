# Evidências de implementação — 16/10/2026

Estado: 34/46 tarefas concluídas; implementação disponível para revisão local e
validação integrada ainda aberta.
Nenhum deploy, migração de produção, publicação ou alteração de dados reais foi executado.
O compose base mantém Histórias desabilitadas em produção.

## Auditoria posterior da VPS — somente leitura

Consulta SSH a `deploy@api.lorekit.online`, autorizada pelo usuário em 16/10/2026:

- API, PostgreSQL e Caddy estão saudáveis; `/health` público e interno retornam banco ativo.
- A imagem em execução contém o módulo de Histórias e `dist/shared/ironpaw/rolls.js`.
- As quatro migrações constam em `app.__drizzle_migrations`. Os hashes de 0002/0003
  coincidem com os arquivos locais e os arquivos dentro da imagem. As tabelas de RP existem.
- `STORIES_ENABLED`, `STORY_ASSET_PATH` e `STORY_WEB_ORIGIN` não estão definidos
  no ambiente efetivo da API. Com `NODE_ENV=production`, Histórias fica desabilitada.
- `/opt/lorekit/data/story-assets` não existe e não há montagem `/data/story-assets`.
  O contêiner usa filesystem somente de leitura e usuário `10001:10001`; habilitar
  somente a flag não prepara o armazenamento necessário para imagens.
- O Caddy publicado permite WSS e worker. O handshake público de Socket.IO passou;
  o namespace recusou corretamente um ticket inválido, sem usar credencial de conta.
- Worker e manifesto offline retornam HTTP 200 com tipos corretos e `Cache-Control: no-cache`.
- VAPID não está configurado; é uma etapa opcional para Web Push.

Nenhum serviço foi alterado ou reiniciado nesta auditoria. Para habilitar, preparar
o diretório/volume persistente, definir a flag e o caminho de anexos e recriar a API.
Os limites de ambiente descritos abaixo referem-se à implementação inicial; o
acesso SSH à VPS e a imagem em execução puderam ser verificados nesta auditoria.

## Verificações locais

- Contratos e motor puro compartilhado compilados pelo Angular e NestJS. Testes
  determinísticos cobrem rolagens, condições, PNJs, limites, escaping e referências.
- Migrações 0002/0003 executadas em PostgreSQL embutido PGlite, tanto vazio quanto
  com conta anterior. Isso exercita SQL real; não substitui ensaio da imagem Docker,
  concorrência de múltiplas conexões PostgreSQL nem restauração Restic na VPS.
- Integração dos serviços: convites consumidos/expirados/cancelados, acesso restrito
  à História, operações concorrentes/idempotentes, escopo de cenas e locutores,
  revisões históricas, dados de rolagens gerados no servidor, leitura com lacunas,
  imagens validadas/autorizadas, limpeza de pendentes e exportação de 102 mensagens
  com uma nova mensagem chegando depois do recorte.
- Integração HTTP NestJS/Fastify com JWT e sessões reais no banco isolado: duas
  contas, convite, cena, PNJ compartilhado, upload binário, mensagem, repetição da
  operação, defesa, acesso a imagem, Markdown e remoção de participante. Uma
  terceira conta recebe recusa ao consultar História ou imagem. Nenhum cofre é
  criado ou compartilhado pelo fluxo.
- Integração Socket.IO por rede local: origem recusada, ticket de uso único,
  recusa de sala alheia, despacho de evento confirmado por dispatcher substituído,
  recuperação HTTP e desconexão após revogação de sessão/participação.
- Política de push com envio interceptado: agendamento único, payload sem texto
  privado, silenciamento/remoção antes da entrega e desativação HTTP 410.
  Isso não prova entrega em serviço externo nem em celular.
- Testes frontend: catálogo e sync de PNJs, negociação com servidor sem suporte,
  cache SQLite, reabertura e quota, isolamento de conta, imagens tardias, exportação
  offline condicionada à cobertura, resposta perdida reconciliada por consulta,
  ausência de envio offline, fallback HTTP, limpeza após revogação, projeção sem
  notas privadas, entrada independente e compositor/tela em consulta offline.
- IndexedDB real no Chrome Headless: duas tentativas concorrentes de apresentar o
  mesmo evento têm um único vencedor; logout/troca de conta recusa eventos antigos.
- `node --test scripts/story-desktop.test.cjs`: dois testes de IPC com Electron
  substituído por um ambiente controlado; validam payload/origem, caminhos por
  conta, deduplicação e chamadas de restauração/foco da janela minimizada.
  Isso não prova exibição de toast pelo Windows.
- Builds Angular de produção desktop e web geram o manifesto versionado do shell
  offline. NestJS compila sem o utilitário de testes PGlite no artefato runtime.
- `openspec validate story-roleplay-chat --strict` passou. `git diff --check` passou.

Resultado da implementação inicial: 44 testes do servidor, 371 do frontend e dois de IPC passaram.
Os logs locais de execução ficam em `.codex/*.log` (ignorados pelo Git).

Revisão de navegação solicitada pelo usuário: Histórias agora abre uma aba `view:stories`
no mesmo shell e gerenciador de painéis do Lorekit. Convites e anexos selecionam essa
aba, a navegação entre `/stories` e `/app` preserva a instância do shell e os editores,
e carregar o workspace próprio mescla suas abas salvas com a aba RP já aberta.
Rascunhos permanecem na troca de abas; abas inativas interrompem observação de leitura
e heartbeat de visibilidade. A tela usa a altura do painel e consultas de contêiner
para se adaptar a painéis divididos. A suíte completa passou com 374 testes e o build
web de produção gerou o shell offline com 100 recursos. A revisão visual interativa
permanece indisponível: a ferramenta retornou inventário de navegadores vazio.
Os builds emitem avisos de orçamento CSS, inclusive nas novas telas de RP/PNJs,
e de CommonJS para sql.js. Não foram aumentados os orçamentos existentes.

## Pendências que mantêm tarefas abertas

| Tarefas | O que falta demonstrar |
|---|---|
| 6.3 | Recarregar a aplicação publicada sem rede, com shell instalado e credencial expirada, incluindo lacunas e imagens ausentes |
| 7.1–7.2 | Inspeção visual real desktop/móvel, teclado, posição de leitura e apresentação de retratos/cores/prévia |
| 9.2 | Som autorizado por gesto/autoplay e coordenação entre abas em uso real |
| 9.4, 9.6 | Permissão negada, assinatura/logout, worker em segundo plano, clique autenticado e deduplicação sob encerramento real da página |
| 10.1 | Construir e iniciar a imagem Docker com o pacote de regras e configuração de proxy/worker |
| 10.2 | Restaurar PostgreSQL, arquivos e filas por Restic em instalação isolada, e exercitar rollback por flag |
| 10.3–10.4 | Cenário completo em dois dispositivos, falhas/reinício de processo e retomada de cache |
| 10.5 | Exibição real de notificação/som Windows e Web Push Chrome Android, foco/segundo plano/permissão negada |
| 10.6 | Histórico representativo e medição de memória/latência dentro do orçamento da VPS; a regressão local já está coberta |

Limites do ambiente desta sessão: a ferramenta de navegador retornou
`Browser is not available: iab`; Docker, psql e Restic não estão disponíveis no
PATH; não há dispositivo Chrome Android conectado nem ambiente de ensaio da VPS
configurado. Testes automatizados e mocks não foram considerados prova dessas
entregas reais. As tarefas correspondentes permanecem desmarcadas.

Procedimento operacional e matriz de suporte: [STORIES.md](../../../lorekit-server/deploy/STORIES.md).

## Falha encontrada após habilitação na VPS

A preflight `OPTIONS /story-realtime/ticket` respondeu `400 {"code":0,"message":"Transport unknown"}`.
O caminho colidia com o `path: /story-realtime` do Engine.IO; não era uma origem CORS ausente.
Confirmado na VPS: uma preflight para `/stories/realtime-ticket`, com a origem
`https://app.lorekit.online`, respondeu `204` com os cabeçalhos CORS esperados.
O controlador HTTP e o cliente web foram ajustados para usar esse caminho. A VPS ainda
precisa receber as versões atualizadas do backend e do frontend; nenhum serviço foi
alterado durante esta verificação.
