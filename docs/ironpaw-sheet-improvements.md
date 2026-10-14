# Extensão da ficha Ironpaw

Registro da implementação em 10/10/2026. A extensão atende ao uso da ficha durante preparação e sessões, preservando a identidade estabelecida do Lorekit e a operação local descrita em [PRODUCT.md](../PRODUCT.md).

## Recursos da ficha

| Recurso | Representação e edição |
|---|---|
| Vida regular | Caixas vermelhas com estados vazio, meio e cheio (0 / 0,5 / 1). |
| Vida temporária | Caixas violetas inteiras, editadas em incrementos de 1. |
| Resistência permanente | Escudos azuis com preenchimento inteiro ou pela metade. |
| Resistência temporária | Escudos violetas com preenchimento inteiro ou pela metade. |

Vida e resistência oferecem configuração de quantidades permanentes e temporárias em campos separados. Os temporários aparecem em um grupo identificado, com contador próprio. A resistência permanente mantém a contribuição da vocação, das proteções e do ajuste manual. As configurações usam Salvar/Cancelar; o estado aplicado entra na persistência da ficha.

A vida temporária não admite meio ponto: conforme a seção Caixas de Vida de [Sistema Ironpaw.md](<Sistema Ironpaw.md>), qualquer dano, inclusive Leve/Parcial, quebra uma caixa temporária inteira. A interface permite marcar esse consumo manualmente; não executa resolução automática de dano. As caixas têm nomes acessíveis e `aria-pressed` para comunicar o preenchimento.

## Poderes, magias e remodelações

O editor compartilhado de mecânicas registra grau, custo, variações por grau e descrição dos efeitos. Magias também possuem tipo (magia-chave ou truque), núcleo e tags. Os custos iniciais seguem:

| Categoria | Graus | Custo |
|---|---|---|
| Técnica | Básica / Intermediária / Mestre | 1 / 3 / 5 Vigor |
| Magia-chave | Menor / Média / Maior | 2 / 3 / 5 Essência |
| Truque | Sem grau | 0 Essência; sem remodelações |

Custos de técnicas, magias-chave e variações podem ser editados. Escolher Truque limpa grau, variações e remodelações. Alterar a categoria substitui a referência da habilidade e reinicia as mecânicas específicas, permitindo que o editor com OnPush reflita a mudança imediatamente.

As remodelações possuem nome, efeito e grau próprios. O total exibido soma o custo da magia no grau escolhido ao acréscimo:

| Remodelação | Acréscimo de Essência | Treinamento indicado |
|---|---|---|
| Potenciar | +1 | Treinado |
| Alterar em Adjacência | +1 | Intermediário |
| Moldar Potencial | +2 | Intermediário; apenas Média ou Maior |

O seletor restringe Moldar Potencial a Média/Maior. As exigências de treinamento e as orientações de uso são apresentadas como regras para consulta, sem automatizar a adjudicação. Magias podem ser cadastradas na página de vocações e na configuração da vocação aberta pela ficha. Uma magia herdada oferece **Criar cópia na ficha para remodelar**: a cópia recebe novo ID e mantém os dados sem alterar a origem.

## Gestão de vocação e espécie

A página de vocações e sua configuração na ficha usam as seções **Base**, **Atributos e perícias** e **Repertório**. Os quatro atributos — Corpo, Mente, Presença e Técnica — têm um campo numérico de referência preservado no JSON `attributes`; esse valor não impõe o modificador do personagem, definido na ficha. Os níveis mínimos de perícia continuam editáveis junto ao atributo correspondente. Os nomes dos atributos ganharam tamanho ligeiramente maior na ficha e nas vocações, acompanhados por ícones neutros compartilhados: halteres para Corpo, cérebro para Mente, máscaras para Presença e engrenagens para Técnica; os textos permanecem visíveis e os ícones são decorativos (`aria-hidden`).

