## 1. Modelo versionado e normalização

- [x] 1.1 Definir o payload v2 com abas nomeadas e a união discriminada de itens `field` e `separator`, incluindo ids estáveis, posição, tamanho e cor opcional; verificar com type-check que consumidores não criem itens incompletos.
- [x] 1.2 Implementar parsing, validação e normalização central de payloads internos v1 e v2, cobrindo fallback de nome por template ou "Propriedades"; verificar com testes unitários de layouts válidos, inválidos e legados.
- [x] 1.3 Atualizar os layouts padrão do sistema e a resolução por escopo para retornarem a representação v2 completa com metadados de origem; verificar por testes a precedência entidade, pai, global e default.
- [x] 1.4 Ampliar o catálogo de campos com o tipo explícito de controle e mapear todos os campos nativos atuais de Character, Culture, Species e World; verificar que cada token default resolve para um controle suportado.

## 2. Portabilidade e compatibilidade

- [x] 2.1 Evoluir o documento portátil para a nova versão, exportando abas, campos, separadores e cores e coletando campos dinâmicos em todas as abas; verificar com teste de round-trip de um layout v2 completo.
- [x] 2.2 Manter a importação de documentos portáteis v1 por normalização para uma aba única e validar ids, nomes, cores, grid, unicidade de campos e referências dinâmicas antes de qualquer escrita; verificar com testes de importação legada e rejeição sem escrita parcial.
- [x] 2.3 Atualizar os fluxos de importação para aplicar o layout normalizado como configuração global ou template sem perder abas e propriedades; verificar ambos os destinos em testes do serviço de portabilidade.

## 3. Seletor de cor compartilhado

- [x] 3.1 Extrair um componente reutilizável de seleção hexadecimal com tons, cores de destaque, cor personalizada e ação de limpar; verificar seleção, emissão e limpeza em teste do componente.
- [x] 3.2 Substituir os seletores embutidos do editor de texto pelo componente compartilhado sem alterar a formatação de texto e fundo; verificar os controles da toolbar e executar os testes do editor.

## 4. Editor visual de layouts

- [x] 4.1 Adicionar ao editor operações para criar, selecionar, renomear, reordenar e excluir abas, validando nomes únicos e não vazios; verificar persistência da ordem, bloqueios de validação e confirmação de exclusão em testes.
- [x] 4.2 Adaptar catálogo, drag-and-drop, movimentação e redimensionamento para a aba ativa, impondo unicidade de campo no template inteiro; verificar inclusão, movimentação entre abas e prevenção de duplicatas.
- [x] 4.3 Adicionar criação e edição de separadores horizontais e verticais com label opcional, orientação e dimensões iniciais adequadas; verificar múltiplos separadores e preservação das configurações após salvar e recarregar.
- [x] 4.4 Integrar o seletor compartilhado à edição de campos e separadores e permitir limpar a cor; verificar persistência de cores da paleta e cores personalizadas.
- [x] 4.5 Atualizar limpeza, reset, criação/edição de templates e exportação do editor para operar sobre o payload v2 inteiro; verificar que cada fluxo preserva todas as abas e itens.

## 5. Componente genérico de campos configuráveis

- [x] 5.1 Criar o único componente público de campos configuráveis com inputs para entidade, tabela, layout e aba ativa e outputs para alteração nativa e salvamento; verificar a API com um host de teste.
- [x] 5.2 Implementar no componente o grid e a renderização de campos nativos por metadados para input, textarea e editor rico; verificar leitura, alteração, serialização e emissão para cada controle.
- [x] 5.3 Implementar no componente o ciclo de vida de campos dinâmicos de texto, opções, entidade, imagem e editor, incluindo debounce e flush existentes; verificar carregamento e persistência de cada tipo em testes.
- [x] 5.4 Renderizar separadores com linha, label centralizado, rotação vertical de 90 graus e cor opcional; verificar orientações, ausência de label e posicionamento no grid.
- [x] 5.5 Aplicar a cor opcional dos campos como destaque de label e borda sem preencher o controle e preservar o estilo padrão quando ausente; verificar ambos os estados em teste de renderização.
- [x] 5.6 Preservar rolagem, altura do grid e zoom móvel do comportamento atual no componente compartilhado; verificar layout desktop e viewport móvel representativos.

## 6. Integração das telas de entidades

- [x] 6.1 Criar a composição reutilizável de ids `layout:<tabId>` e fallback de seleção para integrar abas configuradas ao estado atual da página; verificar restauração válida e fallback quando uma aba foi removida.
- [x] 6.2 Migrar Character e Culture para o componente genérico, exibindo abas configuradas junto às abas fixas e preservando o salvamento de todos os campos nativos e dinâmicos; verificar manualmente e por testes os controles específicos dessas entidades.
- [x] 6.3 Migrar Species e World para o componente genérico, preservando seus campos nativos e fluxos de salvamento; verificar manualmente e por testes seus layouts padrão.
- [x] 6.4 Migrar Location, Object e Organization para o componente genérico, preservando todos os tipos de campo dinâmico e as abas fixas aplicáveis; verificar manualmente e por testes uma entidade de cada tipo.
- [x] 6.5 Remover a aba fixa "Propriedades" das sete telas em favor das abas do layout e manter as demais abas fixas no mesmo nível; verificar nomes, ordem e navegação em todas as telas.
- [x] 6.6 Remover os sete componentes `*-configured-fields` e referências obsoletas somente após a migração de todos os consumidores; verificar com busca no projeto que nenhum seletor ou import removido permaneça.

## 7. Verificação integrada

- [x] 7.1 Adicionar cobertura de regressão para carregamento e salvamento de layouts internos v1 em todas as origens relevantes, verificando que campos, posições e dimensões sejam preservados na conversão para v2.
- [x] 7.2 Executar os testes afetados e corrigir regressões de configuração, portabilidade, editor, componente genérico e páginas de entidade; verificar que toda a suíte relevante finalize sem falhas.
- [x] 7.3 Executar `npm run build:frontend` e verificar que o build Angular de produção conclua sem erros ou violações de tipagem.
- [x] 7.4 Realizar um fluxo manual completo criando um template com múltiplas abas, campos nativos e dinâmicos, separadores e cores, aplicando-o nos escopos global, pai e entidade e fazendo exportação/importação; verificar que o resultado visual e os valores persistidos permaneçam consistentes após reabrir o aplicativo.
