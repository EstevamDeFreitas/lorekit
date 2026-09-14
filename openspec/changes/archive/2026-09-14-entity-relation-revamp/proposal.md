## Why

A tela de relações perdeu clareza visual ao tentar funcionar como um quadro de entidades posicionáveis, enquanto o moodboard passou a atender melhor à organização livre de ideias. A tela precisa voltar a comunicar a estrutura da teia de relações do universo, com uma visão automática, completa e coerente com o mundo atualmente selecionado.

## What Changes

- Transformar a tela em uma visão automática de rede, exibindo todas as entidades do escopo mesmo quando não possuem relações.
- Considerar o mundo atual selecionado para a visão geral; sem mundo selecionado, manter uma visão global.
- Fazer uma entidade raiz explícita prevalecer sobre o mundo atual, mantendo-a visível e centralizada quando a tela for aberta a partir dela.
- Manter o filtro por tipo de entidade apenas para restringir a escolha da entidade principal, sem ocultar os demais tipos do grafo.
- Tornar a entidade principal opcional na visão geral e posicioná-la no centro quando escolhida.
- Substituir cartões retangulares por nós circulares, com diferenciação visual por tipo e suporte a imagem ou fallback textual.
- Gerar automaticamente um layout próximo de uma composição circular, capaz de acomodar redes com ciclos, relações cruzadas e entidades isoladas.
- Representar a direção das relações com arestas curvas, setas e tratamento visual para relações inversas, múltiplas e autorrelações.
- Ocultar links entre mundos na visualização de um único mundo, sem apagar os dados persistidos.
- Manter a edição de relações ao selecionar uma entidade, reorganizando o painel para reduzir ruído e abrir o formulário apenas quando necessário.
- Remover da experiência dessa tela a movimentação, redimensionamento e personalização manual dos nós; configurações antigas persistidas não devem ser usadas pelo novo layout.

## Capabilities

### New Capabilities

- `entity-relation-graph`: visão de rede automática, filtrada por escopo de mundo, com foco opcional, nós circulares, arestas direcionais e edição contextual de relações.

### Modified Capabilities

Nenhuma capability existente possui requisitos de relações para ser modificada.

## Impact

- `lorekit-frontend/src/app/pages/relations/relation-graph/relation-graph.component.ts` e `.css`: novo fluxo de estado, filtros, interação e apresentação visual.
- `lorekit-frontend/src/app/services/link.service.ts`: consulta de entidades/links por escopo e construção da visão completa, incluindo entidades isoladas.
- `lorekit-frontend/src/app/libs/relationship-graph/relationship-graph.utils.ts` e `relationship-graph.types.ts`: modelo de nós circulares, layout automático e geometria de arestas.
- Possível serviço compartilhado para determinar o pertencimento de qualquer entidade a um mundo, evitando duplicar a lógica atualmente privada do `MoodboardService`.
- Testes unitários para escopo por mundo, precedência da raiz, entidades isoladas, layout e roteamento de arestas.
- Nenhuma dependência externa é necessária; a implementação pode continuar usando o SVG existente.