O gerenciador compartilhado `irpw-repertoire-editor` organiza o catálogo e o detalhe do item selecionado, com busca por nome/descrição, filtros por categoria na vocação e ações de adicionar, duplicar e remover. A seleção acompanha os resultados visíveis; uma busca sem resultados não mantém um detalhe oculto aberto. Poderes e magias mantêm o editor de mecânicas, custos e remodelações. A configuração da espécie usa **Base**, **Passivas** e **Fraquezas**, reutilizando esse gerenciador para os efeitos narrativos, sem acrescentar poderes ou magias à espécie.

## Conjuração e persistência

Os atributos da ficha permanecem visíveis em grupos. Cada atributo tem um botão de livro sempre disponível: discreto quando inativo e violeta quando escolhido para Conjuração. Clicar em outro livro transfere a Conjuração; clicar no livro ativo a desabilita. A perícia aparece junto ao atributo selecionado, e seu treinamento é retido ao trocar ou desabilitar o atributo. Os botões têm nome acessível, foco visível e `aria-pressed`. Uma tentativa de rolagem associada à Conjuração sem atributo selecionado solicita sua configuração.

Os dados continuam nos campos JSON existentes: `attributes` contém `_conjuration: { attribute, level }`; `lifepoints` e `defensepoints` incluem `temporaryPoints` e `temporaryCurrentPoints`; `habilities` incorpora graus, custos, variações e remodelações. O envelope de resistência permanece na versão 2 e aceita registros anteriores sem temporários. Esta extensão mantém o schema do banco, sem criar tabelas ou colunas.

A configuração de vocação exige **Salvar vocação** para aplicar alterações. A página de vocações e a configuração de espécie mantêm salvamento automático com debounce e opção de salvar imediatamente na espécie. Os rodapés das configurações explicitam o salvamento manual da vocação e o automático da espécie.

## Identidade conferida

A autoridade visual foi conferida em `.github/prompts/project.copilot.prompt.md`, `lorekit-frontend/src/styles.scss`, `lorekit-frontend/src/index.html`, no botão compartilhado e nos estilos atuais do Gerenciador de Conteúdo Ironpaw. As superfícies continuam o tema escuro zinc, a fonte Inter local, as ações amarelas e os ícones FontAwesome. Os painéis reutilizam `entity-properties-panel`, incluindo o tratamento glass existente quando habilitado, contornos discretos e foco visível. Catálogo e detalhe reorganizam-se conforme a largura disponível.

Os acentos vermelho, azul e violeta distinguem recursos e estados. O refinamento segue os cantos suaves dos painéis atuais: cerca de 0,65 rem nos controles de configuração e 0,85 rem nos painéis, substituindo o registro anterior de campos com cantos de 6 px. São escolhas locais apoiadas no padrão existente. Não foram criados ou alterados `DESIGN.md` ou `.impeccable/design.json`.

## Evidências e validação

Comportamento conferido nos modelos `irpw-ability.model.ts`, `irpw-vocation.model.ts`, `irpw-item.model.ts` e nos componentes da ficha, editor de mecânicas, vocações e configurações de vocação/espécie, sob `lorekit-frontend/src/app/`.

A validação final do refinamento registrou build Angular development aprovado e 29 testes relevantes aprovados em ChromeHeadless, incluindo seleção coerente com a busca e nome acessível do campo de busca. A suíte do repertório isola os componentes globais Input/TextArea por uma limitação legada de importação JIT; verifica o estado e as mecânicas reais do editor compartilhado. O build manteve apenas avisos preexistentes de ContextMenuDirective e Sass `@import`.

A revisão independente estática teve disposição **ship** após corrigir a seleção fora dos resultados e o rótulo/contraste da busca. A revisão anterior também conferiu a atualização por referência ao trocar a categoria e `aria-pressed` nas caixas. Não havia aplicativos ou navegadores conectados ao CUA, e não foram obtidos screenshots; build, testes e revisão estática não constituem aprovação visual renderizada da interface.
