## Purpose

Centralizar RP em Histórias colaborativas com cenas, mensagens e locutores, preservando uma leitura narrativa contínua, consulta offline do conteúdo baixado e exportação para Markdown.

## ADDED Requirements

### Requirement: Histórias com cenas ordenadas
O sistema SHALL permitir criar uma História com título obrigatório, listar as Histórias acessíveis à conta e abrir uma tela dedicada. Os participantes SHALL poder criar e renomear cenas com título obrigatório; novas cenas SHALL ser acrescentadas em ordem estável. A leitura SHALL agrupar as mensagens por cena, apresentar seu título como divisor e oferecer navegação para cada cena sem perder a posição de leitura. As mutações da História SHALL exigir conexão e confirmação do servidor.

#### Scenario: Criar e navegar entre cenas
- **WHEN** um participante online cria duas cenas e envia mensagens em ambas
- **THEN** a História apresenta ambas na ordem de criação, cada uma com seu título e mensagens, e permite navegar diretamente até elas

#### Scenario: Entrada de participante convidado
- **WHEN** um usuário com acesso somente à História abre seu endereço
- **THEN** o sistema apresenta o RP sem exigir acesso ou sincronização do cofre de origem

### Requirement: Locutores compartilhados e autoria independente
Todos os participantes SHALL poder usar qualquer locutor disponível na História ou na cena atual. O sistema SHALL permitir disponibilizar personagens e criar locutores exclusivos da cena com nome obrigatório, cor e foto opcional. Locutores exclusivos MUST NOT criar personagens no worldbuilding nem aparecer como opções em outras cenas. Cada mensagem SHALL preservar a identidade visual do locutor no momento do envio e identificar separadamente o usuário autor; a cor MUST NOT ser o único meio de identificar o locutor.

#### Scenario: Dois participantes usam o mesmo personagem
- **WHEN** dois participantes enviam mensagens com o mesmo locutor
- **THEN** ambas usam a identidade visual do locutor e mantêm seus respectivos autores identificáveis

#### Scenario: Locutor incidental
- **WHEN** um participante cria um guarda exclusivo de uma cena
- **THEN** ele pode escrever como esse guarda nessa cena sem gerar um personagem no catálogo nem disponibilizá-lo automaticamente em outra cena

#### Scenario: Identidade alterada depois do envio
- **WHEN** o nome, a cor ou o retrato de um locutor muda
- **THEN** as mensagens anteriores preservam sua representação original e novos envios usam a representação atualizada

#### Scenario: Convidado disponibiliza seu próprio personagem
- **WHEN** um participante convidado escolhe um locutor e disponibiliza um personagem ou PNJ da biblioteca da própria conta
- **THEN** a História recebe somente a projeção aprovada para uso como locutor, sem conceder acesso ao cofre do convidado

### Requirement: Navegação e composição integradas ao Lorekit
A tela de RP SHALL usar o shell, a área de trabalho e o painel lateral existentes do Lorekit. O painel SHALL apresentar Histórias como raízes e suas cenas como continuações em um índice narrativo. A busca de locutores SHALL permitir localizar por nome e identificar cada resultado por retrato, nome e cor. O cabeçalho e o compositor SHALL preservar espaço para leitura, com ações secundárias agrupadas e formatação compacta. Atualizações de mensagens MUST NOT deslocar a leitura quando o participante está acima do fim; o carregamento de mensagens anteriores SHALL preservar a posição visível.

#### Scenario: Navegar pelo índice do shell
- **WHEN** um participante seleciona uma História ou uma de suas cenas na lateral existente do Lorekit
- **THEN** a aba de Histórias abre no espaço de trabalho e a cena selecionada aparece como continuação ativa da História

#### Scenario: Buscar locutor
- **WHEN** há vários locutores disponíveis na cena e o participante digita uma busca
- **THEN** o seletor mostra somente correspondências com retrato quando disponível, nome e cor

#### Scenario: Receber mensagens enquanto lê conteúdo anterior
- **WHEN** chegam mensagens novas enquanto o participante está lendo mensagens antigas ou carrega outra página do histórico
- **THEN** a posição atual permanece estável e nenhuma área externa ao chat é rolada

