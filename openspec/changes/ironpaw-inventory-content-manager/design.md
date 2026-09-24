## Context

Ver `proposal.md` para motivação. O projeto usa Angular, SQLite via sql.js, persistência desktop/browser, workspace com abas, histórico e sincronização por registro. A aba de inventário e os componentes de catálogo/configuração de itens são placeholders. Existem `Item(id, name, description, concept)`, `IRPWItem(id, effects)` e `IRPWCharacterSheet.inventory` como texto. `defensepoints` guarda atualmente apenas `currentPoints`. `Item`, `IRPWItem` e a ficha já constam nos registros de entidades sincronizáveis do cliente e servidor.

Os requisitos são definidos nas três specs desta mudança. A referência de domínio é `Sistema Ironpaw (1).md`, fornecido pelo usuário. As regras de proteção contêm uma ambiguidade entre redução fixa com PR zerado e redução passiva pela metade. Essa entrega exibe o texto de efeito, sem resolver dano. As escolhas de grid expansível, espaços de equipamento e ocupação configurável das mãos são convenções de produto, não novas regras canônicas de Ironpaw.

## Goals / Non-Goals

**Goals:**
- Manter catálogo reutilizável e cópias de personagem independentes, inclusive quando a origem não estiver disponível.
- Conservar inventário e consequências em PR em uma operação de histórico/persistência.
- Reaproveitar infraestrutura de banco, imagens e workspace, com contratos tipados e versionados.
- Separar validação pura, planejamento de importação e aplicação persistente para poder testar falhas sem interface.

**Non-Goals:**
- Motor geral de efeitos, combate, rolagens automáticas, condições automáticas e resolução de dano.
- Inventário com formas geométricas, encumbrance, moeda, compra/venda, fabricação e transferência entre personagens.
- Migração para sincronização por posse individual ou gestão de vocações/espécies dentro do novo gerenciador.
- Recuperação automática de CV/PR ao usar consumíveis; o usuário lê o efeito e ajusta a ficha nesta entrega.

## Decisions

### 1. Catálogo sobre as entidades existentes

Usar `Item` para identidade/descritivo e estender `IRPWItem` como configuração 1:1. Novos registros usam `IRPWItem.id = Item.id`, seguindo o padrão de extensões Ironpaw. Não inferir associações de registros legados sem evidência: configurações órfãs permanecem preservadas e são diagnosticadas.

| Estrutura | Campos propostos / responsabilidade |
|---|---|
| `Item` | Campos existentes, sem redefinir o domínio de objetos do worldbuilding |
| `IRPWItem` | `id`, `effects` legado preservado, `definitionJson`, `portableId`, `revision`, `archived` |
| `definitionJson` v1 | Categoria, ícone, referências de imagem, etiquetas, raridade opcional, empilhamento, compatibilidade e dados discriminados por categoria |
| Definição de arma | Propriedades (`leve`, `pesada`, `alcance`, `recuo`, `tecnica`), múltiplos descritores de dano, propriedade particular, severidade opcional, `hands: 1 | 2` |
| Definição única | Flag independente da categoria, benefícios e contrapartidas textuais |
| `IRPWCharacterSheet.inventory` | Envelope v1 com `entries`, ordem da mochila e mapa dos doze espaços |
| `IRPWCharacterSheet.defensepoints` | Envelope v2 com atual, ajuste manual e referência da contribuição de vocação aplicada |

`portableId` é um UUID de compartilhamento independente do id local; `revision` permite rastrear mudanças, mas igualdade usa conteúdo canônico. Arquivar preserva as referências. Catálogo inicialmente abrange o workspace/vault atual, como as vocações, sem introduzir vinculação obrigatória a mundo.

Alternativa: nova família de tabelas de catálogo e posses. Rejeitada nesta entrega por duplicar entidades existentes e ampliar migração/sync. A configuração discriminada evita um formulário universal repleto de campos vazios; novas versões futuras exigirão validadores e migrações explícitos.

### 2. Snapshots de posse dentro da ficha

Cada entrada contém `instanceId`, `sourcePortableId`, `sourceRevision`, snapshot completo do nome/descrição/configuração, quantidade e anotações. A referência local da origem é opcional e nunca necessária para renderizar. O mapa de equipamentos referencia `instanceId`; a primária de duas mãos bloqueia a secundária por estado derivado, sem duplicar a entrada. Arco/reserva é armazenamento, ativado por comando explícito para primária.

Snapshots usam referências de imagens gerenciadas pelo workspace. Limpeza de assets deve considerar as referências dos snapshots, inclusive histórico, para não apagar imagens ainda utilizadas. Itens arquivados permanecem disponíveis como origem consultável.

