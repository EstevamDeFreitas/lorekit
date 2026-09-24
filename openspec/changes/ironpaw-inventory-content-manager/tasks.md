## 1. Contratos e migração

- [x] 1.1 Definir modelos discriminados de itens, snapshots, espaços, inventário v1 e PR v2; verificar validadores com entradas válidas, números inválidos e versões futuras preservadas.
- [x] 1.2 Acrescentar migração aditiva de IRPWItem com identidade portável, revisão, arquivamento e definição versionada; verificar execução e repetição sobre fixture legada sem perda de effects ou registros órfãos.
- [x] 1.3 Atualizar triggers e contratos de sync afetados pelos novos campos; verificar round-trip de definição e ficha entre clientes compatíveis e rejeição de payload inválido sem perda local.
- [x] 1.4 Implementar leitura/conversão compatível de inventário vazio e PR legados; verificar preservação de PR atual, nulos, JSON desconhecido e demais campos da ficha.

## 2. Catálogo e navegação

- [x] 2.1 Implementar serviço de catálogo com criação, edição, duplicação e arquivamento coordenados entre Item e IRPWItem; verificar identidades distintas em duplicatas e preservação de cópias já distribuídas.
- [x] 2.2 Integrar Gerenciador de Conteúdo abaixo de Vocações no shell, sidebar, rota e registro do workspace; verificar abertura, foco da aba existente e restauração após reinício.
- [x] 2.3 Construir lista com busca, filtros, estado vazio e seleção; verificar combinações de categoria/raridade e consulta de arquivados.
- [x] 2.4 Construir editor e prévia com campos por categoria, espaços, mãos, imagem/ícone e empilhamento; verificar cadastro e reabertura de um exemplo de cada categoria e mensagens de validação.
- [x] 2.5 Apresentar propriedades narrativas, raridade opcional, efeitos das proteções e configuração de item único; verificar ausência de bônus automáticos indevidos e aviso para mais de dois benefícios sem contrapartida.

## 3. Operações da ficha

- [x] 3.1 Implementar comandos de adicionar, remover, reordenar e editar snapshots; verificar independência entre catálogo, duas fichas e ordem completa quando houver filtros.
- [x] 3.2 Implementar divisão/combinação de pilhas e consumo unitário; verificar limites, quantidades totais, não combinação de cópias distintas e remoção da última unidade sem aplicar efeitos a recursos.
- [x] 3.3 Implementar equipar/desequipar, substituição, separação de unidade, duas mãos e ativação de reserva; verificar incompatibilidade sem mutação, localização única e retorno de ocupantes à mochila.
- [x] 3.4 Implementar atualização explícita de snapshots com prévia de diferenças; verificar preservação de anotações/quantidades, divisão por novo limite e retorno à mochila quando incompatível.
- [x] 3.5 Implementar máximo de PR com origens, contribuição de vocação aplicada e ajuste manual; verificar casos 1/3 para 1/5, redução 4/5 para 2/2, troca de vocação e ausência de recuperação ao reequipar.
- [x] 3.6 Integrar comandos compostos a persistência e histórico; verificar desfazer/refazer de inventário e PR em conjunto, incluindo consumo e atualização de cópia.
- [ ] 3.7 Preservar referências de imagem de snapshots e histórico na limpeza de assets; verificar que editar/arquivar origem não quebra imagem de posse nem restauração histórica.

## 4. Interface de inventário

- [x] 4.1 Substituir placeholder por componentes de equipamentos, mochila e detalhes; verificar doze espaços, grid expansível, busca e layout em desktop e largura estreita.
- [x] 4.2 Integrar seletor do catálogo, edição de cópia, quantidades e ações de consumo; verificar persistência após fechar/reabrir ficha e sinalização de versão incompatível.
- [x] 4.3 Integrar arraste e comandos equivalentes por clique/teclado; verificar foco, rótulos acessíveis, espaços bloqueados e reordenação sem perda de itens filtrados.
- [x] 4.4 Exibir PR atual/máximo, origens e efeitos descritivos; verificar distinção visual entre cálculo automático e efeitos a aplicar manualmente, sem alterações nos mínimos de vida/perícias/percepções existentes.

## 5. Portabilidade

- [ ] 5.1 Implementar serialização de item/seleção/catálogo no envelope portável e recursos por hash; verificar round-trip e ausência de IDs locais, caminhos e dados de personagens.
- [x] 5.2 Implementar parser e validação compartilhados para arquivo/texto, incluindo limites e imagens; verificar versões desconhecidas, referências ausentes, duplicações de identidade, números inválidos e recursos não permitidos.
- [x] 5.3 Implementar planejamento de conflitos por identidade e conteúdo canônico; verificar reimportação idempotente, nomes iguais com identidades diferentes e escolhas manter/atualizar/copiar.
- [x] 5.4 Implementar prévia e escolhas de importação seguindo a experiência de layouts; verificar cancelamento sem mutação, nova validação quando destino muda e exportação explícita sem imagens quando necessário.
- [x] 5.5 Preparar unidade de escrita/persistência sem flush intermediário, reutilizando coordenação existente; verificar rollback de Item/IRPWItem/referências/outbox após falha injetada.
- [ ] 5.6 Integrar staging de imagens, marcador de operação e recuperação no desktop/browser; verificar falha de asset, falha de persistência e encerramento entre etapas sem catálogo parcial ou referências quebradas.
- [x] 5.7 Conectar aplicação integral ao gerenciador e publicação de sync somente após sucesso; verificar importação em workspace limpo e atualização sem mudar snapshots de personagens.

## 6. Validação integrada

- [x] 6.1 Executar os testes relevantes de migração, inventário, PR, histórico e portabilidade; verificar todos os cenários das três specs e corrigir falhas antes de marcar esta tarefa.
- [x] 6.2 Executar build e verificações de tipos do frontend e checagens do servidor caso seu contrato seja alterado; registrar comandos e resultados reais.
- [ ] 6.3 Realizar roteiro desktop/web: cadastrar, exportar, importar em outro workspace, equipar, consumir, desfazer, reiniciar e sincronizar; registrar resultados e conferir imagens, quantidades e PR.
- [ ] 6.4 Verificar regressão da integração vocação/espécie e importação de layouts, além de responsividade e teclado; registrar evidências e eventuais limitações remanescentes.
