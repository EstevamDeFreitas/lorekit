## Why

A ficha Ironpaw atualmente mantém dados derivados de vocação e espécie separados da ficha do personagem. Isso deixa a ficha inconsistente com as regras do sistema: a tela de vocação permite configurar valores de atributo que não deveriam existir, espécies sem configuração Ironpaw não podem ser escolhidas, e perícias, percepções e vida não são recalculadas de forma previsível quando a vocação ou espécie muda.

Esta mudança centraliza a aplicação dessas regras na ficha, mantendo os ajustes manuais do jogador depois que os valores iniciais forem calculados.

## What Changes

- Remover da tela de vocação a configuração de valores numéricos de atributos, mantendo apenas os níveis das perícias.
- Aplicar a vocação selecionada na ficha como origem dos níveis mínimos das perícias.
- Ao trocar a vocação, limpar os níveis atuais das perícias e reaplicar os níveis mínimos da nova vocação; permitir aumentos manuais posteriores, mas impedir valores abaixo do mínimo da vocação.
- Exibir um indicador pequeno quando uma perícia estiver exatamente no mínimo fornecido pela vocação.
- Permitir selecionar qualquer espécie do mundo na ficha; criar automaticamente uma configuração IRPW vazia quando a espécie ainda não tiver configuração.
- Ao trocar a espécie, preservar as perícias existentes, substituir a base das percepções pelos valores da nova espécie e recalcular a vida.
- Exibir um indicador pequeno para percepções herdadas da espécie e permitir que o jogador as aumente manualmente.
- Recalcular a vida máxima somente quando a vocação ou espécie for alterada, usando `1 + vida da vocação + vida da espécie`, sem impedir edição manual posterior.
- Disponibilizar a configuração da vocação em um modal dentro da ficha, seguindo o padrão já usado para configurar espécies Ironpaw.
- Adicionar à tela de personagem um botão que abra a ficha Ironpaw correspondente em uma nova guia do workspace.
- Manter a configuração Ironpaw acessível pela tela de espécie por meio do botão existente.

## Capabilities

### New Capabilities

- `ironpaw-character-sheet-integration`: Integração entre ficha, vocação e espécie Ironpaw, incluindo aplicação de valores derivados, indicadores, configuração em modal e abertura em nova guia.

### Modified Capabilities

Nenhuma capacidade existente possui requisitos Ironpaw equivalentes; a mudança será descrita como uma nova capacidade.

## Impact

- Afeta os componentes Angular da tela de vocações, ficha Ironpaw, edição de personagem e configuração Ironpaw de espécie.
- Afeta os modelos e serviços que serializam configurações de vocação, espécie e ficha.
- Pode exigir normalização de dados antigos de vocações que ainda contenham valores de atributos.
- Usa os serviços de relacionamento de personagens, o `TabManagerService` e os modais Angular CDK já existentes.
- Não altera as entidades genéricas de personagem, espécie ou vocação fora dos vínculos e dados específicos do Ironpaw.
