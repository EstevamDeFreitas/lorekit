## 1. Contrato e regras de dominio

- [x] 1.1 Definir os tipos TypeScript do documento de layout portavel, incluindo identificador de formato, versao, entidade, layout e definicoes de campos dinamicos, e verificar que `npm run build:frontend` conclui sem erros de tipo.
- [x] 1.2 Implementar no servico de configuracao a conversao entre o layout local e o documento portavel, substituindo referencias dinamicas baseadas em UUID por chaves semanticas, e verificar por testes unitarios que uma exportacao nao contem IDs locais.
- [x] 1.3 Implementar a analise e prevalidacao do documento importado (JSON, versao, entidade, campos de schema, geometria e campos dinamicos) e verificar por testes unitarios os erros de documento invalido e de campo de schema indisponivel sem persistencia.
- [x] 1.4 Implementar a resolucao de campos dinamicos por nome normalizado e definicao completa, produzindo o plano de reutilizacao/criacao/conflito e o layout com tokens locais resolvidos, e verificar por testes os cenarios de campo ausente, equivalente e homonimo incompativel.

## 2. Persistencia controlada da importacao

- [x] 2.1 Implementar a aplicacao de um plano validado para criar somente os campos dinamicos ausentes e salvar o layout global ou um novo template, e verificar por teste de integracao do servico que campos equivalentes nao sao duplicados.
- [x] 2.2 Garantir que erros de validacao ou conflito nao persistam campos, configuracoes ou templates e verificar por teste de integracao que o estado do banco permanece inalterado apos uma importacao rejeitada.
- [x] 2.3 Definir a criacao de template importado com nome sugerido e edicao pelo usuario, sem sobrescrever template existente por nome, e verificar manualmente que o layout global anterior e o template novo coexistem.

## 3. Interface de exportacao e importacao

- [x] 3.1 Adicionar ao editor de configuracao de campos uma acao de exportacao que gere e salve o JSON portavel com nome de arquivo adequado, e verificar manualmente que o arquivo baixado pode ser aberto e contem a entidade e os campos dinamicos esperados.
- [x] 3.2 Adicionar em Settings > Campos Globais uma acao de importacao que aceite arquivo `.json` ou JSON colado e exiba a entidade detectada, o resumo de campos a criar/reutilizar e os erros de validacao, e verificar manualmente ambos os meios de entrada.
- [x] 3.3 Implementar o dialogo de destino quando a entidade importada ja tiver configuracao global, com as acoes "Substituir", "Criar novo template" e "Cancelar", e verificar manualmente que cada escolha produz respectivamente substituicao, preservacao com template novo e nenhuma alteracao.
- [x] 3.4 Atualizar a lista e a selecao de entidade/template apos uma importacao bem-sucedida e verificar manualmente que o layout importado fica imediatamente disponivel para edicao.

## 4. Verificacao final

- [x] 4.1 Executar os testes adicionados para o servico e corrigir falhas, verificando que todos os cenarios da especificacao de portabilidade de layout estao cobertos.
- [x] 4.2 Executar `npm run build:frontend` e verificar manualmente uma exportacao seguida de importacao em uma instalacao com e sem campos dinamicos preexistentes.