### Requirement: Mensagens com texto simples e imagens em destaque
O compositor SHALL aceitar texto com parágrafos, quebras de linha, negrito, itálico e citação, com prévia consistente com a leitura e exportação. SHALL aceitar uma ou mais imagens anexadas, inclusive junto com texto, apresentando-as em destaque no corpo da mensagem e permitindo ampliá-las. Conteúdo vazio sem imagem MUST ser recusado. HTML arbitrário e conteúdo executável MUST NOT ser executados. A interface SHALL informar limites de texto, quantidade, formato e tamanho de imagens antes de confirmar o envio.

#### Scenario: Texto acompanhado de imagem
- **WHEN** um participante envia texto formatado e uma imagem válida
- **THEN** a mensagem preserva a formatação permitida e apresenta a imagem em destaque, com ampliação acessível

#### Scenario: Upload incompleto
- **WHEN** o upload de um anexo falha
- **THEN** a mensagem não é publicada parcialmente, o erro é visível e o usuário pode tentar novamente enquanto estiver online

### Requirement: Entrega persistente ordenada e sem duplicatas
O sistema SHALL confirmar mensagens somente após persistência e atribuir ordem estável pelo servidor dentro da História. Participantes conectados SHALL receber novas mensagens sem atualização manual. Reconectar SHALL recuperar eventos perdidos e reconciliar envios cujo resultado ficou desconhecido. Repetir a mesma operação de envio MUST NOT criar mensagem adicional; reusar sua identidade com conteúdo diferente MUST ser recusado. Uma falha de canal em tempo real SHALL ser visível e permitir recuperação do histórico por consulta.

#### Scenario: Envios simultâneos
- **WHEN** dois participantes enviam mensagens simultaneamente
- **THEN** ambos passam a observar a mesma ordem confirmada, independentemente do relógio dos dispositivos

#### Scenario: Confirmação perdida
- **WHEN** o servidor persiste uma mensagem mas a conexão cai antes da confirmação
- **THEN** consultar ou repetir a mesma operação recupera a mensagem original sem duplicá-la

### Requirement: Envio exclusivamente online e leitura offline limitada ao cache
Sem comunicação autenticada com o servidor, o sistema MUST impedir envio de mensagens, publicação de imagens e execução de rolagens do chat. MUST NOT enfileirar novas operações offline ou enviá-las automaticamente ao reconectar. SHALL permitir consultar mensagens e recursos previamente baixados da conta atual, sinalizando modo offline, lacunas e imagens não disponíveis. Conteúdo ainda não baixado MUST NOT ser apresentado como disponível.

#### Scenario: Consultar RP sem conexão
- **WHEN** a pessoa abre offline uma História com parte do histórico e imagens já baixados
- **THEN** pode ler essa parte, vê os limites do conteúdo disponível e não consegue publicar nem rolar dados pelo chat

#### Scenario: Reconectar após escrever sem conexão
- **WHEN** a conexão retorna e há texto ainda não enviado no compositor
- **THEN** o texto não é publicado automaticamente e exige uma nova ação de envio online

### Requirement: Exportação integral em Markdown
O sistema SHALL exportar a História inteira para um arquivo `.md` com título, cenas em ordem, identidade textual dos locutores, autoria, mensagens formatadas, referências às imagens e registros legíveis de rolagem. Online, SHALL buscar todas as páginas em um recorte consistente do histórico. Offline, SHALL permitir a exportação integral somente se o histórico completo desse recorte estiver disponível localmente; caso contrário SHALL informar que é necessário conectar. O arquivo MUST NOT conter tokens, credenciais ou caminhos locais. Imagens SHALL usar links para uma visualização autenticada do anexo, identificando que dependem de conexão e acesso à História; cópia autossuficiente de anexos em ZIP fica fora desta entrega.

#### Scenario: Exportar além da página aberta
- **WHEN** uma História possui mensagens anteriores às carregadas na tela e o usuário exporta online
- **THEN** o arquivo inclui todas as mensagens do recorte escolhido, sem omissões ou duplicações entre páginas

#### Scenario: Cache parcial
- **WHEN** o usuário solicita exportação integral offline com páginas ausentes
- **THEN** o sistema explica a necessidade de conexão e não apresenta um arquivo parcial como História completa
