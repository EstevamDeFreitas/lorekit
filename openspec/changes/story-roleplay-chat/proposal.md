## Why

Os participantes escrevem RP fora do Lorekit e precisam alternar entre o chat, personagens e fichas Ironpaw, perdendo a ligação entre narrativa e resultados das ações. Uma área de Histórias permitirá escrever, consultar e exportar o RP no próprio aplicativo, com colaboração restrita a cada História e sem expor o restante do cofre.

## What Changes

- Introduzir História como entidade colaborativa com tela dedicada, participantes convidados, cenas ordenadas e leitura contínua com títulos divisores.
- Permitir mensagens com formatação simples, imagens em destaque e locutores baseados em personagens disponibilizados ou identidades simples exclusivas da cena. Todos os participantes podem usar todos os locutores; a autoria do usuário permanece registrada separadamente.
- Criar autorização por História, independente da associação ao cofre, incluindo projeções explícitas de personagens/fichas e acesso restrito aos seus recursos visuais.
- Enviar e receber mensagens online em tempo real, com persistência, ordenação, recuperação após reconexão e prevenção de duplicatas. Permitir consulta offline apenas do histórico e recursos já baixados, sem fila de envio offline.
- Registrar rolagens comuns, ataques e defesas Ironpaw no chat usando o locutor selecionado, preservando fórmula, modificadores, dados e resultado. Não aplicar dano, condições ou consumo de recursos às fichas.
- Adicionar um construtor de PNJs ao Gerenciador de Conteúdo, com cálculos pelas regras do manual, catálogo reutilizável e cópias disponibilizadas para as cenas, sem IA ou geração aleatória.
- Exportar toda a História para Markdown, incluindo cenas, locutores, mensagens e rolagens; imagens usam referências autenticadas, sem credenciais no arquivo.
- Oferecer indicador de não lidas e som com o app aberto, notificação nativa no desktop em execução e Web Push nos navegadores compatíveis, com preferências por História e tratamento de permissões.

## Capabilities

### New Capabilities

- `story-roleplay`: Histórias, cenas, locutores, mensagens, imagens, entrega online, consulta offline e exportação Markdown.
- `story-access`: Convites e autorização por História, compartilhamento explícito de dados e anexos sem acesso ao cofre de origem.
- `story-ironpaw-rolls`: Registros persistentes de testes e ações de combate usando personagens e PNJs disponibilizados, sem mutar fichas.
- `ironpaw-npc-catalog`: Construtor e catálogo de PNJs com cálculos, validações e reutilização em cenas.
- `story-notifications`: Não lidas, som, notificações desktop e Web Push, com preferências e prevenção de alertas duplicados.

### Modified Capabilities

Nenhuma. A extração da lógica de rolagens preserva o comportamento existente das fichas; itens e sua portabilidade permanecem com seus contratos atuais.

## Impact

- Frontend Angular: navegação e tela de Histórias, acesso sem montar o cofre de origem, cache por conta, composição de mensagens, compartilhamento explícito de personagens/fichas, rolagens reutilizáveis e seção PNJs no Gerenciador de Conteúdo.
- SQLite/sql.js: cache isolado das Histórias e persistência local do catálogo de PNJs; registro de sincronização do catálogo, sem colocar mensagens no fluxo genérico de sincronização.
- Servidor NestJS/Fastify e PostgreSQL: domínio colaborativo próprio, convites, política de acesso por História, histórico paginado, idempotência, eventos WebSocket, anexos e assinaturas Web Push.
- Electron/preload: ponte restrita para notificações nativas e abertura da História pelo alerta.
- Infraestrutura Hostinger: reaproveitar API, banco e Caddy existentes; configurar WSS, CSP, service worker, segredos Web Push, retenção e backup dos novos dados. Validar em homologação antes de qualquer deploy.
- Novas dependências de transporte WebSocket e Web Push deverão ser avaliadas e fixadas na implementação. Esta change produz planejamento; não publica nem altera a infraestrutura em execução.