Comandos puros validam invariantes (quantidade, localização única, compatibilidade, bloqueio das mãos), produzindo estado anterior/próximo. A persistência aplica inventário e PR juntos; o histórico registra uma única operação. Dividir pilha cria identidade nova; combinar usa equivalência canônica de origem, snapshot e anotações. Equipar uma unidade separa a pilha. Remover a última unidade elimina referências; filtros trabalham sobre projeção da ordem, sem substituir o conjunto completo.

Atualizar do catálogo exibe diff, preserva quantidade/anotações e valida o snapshot novo. Se houver incompatibilidade, o item retorna à mochila. Caso o novo limite diminua, a atualização divide quantidades em pilhas válidas, preservando o total. Alterar para não empilhável cria entradas unitárias.

Alternativa: referência viva ao catálogo. Rejeitada porque alterações compartilhadas afetariam personagens sem revisão. JSON na ficha mantém a operação simples e atômica; aceita-se a granularidade atual de conflitos por registro, sem prometer merge por item.

### 3. PR como contribuição derivada e estado gasto

Calcular `max = max(0, vocationContribution + protectionContribution + manualAdjustment)`. A proteção principal é exclusivamente o espaço armadura, com leve/média/pesada = 1/2/3. Roupas nesse espaço sem categoria proteção contribuem zero. Capacete, luvas, botas e calças não adicionam PR padrão. Valores da vocação são lidos pelo mesmo critério de resolução usado na ficha; na ausência de contribuição válida, usar zero.

A contribuição da vocação é aplicada na seleção/troca explícita da vocação e armazenada como referência da ficha; editar a definição da vocação isoladamente não altera essa referência. A primeira conversão usa a vocação atual. Ajuste manual permanece editável e identificado. Mudanças de equipamento e vocação recalculam máximo, preservam atual e só o limitam para baixo. Aumentar máximo nunca recupera atual. Nulo permanece não preenchido até interação explícita.

Na conversão legada, para PR atual numérico `p`, estabelecer `manualAdjustment = max(0, p - vocationContribution - protectionContribution)`, mantendo `p`; exibir aviso informativo da conversão. Não reexecutar essa conversão após existir versão v2. Dados inválidos são preservados e diagnosticados, sem substituição por defaults destrutivos.

Alternativa: somar proteção diretamente em `currentPoints`. Rejeitada por permitir recuperação repetida ao reequipar. A folha distingue modificador de recurso disponível. Redução de dano, +1 contextual e penalidades são descritos em painel de efeitos; nenhuma regra ambígua é codificada como automação.

### 4. Navegação e composição visual

Adicionar seção `content-manager` após vocações no shell/sidebar e registrá-la como view do workspace, além da rota existente. Reabrir foca a aba. Separar componentes de lista, editor, prévia de importação, grid, equipamento e detalhe para não expandir o componente monolítico da ficha. Usar templates/estilos separados, signals, formulários reativos e OnPush conforme convenções do projeto.

```text
Gerenciador de Conteudo
+----------------------+--------------------------------------+
| Buscar / categorias  | Nome do item       [Salvar] [Arquivar] |
| Itens do catalogo    | Campos comuns e especificos           |
| [+ Novo]             | Previa do cartao / efeitos            |
| [Importar][Exportar] |                                      |
+----------------------+--------------------------------------+

Ficha / Inventario
+----------------------+--------------------------------------+
|      Capacete        | Buscar / filtros / adicionar         |
| Luvas     Armadura   | [Item] [Pilha x3] [Item] [Item]       |
|       Calcas         | [Item] [        ] [    ] [    ]       |
|       Botas          |                                      |
| Primaria Secundaria  | Detalhes / equipar / usar / editar   |
| Arco ou reserva      |                                      |
+----------------------+--------------------------------------+
```

Grid responsivo de células uniformes, sem ocupação x/y persistida. Ordem ordinal torna a reorganização estável entre larguras diferentes. Em tela estreita, equipamentos precedem mochila e detalhes; ações não dependem de hover. Raridade usa texto e cor opcionais, sem codificar poder. Comandos acessíveis oferecem equipar, desequipar e mover antes/depois. Drag-and-drop usa a infraestrutura disponível no projeto, sem nova dependência obrigatória.

### 5. Pacote portável próprio com identidade estável

Envelope: `format: lorekit-ironpaw-items`, `version: 1`, `system: ironpaw`, `package: { id, name }`, `items`, `assets`. `items` usa `portableId`, revisão e definição completa, incluindo nome/descrição; assets são identificados por hash do conteúdo e transportam MIME/base64. Referências internas apontam para chaves portáveis, nunca IDs de banco ou caminhos locais. Reexportar preserva identidades de itens; duplicar ou importar como cópia gera identidade nova.

