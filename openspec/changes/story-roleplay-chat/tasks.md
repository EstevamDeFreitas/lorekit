## 1. Contratos e motor Ironpaw compartilhado

- [x] 1.1 Definir DTOs e contratos versionados de História, cena, locutor/revisão, mensagem, operação, evento e rolagem, com validação de referências e limites; verificar exemplos válidos e rejeição de payloads de outra História em testes de contrato.
- [x] 1.2 Extrair cálculo e resolução atuais da ficha para pacote TypeScript puro com aleatoriedade injetável, incluindo build Angular/NestJS, Docker e empacotamento; verificar builds dos dois consumidores e execução sem dependências de plataforma.
- [x] 1.3 Adaptar a ficha local ao motor sem alterar a interface ou exigir conexão; verificar os testes existentes de rolagens, condições e ajustes manuais e uma rolagem offline na ficha.
- [x] 1.4 Adicionar tipos e cálculo de PNJs ao motor, cobrindo NA 1–6, CV/CR, proteção, ajustes, severidade, desvantagem, mínimo e teto de dados e competência única; verificar casos de fronteira e exemplos normativos do manual com dados determinísticos.

## 2. Catálogo de PNJs

- [x] 2.1 Criar persistência local `IRPWNpc`, normalização e serviço de catálogo com criar, editar, duplicar e arquivar; verificar reabertura do banco, identidades distintas e ausência de criação automática de `Character`.
- [x] 2.2 Registrar `IRPWNpc` nos contratos frontend/backend e negociação de capacidades da sincronização; verificar ida e volta entre dois clientes e recusa de envio do tipo quando o servidor não anuncia suporte, preservando tipos existentes.
- [x] 2.3 Adicionar seção PNJs ao Gerenciador de Conteúdo com busca, seleção e filtro de arquivados; verificar operação offline em desktop/web e preservação das seções itens e moedas.
- [x] 2.4 Implementar formulário narrativo e mecânico com prévia de bases/ajustes/totais, proteção explícita, tags estruturadas, ações e assinaturas; verificar NA opcional, quatro ações máximas, ausência de bônus implícitos e mensagens de campo inválido.

## 3. Persistência e autorização do servidor

- [x] 3.1 Criar migrações aditivas para Histórias, participantes, cenas, locutores/revisões, mensagens, operações, eventos e anexos, com índices e integridade por História; verificar migração em banco vazio e cópia de banco existente sem alterar registros anteriores.
- [x] 3.2 Implementar política central de acesso por História e criação do proprietário, listagem e consulta autenticadas; verificar isolamento entre contas sem associação ao cofre e recusa de recursos de Histórias alheias.
- [x] 3.3 Implementar emissão/cancelamento/aceitação de convite com token de uso único, hash e expiração, além de saída e remoção de participante; verificar aceitação concorrente, convite consumido/expirado e impedimento de saída do único proprietário.
- [x] 3.4 Implementar publicação e atualização explícita de projeções por allowlist, revisões imutáveis e autorização de origem quando houver leitura remota; verificar que notas privadas, carteira, relações e referências de outro cofre não são expostas.
- [x] 3.5 Implementar autorização de anexos por História e desvincular cópias publicadas da exclusão do recurso de origem; verificar download por convidado autorizado, recusa por não membro e preservação do retrato histórico após alteração da origem.

## 4. Comandos, anexos e histórico online

- [x] 4.1 Implementar criação/renomeação de cenas e locutores visuais exclusivos da cena, com nome/cor/retrato e revisões; verificar ordem estável, escopo da cena e uso de todos os locutores por participantes distintos.
- [x] 4.2 Implementar reserva/upload/finalização de imagens, validação real de conteúdo/tamanho/dimensões e limpeza de pendentes; verificar rejeição de arquivos inválidos, limites informados e publicação impedida quando qualquer anexo falha.
- [x] 4.3 Implementar envio transacional de mensagens com validação do texto permitido, autor do contexto autenticado, sequência do servidor, operação idempotente e evento durável; verificar envios simultâneos, reuso com conteúdo diferente e rollback integral.
- [x] 4.4 Implementar paginação por sequência, consulta de eventos e consulta de resultado por operação, com limites de página; verificar travessia completa sem omissões/duplicatas enquanto chegam novos envios.
- [x] 4.5 Implementar execução de rolagens no servidor com revisão explícita, resultado persistido e vínculos opcionais de alvo/oposição; verificar aleatoriedade somente no servidor, revisão desatualizada, repetição após timeout e nenhuma gravação em ficha, recursos ou inventário.

## 5. Entrega em tempo real

- [x] 5.1 Integrar gateway NestJS/Socket.IO e cliente com transporte WebSocket, ticket curto vinculado à sessão e salas autorizadas; verificar conexão desktop/web, origem recusada, expiração e impossibilidade de entrar em sala alheia.
- [x] 5.2 Implementar despacho após commit e recuperação de eventos pendentes após reinício, sem buffer de comandos do cliente; verificar queda entre persistência e broadcast com replay sem mensagem duplicada.
- [x] 5.3 Implementar reconexão com backoff, cursores e fallback HTTP com estado degradado visível; verificar interrupção do canal, recuperação por API e nenhum envio novo disparado automaticamente ao reconectar.
- [x] 5.4 Integrar revogação de participação/sessão ao gateway e ao dispatcher; verificar que remoção com canal aberto interrompe acesso e que eventos pendentes não são entregues ao ex-participante.

## 6. Entrada independente e consulta offline

