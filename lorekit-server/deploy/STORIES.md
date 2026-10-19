# Operação de Histórias

Esta mudança não publica a aplicação. A configuração base mantém `STORIES_ENABLED=false`.
O catálogo de PNJs continua local e usa a sincronização existente; chat, convites e
rolagens compartilhadas exigem conexão. O cache permite consultar somente o que já foi baixado.

## Preparação e habilitação

1. Prepare `/opt/lorekit/data/story-assets` com proprietário
   `10001:10001` e permissão `0700` e faça backup antes de migrar. Não exponha esse diretório
   no Caddy: downloads passam pela autorização da API.
2. Construa a imagem com o contexto `lorekit-server`. O pacote de regras está em
   `src/shared/ironpaw` e entra na compilação NestJS. Execute as migrações pelo serviço
   `migrate`, com o usuário migrador existente. As migrações 0002/0003 são aditivas.
3. Publique o frontend gerado por `npm run build:web`, incluindo o worker, seu módulo
   auxiliar e o manifesto de shell produzido no pós-build. O worker deve ser servido
   como JavaScript, por HTTPS, sem cache imutável. Instalação inicial exige conexão.
4. Atualize o Caddyfile: WSS para `api.lorekit.online` e `worker-src 'self'` estão no
   exemplo. O proxy encaminha `/story-realtime` para a API. Configure as origens
   autorizadas em `CORS_ORIGINS`; não use curinga.
5. Para chat sem push, configure `STORIES_ENABLED=true` e recrie somente a API.
   Para push, gere as chaves com `npx web-push generate-vapid-keys`, usando a versão
   fixada do projeto. Armazene as duas chaves nos arquivos de segredo indicados em
   `compose.stories-push.yaml`, com proprietário `root:10001` e permissão `0640`
   (legíveis pelo usuário restrito do contêiner), e use o override explicitamente.
   Preserve as chaves entre releases; rotação requer renovar assinaturas dos clientes.
6. Valide com duas contas: convite restrito à História, imagem, locutores, rolagens,
   exportação, revogação, queda de conexão e recuperação. Observe logs, memória e
   latência antes de ampliar o uso. A API tem limite de 512 MiB no compose base.

Limites por comando: texto de 20.000 caracteres, quatro imagens de até 10 MiB,
16 milhões de pixels por imagem, formatos PNG/JPEG/WebP. Decodificação de imagens
limitada a duas operações simultâneas. Páginas têm até 100 mensagens e a tela mantém
uma janela limitada; pendentes de anexos expiram. Não há fila de envios offline.
WebSocket usa ticket de uso único obtido por HTTP autenticado; não coloque JWT em URL.

## Backup e restauração

O script `backup-vps.sh` inclui dump PostgreSQL, blobs, `data/story-assets`, compose
e Caddyfile. As tabelas de mensagens, revisões, operações idempotentes, eventos,
leituras, assinaturas e entregas ficam no mesmo dump. Segredos VAPID devem ter cópia
criptografada separada, segundo a política de segredos da instalação.

Para uma cópia consistente entre banco e arquivos, interrompa os escritores da API
durante o backup e reinicie a API após o script (inclusive em caso de falha). Isso
impede a limpeza de anexos entre o dump e a leitura dos arquivos. Não pare o PostgreSQL.

Faça primeiro o ensaio em uma instalação isolada, sem DNS público nem credenciais
de push ativas:

1. Restaure um snapshot Restic em diretório de staging e confira o dump com
   `pg_restore --list`. Prepare outro banco PostgreSQL 17 e credenciais independentes.
2. Restaure o dump com `pg_restore --no-owner --no-acl --exit-on-error`, sem substituir
   o banco da produção. Restaure blobs e story-assets mantendo seus UUIDs e ajuste
   propriedade para o usuário da API.
3. Inicie a mesma versão da API com Histórias habilitadas e VAPID ausente. Verifique
   mensagens, revisões, retratos, histórico paginado e exportação com duas contas.
   Confirme que repetir uma operação confirmada retorna o mesmo resultado.
4. Verifique eventos ainda não despachados após reinício e autorização dos anexos.
   Compare contagens e hashes de imagens com o snapshot. Somente depois faça uma
   restauração operacional seguindo o procedimento existente da VPS.

## Rollback

Defina `STORIES_ENABLED=false`, remova o override que o habilita e recrie a API.
Isso interrompe novos comandos, tickets e entrega de eventos. Preserve tabelas,
operações e anexos; não execute migração destrutiva nem apague a fila. Clientes
podem continuar consultando seu cache. Ao reabilitar, eventos duráveis são recuperados;
alertas antigos não geram avalanche (janela de cinco minutos). Evite retornar a uma
versão que desconhece `IRPWNpc` sem manter a negociação de capacidades da sincronização.

## Matriz de suporte e verificações pendentes

| Ambiente | Mecanismo | Condição |
|---|---|---|
| Desktop Windows | IPC + Notification Electron | Processo em execução; clique reabre a História |
| Página em foco | Indicadores e som Web Audio | Som habilitado por gesto e preferência da História |
| Navegador em segundo plano | Service worker + Web Push | HTTPS, suporte, permissão e assinatura ativa |
| Chrome Android | Web Push | Requer ensaio real no dispositivo; simulação não prova entrega |
| Offline | Cache SQLite e shell previamente instalado | Só conteúdo baixado; imagens ausentes são indicadas |

Notificações externas usam texto genérico. Permissão negada e navegadores sem push
preservam os indicadores dentro do app. Logout/revogação conhecida limpa o estado
local; o servidor verifica a sessão e a participação antes de enviar pendentes.
Não se promete notificação desktop com o processo encerrado.

O ensaio real Windows/Android, a imagem Docker, a restauração PostgreSQL/Restic e o
orçamento de memória/latência da VPS precisam ser executados em ambientes disponíveis
antes de considerar a validação integrada concluída. Consulte a evidência local em
`openspec/changes/story-roleplay-chat/verification.md` no repositório.
