## Purpose

Permitir colaboração por convite restrito à História, compartilhando somente os dados e recursos necessários ao RP e preservando a privacidade do cofre de origem.

## ADDED Requirements

### Requirement: Convites restritos à História
O criador SHALL ser o proprietário administrativo da História. O proprietário SHALL poder emitir, cancelar e consultar convites e remover participantes. Um convite SHALL exigir aceitação por conta autenticada, possuir validade explícita e impedir aceitação após cancelamento, expiração ou consumo. Aceitar SHALL criar acesso apenas à História, sem associação ao cofre. O fluxo SHALL permitir copiar um link de convite; envio automático de e-mail não faz parte desta entrega. Os participantes SHALL poder sair da História; o proprietário MUST NOT sair sem manter um proprietário válido.

#### Scenario: Aceitar convite
- **WHEN** uma conta autenticada aceita um convite válido
- **THEN** a História aparece entre seus acessos sem liberar listagem, sincronização ou download de dados do cofre de origem

#### Scenario: Convite inválido
- **WHEN** alguém tenta aceitar um convite expirado, cancelado ou já consumido
- **THEN** a operação é recusada sem criar participação

### Requirement: Autorização por História em todos os canais
Consultas, comandos, exportações, imagens, assinaturas de eventos e notificações SHALL verificar a participação vigente na História. Identificadores conhecidos de Histórias, mensagens, personagens ou anexos MUST NOT conceder acesso por si sós. Participantes comuns SHALL poder narrar, criar cenas e locutores e realizar rolagens; somente o proprietário SHALL administrar convites e participantes. Controlar todos os locutores MUST NOT conceder edição das fichas ou entidades de origem.

#### Scenario: Acesso direto a recurso alheio
- **WHEN** um usuário sem participação solicita uma mensagem, imagem, exportação ou canal de outra História pelo seu identificador
- **THEN** o servidor recusa acesso e não retorna seu conteúdo

#### Scenario: Participante tenta obter o cofre
- **WHEN** um convidado usa os identificadores de origem para consultar entidades ou blobs privados do cofre
- **THEN** as políticas existentes do cofre continuam recusando o acesso

### Requirement: Compartilhamento explícito de personagens e fichas
Um participante que tenha permissão de leitura e escrita no conteúdo de origem SHALL poder disponibilizar um personagem ou PNJ à História por uma prévia dos dados compartilhados. A cópia SHALL incluir somente identidade visual e dados mecânicos selecionados e necessários às rolagens; notas privadas e outras entidades MUST NOT ser incluídas implicitamente. Atualizações na origem MUST NOT publicar novas informações automaticamente. Atualizar a cópia SHALL exigir nova ação autorizada e gerar uma nova revisão, preservando mensagens e rolagens anteriores. Os demais participantes SHALL poder usar essa cópia sem acesso à origem.

#### Scenario: Personagem com notas privadas
- **WHEN** um participante disponibiliza um personagem com ficha e notas no cofre
- **THEN** a prévia delimita os dados expostos e os convidados recebem somente a cópia aprovada e seus recursos autorizados

#### Scenario: Origem alterada ou removida
- **WHEN** o personagem ou catálogo de origem é editado, arquivado ou removido
- **THEN** a cópia já disponibilizada e o histórico da História permanecem consultáveis sem depender da existência da origem

### Requirement: Revogação e isolamento local por conta
Remover um participante ou sair da História SHALL impedir novos acessos, publicação, eventos e notificações assim que a alteração for confirmada pelo servidor. O cliente SHALL encerrar o canal correspondente e remover o cache daquela História ao conhecer a revogação. Logout SHALL remover conteúdo local de Histórias e associações de push daquela conta no dispositivo; trocar de conta MUST NOT expor o cache da anterior. O produto SHALL informar que revogação não recolhe arquivos exportados nem apaga remotamente cópias em dispositivos que continuam offline.

#### Scenario: Revogação com conexão aberta
- **WHEN** o proprietário remove um participante conectado
- **THEN** o acesso ativo é encerrado, comandos posteriores são recusados e nenhum novo conteúdo ou notificação é entregue a ele

#### Scenario: Troca de conta no mesmo dispositivo
- **WHEN** a pessoa sai de uma conta e entra com outra
- **THEN** o histórico, anexos e notificações da conta anterior não ficam disponíveis à nova conta
