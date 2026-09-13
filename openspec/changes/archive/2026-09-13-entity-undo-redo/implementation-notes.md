## Inventário de campos

| Superfície | Identidade do histórico | Campos participantes |
| --- | --- | --- |
| Mundo | World + ID | Nome, descrição e campos configurados |
| Personagem | Character + ID | Nome, background e campos configurados |
| Documento | Document + ID | Título e conteúdo |
| Espécie | Species + ID | Nome, descrição e campos configurados |
| Localidade, cultura e organização | Location / Culture / Organization + ID | Nome, descrição e campos configurados |
| Objeto | Object + ID | Nome, properties, history e campos configurados; o sufixo de upload `_history` não faz parte da identidade |
| Timeline | Timeline + ID | Nome, unidade de tempo e descrição |
| Evento, grande marco e era existentes | Event / GreatMark / Age + ID | Nome, descrição e data textual quando presente |
| Campos configurados | Entidade proprietária + ID | Chave do schema ou ID do template dinâmico; o ID de DynamicFieldValue não substitui o dono |
| Moodboard | Moodboard + ID | Nome e texto/legenda dos itens; o destino de persistência do item é MoodboardItem.configJson.text |
| Documento incorporado em moodboard | Document + ID | Conteúdo do documento referenciado, com contexto aninhado próprio |
| Ficha | IRPWCharacterSheet + ID do personagem | Subespecializações e habilidades textuais; caminhos individuais de nome, descrição e tipo narrativo em marcos, habilidades e fraquezas |
| Vocação | IRPWVocation + ID | Nome, descrição, passiva e habilidades textuais |

Os arrays de subespecializações e habilidades exclusivamente textuais são capturados como o campo serializado correspondente; marcos, que também contêm atributos numéricos, usam caminhos individuais para não restaurar atributos antigos. Alterações estruturais nos marcos invalidam as etapas incompatíveis antes de alterar seus índices.

Busca, filtros, campos numéricos explícitos, criação de entidades e formulários de configuração permanecem fora do contexto de histórico. `DynamicFieldsComponent` legado não tem pontos de uso renderizados; a superfície atual usa `EntityConfiguredFieldsComponent`.

## Validação

- Serviço: 10 cenários aprovados na primeira execução, incluindo isolamento, ordem assíncrona, agrupamento, conteúdo externo e falha de persistência.
- Integração inicial: 5 cenários aprovados com SQLite isolado, controles Angular e instâncias reais de Editor.js/Tiptap; abrangem atalhos/botões, composição e reabertura de editor.
- Build de produção aprovado após integração das páginas. A verificação final e a inspeção visual serão registradas após concluídas.
