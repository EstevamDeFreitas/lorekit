## Why

O Lorekit permite criar campos dinamicos basicos, mas ainda nao oferece controles numericos, colecoes estruturadas ou visualizacoes configuraveis dentro das fichas de entidades. Isso limita a representacao de listas, escalas e analises como comparacoes multidimensionais (Radar), categorias (Barra) e series (Linha).

## What Changes

- Adicionar os tipos de campo dinamico `slider`, `list` e `chart`.
- Permitir que o Slider armazene valores numericos com minimo, maximo e passo configuraveis.
- Permitir Listagens em modo tabela, com colunas tipadas, ou modo headless, com itens simples ordenaveis.
- Permitir graficos Radar, Barra e Linha com titulo, legenda, cor e uma serie de dados manuais por registro.
- Adicionar editores de configuracao, componentes de edicao e renderizacao para os novos tipos.
- Preservar layouts, templates e exportacao/importacao de campos dinamicos existentes.

## Capabilities

### New Capabilities

- `dynamic-field-visual-components`: Controles numericos, listagens estruturadas e graficos configuraveis em campos dinamicos.

### Modified Capabilities

Nenhuma.

## Impact

- Modelos, catalogo, editor e renderizador de campos dinamicos no frontend Angular.
- Persistencia existente de `DynamicField` e `DynamicFieldValue`, usando configuracoes JSON compativeis com a coluna `options`.
- Portabilidade de layouts para validar e transportar as novas definicoes.
- Novo componente SVG nativo para Radar, Barra e Linha; nenhuma dependencia externa de graficos sera adicionada.
