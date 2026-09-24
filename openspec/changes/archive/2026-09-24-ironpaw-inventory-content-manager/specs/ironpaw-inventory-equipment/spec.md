## Purpose

Organizar as posses de cada personagem Ironpaw em mochila visual e espaços de equipamento, preservando suas cópias particulares e tornando explícita a contribuição da proteção principal aos recursos da ficha.

## ADDED Requirements

### Requirement: Mochila visual expansível
A aba Inventário SHALL exibir equipamentos, mochila em grid e detalhes do item selecionado. Cada item ou pilha SHALL ocupar uma célula; a mochila SHALL crescer sem impor capacidade ou peso. O usuário SHALL adicionar itens do catálogo, buscar, filtrar, reordenar e remover posses. Arraste SHALL possuir alternativas por clique e teclado, e filtros MUST NOT eliminar ou reordenar involuntariamente itens ocultos.

#### Scenario: Adicionar além das células visíveis
- **WHEN** o usuário adiciona um item à mochila preenchida
- **THEN** novas células ficam disponíveis e nenhum item existente é descartado

#### Scenario: Reordenar sem arraste
- **WHEN** o usuário move um item usando os comandos acessíveis
- **THEN** a nova ordem persiste após reabrir a ficha

### Requirement: Cópias independentes e atualização explícita
Cada posse SHALL manter identidade própria, características copiadas, referência de origem quando disponível, quantidade e anotações particulares. Editar a cópia MUST NOT modificar o catálogo ou outra ficha. Atualizar do catálogo SHALL apresentar diferenças e exigir aplicação explícita, preservando identidade, quantidade e anotações da posse. Atualização incompatível com o equipamento SHALL devolver o item à mochila na mesma operação.

#### Scenario: Alteração posterior do catálogo
- **WHEN** uma definição é editada após ser adicionada à ficha
- **THEN** a posse mantém suas características anteriores até uma atualização explícita

#### Scenario: Item deixa de ser compatível com o espaço
- **WHEN** uma edição da cópia ou atualização confirmada altera sua compatibilidade enquanto está equipado
- **THEN** o item volta à mochila e os efeitos derivados são recalculados sem duplicação

### Requirement: Pilhas e consumo consistentes
Quantidades SHALL ser inteiros positivos, equipamentos SHALL representar uma unidade e apenas cópias equivalentes em características, origem e anotações SHALL poder se empilhar respeitando o limite configurado. O usuário SHALL dividir e combinar pilhas. Usar consumível SHALL reduzir uma unidade, remover a entrada ao atingir zero e apresentar o efeito e custo de uma ação; MUST NOT alterar automaticamente CV, PR, condições ou outros alvos nesta entrega.

#### Scenario: Consumir última unidade
- **WHEN** o usuário usa um consumível com quantidade um
- **THEN** a entrada é removida e a operação pode ser desfeita restaurando sua quantidade e posição

#### Scenario: Cópias distintas
- **WHEN** duas cópias têm o mesmo nome e características ou anotações diferentes
- **THEN** não são combinadas automaticamente

#### Scenario: Equipar a partir de pilha
- **WHEN** o usuário equipa um item compatível que está em uma pilha com mais de uma unidade
- **THEN** uma unidade é separada com identidade própria e as restantes permanecem na mochila

### Requirement: Espaços de equipamento e reserva
O sistema SHALL oferecer capacete, armadura, roupa íntima inferior, calças, botas, luvas, três espaços de acessório, arma primária, arma secundária e arco/arma reserva. Cada posse SHALL estar em apenas uma localização. Equipar SHALL validar compatibilidade, devolver ocupantes substituídos à mochila e persistir a operação integralmente. Arma de duas mãos ativa SHALL ocupar primária e bloquear secundária; reserva MUST NOT ativar efeitos. Ativar a reserva SHALL mover a arma para primária e devolver à mochila os itens incompatíveis, explicitando a troca.

#### Scenario: Substituir armadura
- **WHEN** uma proteção é equipada no espaço de armadura ocupado
- **THEN** a anterior retorna à mochila e somente a nova fornece a proteção principal

#### Scenario: Usar arma de duas mãos
- **WHEN** uma arma de duas mãos é equipada na primária com secundária ocupada
- **THEN** os ocupantes substituídos retornam à mochila e a secundária fica bloqueada enquanto a arma permanecer ativa

#### Scenario: Tentar equipar em local incompatível
- **WHEN** o usuário tenta colocar botas no espaço de capacete
- **THEN** recebe indicação da incompatibilidade e nenhuma localização é alterada

### Requirement: Proteção principal e PR sem recuperação implícita
Somente a proteção no espaço armadura SHALL fornecer o bônus padrão de proteção. O máximo de PR SHALL ser calculado como contribuição da vocação mais proteção principal mais ajuste manual, com mínimo zero e origens visíveis. Alterar equipamento ou contribuição da vocação MUST NOT aumentar PR atual: o atual SHALL ser mantido, limitado ao novo máximo quando já houver máximo configurado. A primeira conversão de uma ficha legada SHALL preservar o PR atual e estabelecer máximo inicial não inferior a ele. Os demais vestíveis MUST NOT somar proteção padrão; efeitos contextuais SHALL permanecer visíveis sem automação de dano ou condições.

#### Scenario: Equipar proteção com PR gasto
- **WHEN** um personagem tem PR atual 1, máximo 3 e equipa proteção que eleva o máximo para 5
- **THEN** o atual permanece 1 e a ficha apresenta as contribuições do máximo 5

#### Scenario: Reduzir máximo abaixo do atual
- **WHEN** remover proteção reduz o máximo de 5 para 2 e o atual é 4
- **THEN** o atual passa a 2 e reequipar a proteção não o restaura para 4

#### Scenario: Abrir ficha legada
- **WHEN** uma ficha contém apenas PR atual 4 e nenhuma informação de máximo
- **THEN** o atual permanece 4 e o ajuste inicial é explicitado, sem perda silenciosa de pontos

### Requirement: Persistência e histórico integrados
Mudanças de inventário SHALL persistir no armazenamento do workspace e participar da sincronização existente. Equipar, desequipar, usar, editar e atualizar cópias SHALL ser operações de histórico que restauram em conjunto inventário e recursos afetados. Fichas vazias SHALL iniciar com inventário vazio. Conteúdo legado inválido ou versão futura MUST NOT ser sobrescrito silenciosamente: a interface SHALL informar a incompatibilidade e preservar os dados.

#### Scenario: Desfazer troca de proteção
- **WHEN** o usuário desfaz uma troca que reduziu PR atual
- **THEN** equipamento, mochila e PR retornam juntos ao estado anterior

#### Scenario: Reabrir em outro dispositivo após sincronização
- **WHEN** uma ficha atualizada é recebida pela sincronização em versão compatível
- **THEN** suas posses, posições, quantidades e equipamentos são restaurados sem depender da disponibilidade do catálogo de origem

#### Scenario: Inventário não reconhecido
- **WHEN** a ficha contém inventário com formato desconhecido
- **THEN** o conteúdo original é mantido e a edição de inventário fica indisponível com mensagem explicativa
