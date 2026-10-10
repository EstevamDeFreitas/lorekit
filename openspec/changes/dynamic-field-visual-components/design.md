## Context

O frontend ja persiste definicoes de `DynamicField` e valores de entidade como texto, usando `options` para configuracoes simples. O catalogo converte cada tipo dinamico em um controle e `EntityConfiguredFieldsComponent` concentra a renderizacao e o salvamento dos valores no layout configuravel. Nao ha dependencia de graficos instalada.

## Goals / Non-Goals

**Goals:**

- Manter o contrato de persistencia existente e armazenar as novas configuracoes como JSON versionado em `DynamicField.options`.
- Centralizar parsing, normalizacao e valores padrao em utilitarios compartilhados para evitar que editor e renderizador interpretem formatos diferentes.
- Reutilizar o mecanismo atual de debounce, layout, templates e portabilidade.
- Renderizar os tres graficos com SVG nativo, acessivel e responsivo.

**Non-Goals:**

- Multiplas series, dados vindos de colecoes relacionadas ou mapeamento de outros campos.
- Graficos de pizza, area, dispersao ou editor visual completo.
- Colunas de entidade relacionada ou selecao dentro da Listagem.

## Decisions

- **Configuracao discriminada em JSON:** `options` recebe um documento com `version` e `kind`, mantendo texto/opcoes/imagem legados intactos. O Slider guarda limites; a Listagem guarda modo e colunas; o Grafico guarda tipo e estilo. Os valores por entidade continuam em `DynamicFieldValue.value` como JSON.
- **Valores separados por tipo:** Slider usa `{ value }`; Listagem usa `{ items }`; Grafico usa `{ labels, values }`. Isso permite evoluir cada editor sem alterar o schema SQLite ou o relacionamento existente.
- **Componentes Angular dedicados:** criar componentes pequenos para Slider, Listagem e Grafico e um utilitario de modelos/normalizacao. O componente de entidade apenas escolhe o componente, encaminha o valor e salva mudanças.
- **SVG sem biblioteca:** desenhar Radar, Barra e Linha diretamente evita nova dependencia, reduz bundle e combina com os componentes SVG existentes. O componente calcula escalas, grade, labels e pontos a partir de uma serie normalizada.
- **Editor de definicao incremental:** o editor de layout continua criando e editando `DynamicField`, mas mostra controles especificos apenas para o tipo selecionado. Mudancas de tipo removem somente configuracoes incompatíveis; o valor da entidade nao e apagado automaticamente.
- **Portabilidade estrita:** exportacao continua transportando `options` como string; importacao valida o tipo e a configuracao JSON antes de criar/reutilizar o campo. Tipos existentes permanecem aceitos.

## Risks / Trade-offs

- [Risco] `options` e uma coluna textual sem schema formal → Mitigacao: parser versionado com defaults, limites e mensagens de erro; configuracoes invalidas retornam ao default do tipo.
- [Risco] SVG pode ficar ilegivel com muitos labels → Mitigacao: limitar a quantidade de pontos na primeira versao, truncar labels visualmente e fornecer `aria-label`/tabela textual resumida.
- [Risco] Listagens e graficos aumentam o tamanho do valor salvo → Mitigacao: persistir somente JSON compacto por entidade, sem duplicar a definicao do campo.
- [Risco] Alterar o tipo de um campo existente pode deixar valores incompatíveis → Mitigacao: manter o valor bruto, exibir estado vazio/normalizado e permitir que o usuario substitua o conteudo pelo editor do novo tipo.

## Migration Plan

1. Publicar o frontend com os novos parsers e controles; nenhum migration SQL e necessario.
2. Manter os tipos existentes e documentos de portabilidade legados aceitos durante toda a atualizacao.
3. Se uma configuracao nova for invalida, usar defaults seguros e permitir reconfiguracao pelo editor; nao remover valores persistidos.
