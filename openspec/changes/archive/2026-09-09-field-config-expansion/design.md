## Context

O layout atual é um payload JSON v1 com `columns`, `rowHeight` e um único `items[]`. `UiFieldConfigService` resolve uma configuração por escopo e retorna somente esse payload; `UiFieldTemplate.name` fica fora dele. O editor e o serviço de portabilidade assumem um único array de itens.

Sete componentes `*-configured-fields` repetem grid, resolução do layout, carregamento e salvamento de campos dinâmicos. Character, Culture, Species e World acrescentam switches próprios para campos nativos; Location, Object e Organization renderizam apenas campos dinâmicos. O catálogo atual distingue principalmente origem e `isEditorField`, mas não descreve suficientemente controles como textarea.

O banco já armazena configurações e templates como JSON textual, portanto a expansão não exige novas tabelas ou colunas. Consulte `proposal.md` para motivação e `specs/field-layout-configuration/spec.md` para o contrato de comportamento.

## Goals / Non-Goals

**Goals:**

- Definir uma representação versionada capaz de armazenar abas e diferentes tipos de item.
- Centralizar normalização, validação e resolução dos layouts.
- Renderizar campos nativos e dinâmicos por metadados em um único componente compartilhado.
- Manter as páginas de edição responsáveis pela composição de suas abas fixas e pelo salvamento da entidade.
- Evitar migração destrutiva ou reescrita antecipada das configurações existentes.

**Non-Goals:**

- Transformar campos nativos em registros de `DynamicField`.
- Permitir que uma entidade combine vários templates independentes ao mesmo tempo.
- Aplicar a cor configurada como fundo completo de inputs, textareas, combos ou editores.
- Generalizar toda a estrutura das páginas de edição; apenas a área de campos configuráveis será compartilhada.
- Alterar a precedência atual dos escopos de configuração.

## Decisions

### 1. Um template representa um conjunto de abas

O payload v2 manterá `columns` e `rowHeight` compartilhados e substituirá `items[]` por `tabs[]`. Cada aba terá `id`, `name` e `items` ordenados pelo posicionamento do grid.

Isso mantém template, herança por pai e override por entidade como unidades atômicas. A alternativa de associar vários `UiFieldTemplate` a uma entidade exigiria uma nova composição persistida, regras de precedência por aba e resolução de conflitos entre templates.

### 2. Itens serão uma união discriminada com identidade própria

Cada item terá `id`, `kind`, posição e tamanho. Itens `field` terão `token` e `color?`; itens `separator` terão `orientation`, `label?` e `color?`.

O `id` deixa o tracking e as operações de edição independentes do token. Tokens de campo continuarão únicos no template inteiro, enquanto múltiplos separadores poderão coexistir. Prefixos de token artificiais para separadores foram descartados porque misturariam elementos visuais ao catálogo de dados e manteriam a limitação de identidade atual.

### 3. Normalização central aceitará payloads v1 e v2

O serviço de configuração terá uma fronteira única de parsing, validação e normalização. Um payload v1 será convertido em memória para v2 com uma aba. Quando houver template resolvido, seu nome será fornecido ao normalizador; nos demais casos será usado "Propriedades". Apenas um salvamento explícito persistirá o formato v2.

O resultado resolvido deverá conservar metadados suficientes sobre a origem para que a normalização conheça o nome do template sem acoplar a UI a consultas adicionais. Defaults do sistema passarão a ser declarados diretamente em v2.

Esta estratégia evita uma migração em massa durante a inicialização. A alternativa de atualizar todos os JSONs no banco imediatamente aumentaria o risco de perda de configuração e dificultaria rollback.

### 4. Um componente genérico renderizará todas as áreas configuráveis

Será criado um componente compartilhado de campos configuráveis que receberá, no mínimo, `entityTable`, a entidade, o layout resolvido e o identificador da aba ativa. Ele emitirá alterações de propriedades nativas e pedidos de salvamento para a página hospedeira, enquanto encapsulará o ciclo de vida e a persistência dos campos dinâmicos.

O componente tratará grid, separadores, estilos, input, textarea, editor rico, options, entity e image. Os sete componentes específicos existentes serão removidos depois que todas as páginas forem migradas.

Usar herança entre os sete componentes foi descartado porque reduziria apenas duplicação de TypeScript, mantendo templates e estilos repetidos. Renderizadores específicos projetados via content projection também foram descartados porque o conjunto conhecido de controles pode ser descrito integralmente por metadados.

