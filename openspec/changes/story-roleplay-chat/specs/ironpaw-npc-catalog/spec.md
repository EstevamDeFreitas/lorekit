## Purpose

Oferecer construção e reutilização de PNJs Ironpaw com ficha simplificada, cálculos explícitos e validações fiéis ao manual, sem exigir personagens completos de worldbuilding.

## ADDED Requirements

### Requirement: Catálogo de PNJs no Gerenciador de Conteúdo
O Gerenciador de Conteúdo SHALL incluir uma seção PNJs para criar, consultar, buscar por nome ou conceito, editar, duplicar e arquivar definições, sem alterar o funcionamento de itens e moedas. O catálogo SHALL funcionar localmente offline no desktop e web, participar da sincronização opcional do cofre e manter identidades independentes das cópias usadas nas Histórias. Duplicar SHALL gerar nova identidade; arquivar SHALL retirar da seleção padrão sem remover cópias existentes. Esta entrega MUST NOT exigir IA, geração aleatória ou criação de um personagem de worldbuilding.

#### Scenario: Preparar PNJ offline
- **WHEN** o usuário cria e salva um PNJ sem conexão no Gerenciador de Conteúdo
- **THEN** a definição fica disponível localmente e pode ser sincronizada pelo fluxo opcional existente quando houver conexão, sem publicar nada no chat automaticamente

#### Scenario: Arquivar modelo utilizado
- **WHEN** um PNJ do catálogo é arquivado depois de ser disponibilizado em uma cena
- **THEN** a cópia da cena e seu histórico permanecem acessíveis

### Requirement: Ficha simplificada proporcional à função narrativa
O construtor SHALL oferecer nome obrigatório, conceito, identidade visual opcional, NA opcional, CV e CR calculados quando houver NA, Tags de Competência, Propriedade, Gatilho e Limitação, até quatro ações básicas, assinaturas, resistências, fraquezas e observações. PNJs incidentais SHALL poder ser salvos sem NA ou ficha mecânica completa. Ações SHALL permitir indicar Corpo, Mente, Presença, Técnica ou Percepção, conforme a tabela do manual. Assinaturas SHALL permitir explicitar atributo, alvo, efeito, resistência, condições de uso e eventual custo, recarga ou limite, sem impor quantidade ou recarga universal.

#### Scenario: PNJ apenas narrativo
- **WHEN** o usuário informa nome e conceito e omite NA e ações
- **THEN** o cadastro é aceito sem inventar valores mecânicos e a cópia pode ser usada como locutor narrativo

#### Scenario: Excesso de ações básicas
- **WHEN** o usuário tenta salvar mais de quatro ações básicas
- **THEN** o construtor identifica o limite e não salva uma definição inválida

### Requirement: Cálculos explícitos por Nível de Ameaça
Para NA inteiro de 1 a 6, o construtor SHALL apresentar respectivamente as bases `1d10+1`, `1d10+2`, `1d10+3`, `2d10+2`, `2d10+3` e `3d10+3`. SHALL calcular CV base como `2 × NA` e CR base como `NA` somente com proteção explicitada; sem proteção SHALL manter CR em zero. SHALL permitir ajustes separados de CV e CR entre -5 e +5, sem totais negativos e sem conceder CR sem proteção. A interface SHALL distinguir base, ajuste e total e recalcular bases quando o NA mudar, preservando ajustes válidos. Os limites de severidade SHALL ser Moderado, Severo, Severo, Grave, Devastador e Devastador para NA de 1 a 6; severidades estruturadas acima desses limites MUST ser recusadas.

#### Scenario: PNJ sem proteção
- **WHEN** o usuário configura NA 3 sem proteção
- **THEN** vê base de rolagem `1d10+3`, CV base 6 e CR total zero

#### Scenario: Proteção e ajuste
- **WHEN** o usuário explicita proteção em NA 3 e define ajuste de CR +2
- **THEN** vê CR base 3, ajuste +2 e total 5

#### Scenario: Valores inválidos
- **WHEN** NA, ajustes ou severidade estruturada violam os limites do manual
- **THEN** o salvamento indica os campos inválidos sem modificar a definição anterior

### Requirement: Efeitos explícitos sem inferência narrativa
O construtor SHALL distinguir descrições de efeitos e modificadores estruturados. Tags de Competência SHALL poder definir alteração de dados, modificador e contexto; nomes de tags MUST NOT gerar bônus implícitos. Gatilhos SHALL permitir descrever ativação, efeito e limites, sem executá-los automaticamente. Resistências e fraquezas SHALL permanecer descritivas nesta entrega. A prévia de rolagem SHALL informar o máximo de 4d10 e a seleção de no máximo uma competência numérica aplicável, sem orçamento de pontos ou número obrigatório de tags e assinaturas.

#### Scenario: Tag com nome sugestivo
- **WHEN** o usuário cria uma tag chamada Blindagem Natural sem configurar modificador
- **THEN** o PNJ preserva a descrição e nenhum bônus numérico é inventado
