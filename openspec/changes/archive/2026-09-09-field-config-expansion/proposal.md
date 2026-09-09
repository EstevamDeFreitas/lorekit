## Why

Os layouts de campos das entidades hoje estão limitados a um único grid sob uma aba fixa e são renderizados por sete componentes específicos com lógica amplamente duplicada. Expandir o editor com organização visual, cores e múltiplas abas exige primeiro estabelecer um modelo mais expressivo e uma renderização única e consistente para todas as entidades.

## What Changes

- Evoluir o layout de campos para conter múltiplas abas nomeadas e ordenadas dentro de um mesmo template.
- Exibir as abas configuradas no mesmo nível das abas fixas da entidade, substituindo a aba fixa "Propriedades" pelo nome de cada aba do layout.
- Adicionar ao grid elementos separadores horizontais e verticais, com label opcional centralizado e rotacionado no separador vertical.
- Permitir configurar uma cor hexadecimal opcional em campos e separadores, usando a mesma paleta e seleção de cor personalizada do editor de texto; em campos, a cor será aplicada como destaque de label/borda, sem preencher o fundo do controle.
- Substituir os componentes de campos configurados específicos de Character, Culture, Location, Object, Organization, Species e World por um único componente genérico orientado pelo catálogo de metadados.
- Tornar o catálogo explícito sobre o tipo de controle de cada campo nativo para que o componente genérico possa renderizar inputs, textareas e editores sem regras específicas por entidade.
- Preservar layouts existentes convertendo o payload anterior em uma aba única durante a leitura e atualizar a importação/exportação para aceitar o formato anterior e emitir o novo formato.

## Capabilities

### New Capabilities

- `field-layout-configuration`: Configuração, resolução, portabilidade e renderização uniforme de layouts de campos com abas, separadores e destaques de cor.

### Modified Capabilities

- Nenhuma.

## Impact

- Modelos e serviços de `UiFieldConfig` e `UiFieldTemplate`, incluindo defaults e resolução por escopo.
- Editor visual de layouts de campos e fluxo de criação/edição de templates.
- Importação, exportação e validação de documentos portáveis de layout.
- Páginas de edição de Character, Culture, Location, Object, Organization, Species e World.
- Remoção dos sete renderizadores `*-configured-fields` em favor de um componente compartilhado.
- Extração de um seletor hexadecimal reutilizável a partir das paletas já usadas pelo editor de texto.
- Testes de migração, resolução, portabilidade, edição e renderização do layout genérico.