Usar igualdade canônica de todos os dados portáveis, normalizando ordem de conjuntos e referências de imagem por hash; revisão sozinha não representa igualdade. Nomes repetidos são permitidos. Comparar por `portableId` para classificar novo/equivalente/conflitante. Atualizações de itens arquivados preservam seu estado local de arquivamento; o pacote não publica estado de arquivamento. Exportar tudo significa catálogo ativo; seleção explícita pode incluir arquivados.

Arquivo e texto usam o mesmo parser. Limites iniciais: 20 MiB de JSON UTF-8, 500 itens, 2 MiB por imagem decodificada e 10 MiB de imagens decodificadas no total. Aceitar PNG, JPEG e WebP verificando assinatura, decodificação e dimensões até 4096 x 4096; recusar SVG, recursos remotos, referências ausentes e chaves duplicadas. Gerar identificadores/caminhos locais internamente. Exibir erro antes de qualquer mutação. Sem imagens por falha de leitura somente mediante escolha explícita, preservando ícone fallback.

Alternativa: reutilizar o contrato de layouts. Rejeitada por misturar entidades e regras de conflito diferentes; reutilizar apenas a experiência de selecionar/colar, validar, revisar e aplicar.

### 6. Unidade transacional de importação

Construir plano imutável de importação com fingerprints dos registros de destino e escolhas de conflito. Ao aplicar, adquirir a coordenação de escrita do workspace, revalidar fingerprints e preparar imagens em staging. Criar/atualizar `Item`, `IRPWItem`, referências de imagens e registros de sync em uma unidade de banco; impedir flush intermediário e publicação de outbox até sucesso da persistência.

Tratar disco/blob e SQLite como recursos distintos: staging primeiro; somente assets completos recebem referências; persistência final deve ser atômica ou recuperável pelo adaptador. Falha restaura banco em memória e estado persistente anterior antes de liberar escrita/sync. Remover apenas assets novos sem referências. Para encerramento inesperado, usar marcador de operação e recuperação ao abrir workspace: descartar staging incompleto ou concluir a limpeza de operação já confirmada. Não substituir esse fluxo por vários CRUDs que persistem individualmente.

A implementação deve verificar os contratos de transação/persistência existentes antes de estendê-los. As extensões ficam limitadas à unidade de importação e aos comandos compostos da ficha. Testes de falha comprovam ausência de dados parciais e de notificações prematuras.

## Risks / Trade-offs

- [Ficha inteira como unidade de sync] -> Preservar mecanismo existente de resolução de conflitos; documentar que edições simultâneas não fazem merge por item. Testar sincronização do envelope em cliente compatível.
- [Cópias aumentam dados] -> Não embutir bytes de imagens em cada snapshot; compartilhar assets e guardar JSON textual moderado.
- [Efeitos narrativos confundidos com automação] -> Identificar efeitos descritivos e contribuição calculada separadamente na interface.
- [Estados legados inesperados] -> Conversores versionados, preservação dos campos originais e diagnóstico; não interpretar texto arbitrário como inventário válido.
- [Persistência multi-recurso] -> Staging, coordenação de escrita, recuperação e testes de falha em desktop/browser.
- [Clientes antigos escrevendo definições novas] -> Validar ida/volta com campos adicionais, atualizar triggers e metadados necessários; não prometer compatibilidade de edição com versões anteriores. Orientar uso de versões compatíveis nos dispositivos sincronizados.
- [PR derivado depende de interpretação de proteção] -> Somente bônus explícito de PR é automático; redução pela metade fica descritiva e não bloqueia esta entrega.

## Migration Plan

1. Acrescentar migração à próxima versão local disponível, sem assumir que a versão observada continuará atual. Adicionar campos a `IRPWItem`, índice de identidade portável e atualizar triggers que serializam colunas. Verificar allowlist/versionamento cliente-servidor e compatibilidade de payload.
2. Preservar `effects` legado; não preencher definição inválida automaticamente. Registros com associação comprovada podem ser apresentados para configuração; órfãos recebem diagnóstico sem remoção. A migração deve ser idempotente.
3. Interpretar inventário nulo/vazio como v1 vazio, persistindo apenas ao salvar uma operação. Inventário não reconhecido bloqueia edição somente dessa seção e mantém bytes originais.
4. Converter PR legados uma única vez na gravação explícita da ficha, preservando atual e dados alheios à mudança; integrar novos campos às operações de histórico/restauração.
5. Validar fixtures de bancos anteriores, reinício, importação com falha, round-trip de pacotes e sync. Não incluir catálogo fictício obrigatório nem importar o arquivo de regras como dados executáveis.
6. Antes da migração, usar mecanismo de backup do workspace. Rollback completo exige restaurar backup coerente de banco/assets e versão do aplicativo; downgrade isolado não deve apagar ou reinterpretar envelopes novos. Não realizar migração destrutiva reversa automática.
