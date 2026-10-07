---
target: lorekit-frontend\src\app\pages\timelines\timeline-edit
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
target_identity: "file:C:\\Users\\Estevam\\Documents\\Projetos\\lorekit\\lorekit-frontend\\src\\app\\pages\\timelines\\timeline-edit"
timestamp: 2026-10-07T22-10-44Z
slug: end-src-app-pages-timelines-timeline-edit-96407c16
---
Method: dual-agent (A: James · B: Franklin)

# Revisão de UX/UI — Timeline do Lorekit

## Saúde de design

| # | Heurística | Nota | Principal evidência |
|---|---|---:|---|
| 1 | Visibilidade do estado do sistema | 2/4 | Há carregamento visível, mas não há estado de salvamento, confirmação de arraste ou erro acionável. |
| 2 | Correspondência com o mundo real | 3/4 | A metáfora de eras, marcos e eventos funciona, mas os diálogos continuam falando em “ano” mesmo com unidade customizável. |
| 3 | Controle e liberdade | 2/4 | Voltar, cancelar e confirmar exclusão existem; falta desfazer para posicionamentos e recuperação de falhas. |
| 4 | Consistência e padrões | 2/4 | A lista e o canvas são coerentes, mas os diálogos têm padrões de salvamento e acessibilidade diferentes. |
| 5 | Prevenção de erros | 2/4 | Datas são normalizadas e exclusões confirmadas; nomes inválidos e associação de mundo podem falhar silenciosamente. |
| 6 | Reconhecimento em vez de memorização | 2/4 | Régua e estados vazios ajudam, mas regras de arraste, resize, snap e zoom ficam escondidas. |
| 7 | Flexibilidade e eficiência | 3/4 | Zoom, snap por modificadores, faixas, busca, filtros e nova aba são bons recursos; falta um caminho de teclado. |
| 8 | Estética e design minimalista | 3/4 | A composição é autoral, mas rótulos pequenos e ações somente por ícone aumentam a densidade. |
| 9 | Ajuda para reconhecer e recuperar erros | 1/4 | Não há feedback acionável para falhas de salvamento ou submissões inválidas. |
| 10 | Ajuda e documentação | 1/4 | Existe apenas uma dica curta; conceitos avançados não têm explicação contextual. |
| **Total** |  | **21/40** | **Aceitável, mas com lacunas importantes** |

## Especificidade visual

A tela é forte e específica do Lorekit: eixo dourado, bandas de eras, nós de marcos, cores personalizadas e imagens nos itens dão personalidade de worldbuilding. Não parece uma timeline genérica de projeto.

A coerência cai nos diálogos, que voltam a formulários genéricos. O editor também usa muitos RGB crus enquanto a lista usa tokens, e o acento amarelo não está totalmente alinhado ao restante do sistema visual.

## O que funciona

- A metáfora espacial traduz bem a construção de mundos: eras dão contexto, marcos pontuam a história e eventos ocupam a cronologia.
- Há recursos valiosos para uso avançado: zoom, snap por Ctrl/Shift, faixas verticais, pesquisa/filtro e abertura em nova aba.
- A lista tem bons estados vazios, CTA de criação, contagem, filtro por mundo, foco visível e adaptação básica para telas estreitas.

## Questões prioritárias

### [P1] Navegação vertical fica presa

Em `timeline-edit.component.ts:149`, o handler cancela a roda padrão e converte `deltaY` em `scrollLeft`. Com muitas faixas, o usuário não alcança os eventos inferiores naturalmente com a roda do mouse.

Preservar a rolagem vertical; usar Shift/roda horizontal para o eixo X, Ctrl+roda para zoom e auto-scroll ao arrastar perto das bordas. Expor também botões de zoom e “voltar ao conteúdo”.

### [P1] O canvas é dependente de ponteiro, hover e descoberta

Eras e eventos são `article` com `pointerdown`; o grande marco tem `role="button"` e `tabindex`, mas não tem teclado. Handles de 10–12px aparecem somente no hover. Tooltips também só aparecem no hover.

Oferecer foco, Enter/Espaço para abrir, setas para mover, Shift/Ctrl para passos, teclas para redimensionar, alvos maiores e uma lista acessível equivalente com os itens ordenados. A interação de clicar para abrir e arrastar para mover precisa ser distinguível.

### [P1] Salvamento e validação silenciosos

`saveTimeline()` agenda persistência debounced sem estado visível; nomes vazios simplesmente retornam. O fluxo de criação pode aceitar o overlay mesmo quando não há nome válido.

Mostrar “Salvando…”, “Alterações salvas” e erro com retry; manter o formulário aberto em estado inválido; marcar obrigatório; anunciar e selecionar a timeline recém-criada. Após arrastar, dar confirmação discreta e oferecer desfazer.

### [P1] Ciclo de exclusão e associação de mundo têm risco de inconsistência