- [x] 6.1 Criar navegação e rotas de Histórias, aceite de convite e visualização autenticada de anexo sem inicializar o cofre de origem; verificar acesso direto com conta convidada e preservação do workspace próprio.
- [x] 6.2 Criar cache de Histórias por conta no desktop e navegador, com persistência atômica de lotes, cursores, cobertura e recursos; verificar reinício, falha de quota e rollback de cursor após falha de gravação.
- [ ] 6.3 Integrar consulta offline e shell web previamente baixado com estados de lacuna/imagem ausente; verificar recarga sem rede com credencial expirada, leitura do conteúdo baixado e bloqueio de todas as mutações do RP.
- [x] 6.4 Implementar limpeza de cache, imagens, URLs e estado de notificações no logout/revogação conhecida; verificar troca de conta no mesmo dispositivo e nenhum conteúdo da conta anterior acessível.

## 7. Tela dedicada de RP

- [ ] 7.1 Implementar listagem/criação de Histórias e tela responsiva com índice de cenas, divisores e leitura por janelas; verificar navegação, posição preservada, teclado e apresentação desktop/móvel.
- [ ] 7.2 Implementar seletor de locutores com nome/foto/cor, criação incidental e prévia de compartilhamento de personagens/PNJs; verificar autoria separada, cor com alternativa textual e cópia da cena independente do catálogo.
- [x] 7.3 Implementar compositor com formatação permitida, prévia e anexos em destaque/ampliação; verificar rejeição de mensagem vazia, ausência de execução de HTML e limites visíveis antes de enviar.
- [x] 7.4 Implementar estados enviando/confirmado/resultado incerto/erro, reconciliação por operação e tentativa manual online; verificar confirmação perdida sem duplicação e rascunho nunca publicado automaticamente após reconexão.
- [x] 7.5 Implementar painel Ironpaw baseado na revisão do locutor e cartões persistentes de testes/ataques/defesas; verificar fórmula/fontes antes de executar, locutor sem ficha, competência única de PNJ e histórico estável após atualizar a projeção.

## 8. Exportação Markdown

- [x] 8.1 Implementar exportação integral com recorte consistente, paginação incremental, escaping de metadados e serialização de texto/rolagens; verificar História multipágina com novos envios durante a geração, sem omissões ou duplicatas.
- [x] 8.2 Incluir links de visualização autenticada de imagens e aviso sobre dependência de conexão, sem tokens ou caminhos locais; verificar abertura autorizada do anexo e recusa por outra conta.
- [x] 8.3 Oferecer download `.md` no desktop/web e completude comprovada para exportação offline; verificar arquivo completo com cache integral e mensagem de necessidade de conexão com cache parcial.

## 9. Leitura e notificações

- [x] 9.1 Implementar cursor monotônico e intervalos de leitura com lacunas e preferências por História no servidor/cliente; verificar união entre dispositivos, salto entre cenas sem marcar páginas não vistas, recepção em segundo plano e silêncio sem perda do indicador de não lidas.
- [ ] 9.2 Implementar indicadores, som ativado por gesto e coordenação de alertas entre abas, sem forçar scroll; verificar bloqueio de autoplay, mensagens próprias e replay sem avalanche de sons.
- [x] 9.3 Adicionar IPC restrito de notificação nativa e retorno à História no Electron; verificar janela minimizada, payload IPC inválido e ausência de promessa de funcionamento com processo encerrado.
- [ ] 9.4 Implementar service worker, ativação explícita e registro/remoção de assinatura Web Push por conta/instalação; verificar permissão negada, suporte ausente, logout e clique com autenticação necessária.
- [x] 9.5 Implementar envio push com VAPID, consulta de participação/preferências, desativação de endpoints inválidos e rastreamento de entrega; verificar silenciamento/revogação com eventos pendentes e ausência de texto privado por padrão.
- [ ] 9.6 Integrar recibos, deduplicação persistente entre página/worker e agrupamento por História; verificar evento recebido por WebSocket e push, crash após envio e História visível sem alerta externo duplicado.

## 10. Infraestrutura e validação integrada

- [ ] 10.1 Preparar dependências fixadas, flags, configuração WSS/CSP/service worker, segredos VAPID e limites no material de deploy, sem publicar automaticamente; verificar build de produção Angular/NestJS e imagem Docker com o pacote de regras.
- [ ] 10.2 Atualizar backup/restauração e runbook de habilitação/rollback para tabelas, anexos e filas novos; verificar restauração em ambiente isolado e rollback por flags preservando mensagens confirmadas.
- [ ] 10.3 Executar cenário integrado com duas contas, dois dispositivos, convite apenas à História, cenas, imagem, personagem e PNJ, rolagens e exportação; registrar evidências de ordem consistente e isolamento do cofre.
- [ ] 10.4 Executar cenários integrados de perda de conexão, reinício após commit, cache parcial, logout, revogação e retomada; registrar confirmação de ausência de duplicatas, acesso indevido e envio offline tardio.
- [ ] 10.5 Validar som/notificação no Windows e Web Push em Chrome Android disponível, com página em foco, em segundo plano e permissão negada; documentar a matriz de suporte e qualquer limitação real sem considerar simulação como prova de entrega móvel.
- [ ] 10.6 Validar paginação/renderização/exportação com histórico representativo, acompanhar memória/latência no orçamento da VPS e executar checks de regressão de sync, ficha, itens e moedas; registrar resultados e corrigir falhas antes de considerar a implementação concluída.
