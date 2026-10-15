# Proposal

## Why

O Lorekit representa cronologias por posições numéricas e datas em texto livre, sem regras compartilhadas para validar datas de mundos fictícios. Calendários configuráveis permitirão organizar eventos, navegar do século ao dia e reutilizar datas coerentes nas entidades do mundo.

## What Changes

- Permitir vários calendários independentes por mundo, reutilizáveis por várias timelines do mesmo mundo.
- Configurar meses e dias, semanas e nomes dos dias; calcular o total do ano a partir da estrutura e permitir anos sem meses.
- Configurar horas por dia, minutos por hora, segundos por minuto e duração opcional do dia em tempo terrestre, com rótulos próprios para as três unidades.
- Introduzir Contagem dos anos e Marcos de referência, com nomes e abreviações antes/depois, ano zero opcional e múltiplas contagens por calendário.
- Construir formatos curto e narrativo com prévia, incluindo nomes de meses, ordinais e contagem dos anos.
- Configurar estações como intervalos anuais recorrentes, inclusive atravessando a virada do ano.
- Vincular opcionalmente timelines a calendários; oferecer escalas de séculos, décadas, anos, meses, semanas e dias e datas estruturadas para eventos e grandes marcos, com precisão parcial e horário opcional.
- Revisar e confirmar a interpretação das posições antigas e a transformação das eras existentes ao vincular um calendário; preservar períodos narrativos sobrepostos e conteúdo original.
- Adicionar o campo dinâmico Data do calendário e resolver suas referências na importação de layouts.
- Planejar as novas telas com Impeccable, preservando os padrões visuais do Lorekit e oferecendo prévia, validação contextual, teclado e configurações progressivas.
- Preservar cronologias sem calendário e proteger datas existentes ao alterar regras estruturais, trocar calendários ou excluir calendários utilizados.

## Capabilities

### New Capabilities

- `world-calendars`: Calendários por mundo, regras de datas e relógio, contagem dos anos, formatos, estações e edição segura.
- `calendar-timelines`: Vinculação de calendários, migração de cronologias e eras, eventos datados e navegação por escalas temporais.
- `calendar-date-fields`: Campo dinâmico de data com calendário, precisão e horário opcionais.

### Modified Capabilities

- `field-layout-portability`: Transporte e associação explícita de referências a calendários em definições de campos, sem depender de IDs locais.

## Impact

- Frontend Angular: novos modelos, serviços, motor de calendário, páginas e seletor compartilhado; integração com timelines, marcos, eventos, campos configuráveis e navegação do workspace.
- SQLite local: migrações aditivas, novas entidades e referências, preservação de registros legados e transações para conversões.
- Sincronização opcional: registro de entidades, allowlist e schema do servidor, com contratos versionados compatíveis.
- Portabilidade de layouts: evolução retrocompatível do documento e resolução de dependências de calendário no mundo de destino.
- Sem dependência de serviço online para cálculos ou edição. Não inclui conversão automática entre calendários, ciclos lunares, feriados, dias intercalares, anos bissextos ou reformas históricas; a estrutura versionada permitirá essas evoluções.


## Refinamento solicitado durante a implementação

O montador de formatos também permite reordenar partes e inserir textos condicionais por comparações declarativas de componentes da data. O usuário pode combinar condições por E/OU e definir resultados verdadeiro, falso e informação desconhecida, sem executar código. Esta extensão mantém o escopo de apresentação e não muda as coordenadas das datas.