Após excluir a timeline ativa, a mudança pode recarregar um registro inexistente; `loadTimeline()` dereferencia o resultado sem guarda. A lista não atualiza explicitamente ao fechar o diálogo de exclusão. Além disso, `createTimeline()` prioriza `selectedWorldId` sobre o mundo escolhido no formulário, podendo salvar a associação errada.

Tratar exclusão como transição de estado: fechar/voltar ao diretório, atualizar a lista e mostrar confirmação. Usar o valor enviado no formulário como autoridade ou bloquear claramente o campo herdado do filtro.

### [P1] A linguagem temporal não acompanha o modelo

A timeline aceita uma unidade customizada, mas os editores continuam usando “Início (ano)” e “Fim (ano)”. Tokens como `{AutoGenDate}` expõem implementação, não conceito de produto.

Usar a unidade configurada nos rótulos, separar “posição no eixo”, “intervalo” e “data exibida”, e trocar tokens por exemplos ou inserção guiada.

### [P2] Densidade, contraste e temas divergem

Textos `zinc-500` ficam abaixo do contraste AA em alguns fundos. Handles pequenos, textos truncados, labels diminutos e cinco ações icon-only no cabeçalho aumentam a carga cognitiva. O editor repete RGBs, não acompanha todos os tokens/variações de tema e não cobre `prefers-reduced-motion` como a lista.

Subir textos secundários para um token de maior contraste; usar ações nomeadas ou um menu “Adicionar”; criar tokens para o canvas; manter focus/hover/selected/disabled/loading; tratar redução de movimento também em tooltips e handles.

### [P2] Itens podem escapar da escala calculada

`refreshLayout()` considera eras e eventos para calcular o intervalo quando eles existem, ignorando grandes marcos fora desse intervalo. Incluir todos os tipos no cálculo e reposicionar a viewport após criar ou selecionar um item.

## Auditoria técnica

| Dimensão | Nota | Evidência |
|---|---:|---|
| Acessibilidade | 1/4 | Canvas pointer-first, labels/ARIA incompletos, combobox customizado sem semântica completa. |
| Performance | 2/4 | Animação de `width`, dupla carga inicial e cálculos de estilo/imagem no caminho de renderização. |
| Responsividade | 2/4 | Há breakpoints, mas handles são pequenos e o canvas exige teste de overflow/escala. |
| Theming | 2/4 | A lista usa tokens; o editor usa muitos RGBs e variantes incompletas. |
| Integridade da implementação | 2/4 | Sistema coerente, mas exclusão, associação de mundo e sincronização de eventos têm falhas verificáveis. |
| **Total** | **9/20** | **Fraco — corrigir P1 antes de polir** |

O detector `impeccable detect --json` encontrou 1 achado, sem erro: `layout-transition` em `timeline-list.component.css:22`, por animar `width .25s ease`. É intencional para recolher a barra lateral, mas causa reflow; a regra de movimento reduzido mitiga, não elimina o custo.

Achados técnicos adicionais verificados:

- Campos compartilhados e inputs de nome dos diálogos não têm associações de label confiáveis; botões de fechar/remover podem ficar sem nome acessível.
- O ComboBox customizado não expõe completamente `role=combobox`, `aria-expanded`, `aria-controls`, `role=option` e `aria-selected`.
- `isTimelineItemChange()` trata Timeline, Age e GreatMark, mas não Event.
- Listas usam `OnPush`/`@for` com tracking e listeners de ponteiro são limpos corretamente; rotas são lazy-loaded.

## Personas

**Alex — power user:** não tem atalhos para edição, não alcança faixas inferiores com a roda e não recebe confirmação clara após reposicionar. Falta ação em lote.

**Jordan — primeira vez:** três ações de criação só por ícone, regras de Ctrl/Shift pouco claras e `{AutoGenDate}` técnico. Não sabe se clicar abre ou arrasta.

**Sam — acessibilidade:** itens não são consistentemente focáveis, tooltips são hover-only, handles não têm caminho de teclado e controles de diálogo/combobox não anunciam bem seus estados.

## Observações menores

- Mostrar o mundo associado no cabeçalho do editor reduz perda de contexto.
- Considerar estado selecionado e item recém-criado mais explícitos na lista.
- Cachear imagens/cores derivadas dos itens se timelines grandes apresentarem custo de renderização.
- Os textos de era/marco forçam branco, enquanto eventos aplicam lógica de contraste; unificar a regra.

## Perguntas para orientar a próxima versão

1. O canvas deve continuar sendo a única forma de editar ou terá uma lista acessível equivalente?
2. As três ações “Nova era / Novo marco / Novo evento” devem virar um único “Adicionar” nomeado com menu?
3. O que precisa vir primeiro: confiança de salvamento, acessibilidade de teclado ou consistência da linguagem temporal?
