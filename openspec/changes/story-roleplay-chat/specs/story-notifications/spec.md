## Purpose

Avisar participantes sobre novas mensagens de Histórias por indicadores, som e canais de notificação disponíveis, respeitando leitura, preferências, permissões e participação vigente.

## ADDED Requirements

### Requirement: Não lidas e preferências por História
O sistema SHALL manter posição de leitura por participante, indicar Histórias com mensagens posteriores e oferecer preferências por História para silenciar som e notificações externas. Mensagens próprias MUST NOT gerar alerta para o remetente. Ler uma mensagem SHALL exigir que ela esteja apresentada na História visível; receber em segundo plano MUST NOT marcar como lida. A posição de leitura SHALL ser monotônica e consistente entre dispositivos após reconexão.

#### Scenario: Mensagem recebida em outra tela
- **WHEN** chega uma mensagem de outro participante enquanto a pessoa está em outra área
- **THEN** a História passa a indicar conteúdo não lido sem marcá-lo como lido automaticamente

#### Scenario: Leitura com lacunas entre cenas
- **WHEN** a pessoa navega diretamente para uma cena recente sem apresentar mensagens anteriores de outras cenas
- **THEN** apenas as mensagens efetivamente vistas são registradas como lidas e as demais continuam não lidas

### Requirement: Som e notificações desktop durante execução
Com o aplicativo aberto, o sistema SHALL oferecer som após interação que permita reprodução e sinalização visual mesmo quando áudio estiver bloqueado. No desktop em execução e com a História fora de foco, SHALL oferecer notificação nativa quando suportada pelo sistema. Clicar no alerta SHALL abrir ou focar a História autorizada. Silenciar ou negar permissão MUST NOT impedir receber e ler mensagens. O produto MUST NOT prometer notificações desktop quando o processo estiver encerrado.

#### Scenario: Desktop minimizado
- **WHEN** chega uma mensagem elegível com o desktop em execução e minimizado
- **THEN** a notificação nativa permite voltar à História e respeita a preferência de som

#### Scenario: Áudio bloqueado
- **WHEN** o navegador bloqueia a reprodução de som
- **THEN** o indicador visual permanece funcional e o aplicativo oferece ativação do som por ação do usuário

### Requirement: Web Push com consentimento e compatibilidade
Em navegador compatível e contexto seguro, o sistema SHALL permitir ativar Web Push por ação explícita, registrar a assinatura do dispositivo e enviar alertas de novas mensagens elegíveis mesmo sem a página ativa, dentro das condições do navegador e sistema. SHALL apresentar estados de permissão negada e recurso indisponível sem insistir em pedidos automáticos. Cada envio SHALL verificar participação e preferências atuais; assinaturas expiradas SHALL ser desativadas. Alertas SHALL usar conteúdo mínimo, sem texto privado do RP por padrão, e abrir a História após autenticação quando necessário.

#### Scenario: Navegador móvel em segundo plano
- **WHEN** um navegador compatível tem assinatura ativa, permissão e recebe uma mensagem elegível com a página em segundo plano
- **THEN** o sistema solicita entrega push e o clique conduz à História, sem depender de WebSocket mantido pelo navegador

#### Scenario: Recurso indisponível ou negado
- **WHEN** Web Push não está disponível ou sua permissão foi negada
- **THEN** o aplicativo explica o estado e preserva o chat e as notificações internas

### Requirement: Deduplicação e acesso vigente nos alertas
Para uma mesma mensagem e dispositivo, o sistema SHALL reconciliar eventos recebidos em tempo real e push para evitar notificações externas duplicadas, e agrupar alertas de uma mesma História quando necessário. A História atualmente visível e lida MUST NOT gerar alerta externo nesse dispositivo. Recuperar histórico antigo ou reproduzir eventos de reconexão MUST NOT gerar uma sequência de alertas antigos. Remoção do participante, logout ou silenciamento SHALL impedir novos alertas assim que confirmados; conteúdo já entregue ao sistema operacional pode permanecer fora do controle do aplicativo.

#### Scenario: Mesmo evento por dois canais
- **WHEN** um dispositivo recebe o mesmo evento por conexão ativa e push
- **THEN** apresenta no máximo um alerta externo para ele

#### Scenario: Retomar após ausência
- **WHEN** o aplicativo recupera páginas antigas e eventos perdidos ao reconectar
- **THEN** atualiza o indicador de não lidas sem reproduzir um alerta para cada mensagem recuperada