### 5. O catálogo declarará explicitamente o controle do campo

`UiFieldCatalogItem` ganhará um tipo de controle explícito, como `input`, `textarea`, `editor`, `options`, `entity` ou `image`. Campos nativos usarão esse metadado junto de `key`; campos dinâmicos serão normalizados para a mesma abstração antes da renderização.

O componente acessará propriedades nativas somente para chaves presentes no catálogo da `entityTable`. Alterações serão emitidas como `{ key, value }`, evitando branches por classe de entidade dentro do componente. A página aplicará a alteração e acionará seu serviço de salvamento existente.

### 6. As páginas de edição comporão abas fixas e configuradas

Cada página obterá o layout resolvido, renderizará seus botões configurados no mesmo contêiner dos botões fixos e usará identificadores de navegação com namespace, por exemplo `layout:<tabId>`, para não colidir com ids como `backstory`.

O componente genérico receberá a aba selecionada e renderizará somente seus itens. `CurrentEntityPageStateService` continuará armazenando a seleção por entidade; se o id salvo não existir mais, a página escolherá a primeira aba configurada. Rótulos poderão coincidir visualmente com abas fixas, mas ids não; o editor exigirá unicidade apenas entre abas do template.

Manter abas de layout aninhadas dentro de uma aba externa "Propriedades" foi descartado por contrariar o comportamento confirmado.

### 7. O seletor hexadecimal será compartilhado

A interface de paletas e cor personalizada hoje embutida no editor de texto será extraída para um componente reutilizável baseado nas constantes hexadecimais existentes. Editor e configurador usarão esse componente para impedir divergência de opções e validação.

Nos campos, a cor será exposta por uma custom property ou binding no contêiner e aplicada a label e borda de destaque. Separadores usarão a mesma cor na linha e no label. Ausência de cor preservará o estilo atual.

### 8. Portabilidade terá versão nova e leitura retrocompatível

O formato portátil será incrementado para representar `tabs[]` e a união de itens. A exportação percorrerá campos de todas as abas, trocará ids locais de campos dinâmicos por chaves portáveis e ignorará separadores na coleta de definições dinâmicas.

O parser aceitará tanto a versão anterior quanto a nova, normalizando ambas antes da validação. A validação verificará ids e nomes de abas, unicidade global de tokens de campo, limites do grid, propriedades específicas por tipo, cores hexadecimais e referências dinâmicas. A fase de preparação permanecerá sem escritas; criação de campos e salvamento ocorrerão somente após validação completa e confirmação do destino.

## Risks / Trade-offs

- [Payload v2 salvo não será compreendido por versões antigas do aplicativo] -> Não reescrever layouts automaticamente; documentar que rollback do aplicativo após salvar layouts v2 exige restaurar um backup compatível do banco.
- [Acesso genérico a propriedades reduz parte da verificação estática por entidade] -> Restringir chaves ao catálogo tipado, validar o catálogo e concentrar leitura/escrita em helpers testados.
- [Abas configuradas variam conforme o escopo resolvido e podem invalidar a seleção atual] -> Usar ids estáveis com namespace e fallback determinístico para a primeira aba existente.
- [Editar o mesmo campo em várias abas criaria controles concorrentes] -> Impor unicidade de token no template inteiro e exigir remoção antes de mover o campo.
- [Componente compartilhado aumenta seu número de responsabilidades] -> Separar normalização de metadados, persistência dinâmica, seletor de cor e apresentação de separador em serviços ou componentes focados, mantendo um único host público.
- [Migração simultânea das sete telas pode causar regressões específicas] -> Migrar e testar entidade por entidade antes de remover os componentes antigos; comparar defaults e controles nativos durante cada migração.

## Migration Plan

1. Introduzir tipos v2, normalizador retrocompatível e validação sem alterar os renderizadores existentes.
2. Atualizar defaults, editor visual e portabilidade para trabalhar com a representação normalizada.
3. Criar o seletor de cor e os renderizadores compartilhados de item.
4. Criar o componente genérico e validar todos os tipos de campo dinâmico e nativo.
5. Migrar as sete páginas de edição, preservando suas abas fixas e seus fluxos de salvamento.
6. Remover os componentes específicos somente após todos os consumidores e testes terem sido migrados.

Rollback de código é possível enquanto nenhum layout v2 tiver sido salvo. Depois disso, a aplicação anterior poderá cair no layout padrão ao ler o novo JSON; o rollback seguro dependerá de restaurar um backup do banco anterior ao salvamento em v2.
