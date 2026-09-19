## Why

A tela de relações continua difícil de ler em redes densas: há curvas inversas coincidentes, rótulos sem detecção de colisões e excesso de detalhes simultâneos. A solução precisa combinar correção geométrica, organização por conectividade e exploração progressiva; aumentar o espaçamento não garante legibilidade de uma rede arbitrária.

## What Changes

- Corrigir curvas paralelas e inversas usando orientação canônica do par e preservar a direção real das setas.
- Reservar espaço para nomes de entidades e desviar linhas dos nós, com roteamento e posicionamento de rótulos separados do layout.
- Adotar rótulos automáticos sem sobreposição em coordenadas de tela; priorizar a relação ativa e oferecer todos os nomes no painel.
- Resumir múltiplas relações entre o mesmo par com contagem e abertura da lista de links originais, sem perder identidade ou direção.
- Introduzir foco opcional em vizinhança de 1 ou 2 níveis e retorno explícito à teia completa; abrir uma raiz continua carregando seu componente conectado completo.
- Manter mundo ou raiz centralizados, círculos e organização radial de primeiro nível; reorganizar vizinhos por conectividade para reduzir cruzamentos.
- Oferecer ajuste à área visível e navegação estável com zoom livre, pan 1:1 e movimento reduzido.
- Avaliar qualidade com redes densas reais ou sintéticas, medidas de colisão e inspeção visual, incluindo dispositivos menores.

## Capabilities

### New Capabilities

- `dense-relation-graph-readability`: apresentação adaptativa, geometria distinguível e exploração acessível de relações em redes densas.

### Modified Capabilities

Nenhuma spec principal existente será modificada. A change anterior permanece arquivada e sua delta não foi sincronizada para uma capability principal; esta proposta registra explicitamente as garantias de compatibilidade necessárias.

## Impact

- Frontend: `relation-graph.component.ts/.css`, utilitários e tipos de grafo, layout geral do mundo e testes.
- Novas camadas de geometria, rótulos e projeção visual com índices por nó/par; o serviço mantém o conjunto completo de links do escopo.
- Candidato de layout: Cytoscape.js com fCoSE em modo headless, carregado sob demanda e sujeito à avaliação de integração, licença e desempenho descrita no design. Nenhuma biblioteca será instalada nesta etapa.
- Sem migrações de banco ou alterações nos relacionamentos persistidos. Implementação planejada em nova change independente.
