# Field Layout Portability Specification

## Purpose

Permitir que layouts de campos sejam compartilhados entre instalacoes do Lorekit por meio de um documento JSON validavel, sem depender dos identificadores locais do banco de dados.

## Requirements

### Requirement: Exportacao de layout portavel
O sistema SHALL permitir que o usuario exporte o layout aberto no editor de configuracao de campos para um arquivo JSON salvo em sua maquina. O documento exportado MUST identificar a entidade principal, a versao do formato, a geometria e os itens do layout, alem das definicoes completas dos campos dinamicos utilizados por ele. O documento MUST NOT incluir identificadores locais de configuracao, template ou campos dinamicos.

#### Scenario: Exportar um layout com campos dinamicos
- **WHEN** o usuario aciona a exportacao de um layout que contem campos dinamicos
- **THEN** o sistema salva um JSON que identifica a entidade e inclui o layout e as definicoes desses campos dinamicos

#### Scenario: Exportar um layout sem campos dinamicos
- **WHEN** o usuario aciona a exportacao de um layout composto apenas por campos originais da entidade
- **THEN** o sistema salva um JSON valido que preserva a entidade e a geometria do layout sem declarar campos dinamicos inexistentes

### Requirement: Entrada e validacao da importacao
O sistema SHALL disponibilizar, na tela principal de configuracao global de campos, uma acao de importacao que aceite um arquivo JSON selecionado pelo usuario ou JSON colado em uma entrada de texto. Antes de persistir qualquer alteracao, o sistema MUST validar o formato e a versao do documento, detectar a entidade principal declarada nele e validar que seus campos originais e dinamicos podem ser resolvidos na instalacao atual.

#### Scenario: Importar a partir de arquivo
- **WHEN** o usuario seleciona um arquivo JSON valido para importacao
- **THEN** o sistema le o documento, detecta a entidade declarada e apresenta o resultado da validacao antes de aplicar o layout

#### Scenario: Importar a partir de JSON colado
- **WHEN** o usuario cola um JSON valido e confirma a importacao
- **THEN** o sistema processa o mesmo contrato de importacao usado para arquivos e detecta a entidade declarada

#### Scenario: Rejeitar documento invalido
- **WHEN** o documento nao for JSON valido, nao declarar uma entidade suportada ou referenciar um campo original indisponivel
- **THEN** o sistema informa o erro e nao cria campos nem altera configuracoes existentes

### Requirement: Resolucao segura de campos dinamicos
Durante a validacao de uma importacao, o sistema SHALL comparar cada campo dinamico importado com os campos da entidade de destino por nome normalizado e definicao completa. Campos ausentes MUST ser indicados para criacao e campos equivalentes MUST ser reutilizados. Se ja existir um campo com o mesmo nome mas com tipo, opcoes, relacao de entidade ou demais propriedades de definicao diferentes, o sistema MUST rejeitar a importacao com uma mensagem de erro e sem persistir alteracoes.

#### Scenario: Criar campos dinamicos ausentes
- **WHEN** o layout importado referencia campos dinamicos que nao existem na entidade detectada
- **THEN** o sistema cria esses campos e vincula o layout importado aos campos locais criados

#### Scenario: Reutilizar campo dinamico equivalente
- **WHEN** a entidade detectada ja possuir um campo dinamico com mesmo nome e mesma definicao do documento
- **THEN** o sistema reutiliza o campo existente sem criar uma duplicata

#### Scenario: Bloquear conflito de definicao dinamica
- **WHEN** a entidade detectada ja possuir um campo dinamico com o mesmo nome, mas definicao diferente da importada
- **THEN** o sistema exibe um erro de conflito e nao altera o layout global, os templates ou os campos dinamicos

### Requirement: Destino da configuracao global importada
Quando um documento valido for importado para uma entidade que ja possui configuracao global, o sistema SHALL solicitar explicitamente que o usuario escolha entre substituir a configuracao global, criar um novo template ou cancelar. O sistema MUST aplicar somente a opcao confirmada pelo usuario; o cancelamento MUST manter todos os dados inalterados.

#### Scenario: Substituir configuracao global existente
- **WHEN** o usuario escolhe "Substituir" para uma entidade com configuracao global existente
- **THEN** o sistema grava o layout importado como a configuracao global dessa entidade

#### Scenario: Criar template a partir da importacao
- **WHEN** o usuario escolhe "Criar novo template" para uma entidade com configuracao global existente
- **THEN** o sistema preserva a configuracao global atual e cria um template com o layout importado para a entidade detectada

#### Scenario: Cancelar importacao com configuracao existente
- **WHEN** o usuario escolhe "Cancelar" no conflito de destino
- **THEN** o sistema nao cria campos dinamicos nem altera configuracoes ou templates

### Requirement: Referências portáveis de calendário
Layouts com campos Data do calendário SHALL exportar configurações com referências portáveis de calendário e revisão, sem IDs locais de calendários, revisões ou mundos. O documento SHALL conter informação suficiente sobre regras e formatos para revisar compatibilidade, sem incluir valores de entidades.

#### Scenario: Exportar campo com calendário fixo
- **WHEN** o usuário exporta um layout que contém um campo associado a um calendário
- **THEN** o documento contém sua referência portável e descrição das regras necessárias, sem identificadores locais

#### Scenario: Exportar campo selecionável
- **WHEN** o campo permite escolher entre calendários do mundo
- **THEN** o documento preserva essa política sem fixar o mundo ou calendário selecionado em um valor de entidade

### Requirement: Associação de calendário durante importação
Antes de aplicar layout com referência de calendário, o sistema SHALL solicitar mundo de destino e associação a calendário e revisão disponíveis. SHALL apresentar diferenças de regras e exigir aceite explícito para associações diferentes. Referências não resolvidas MUST impedir a aplicação sem persistir alterações.

#### Scenario: Associação equivalente
- **WHEN** o usuário associa a referência a um calendário local com regras equivalentes
- **THEN** a definição importada utiliza a associação local e participa da comparação de campos existentes antes da confirmação final

#### Scenario: Associação com regras distintas
- **WHEN** o calendário escolhido tem meses ou relógio diferentes do descrito no documento
- **THEN** o sistema apresenta essas diferenças e exige aceite explícito antes de prosseguir com a definição do campo

#### Scenario: Referência não resolvida
- **WHEN** o usuário não associa uma dependência necessária ou cancela a associação
- **THEN** nenhum campo, template, vínculo ou configuração global é criado ou alterado

### Requirement: Compatibilidade do formato de layout
A evolução do documento para referências de calendário SHALL preservar a importação das versões previamente suportadas. Campos legados MUST manter suas regras de comparação e conflito; campos de calendário MUST ser comparados após resolver referências locais. Versões futuras desconhecidas MUST ser rejeitadas sem mutações.

#### Scenario: Layout legado
- **WHEN** o usuário importa um documento anteriormente suportado sem campos de calendário
- **THEN** os campos e destinos existentes continuam sendo validados e aplicados pelo comportamento anterior

#### Scenario: Conflito após associação
- **WHEN** já existe campo com mesmo nome e sua definição difere da definição de calendário importada e resolvida
- **THEN** o sistema rejeita a importação sem alterar campos, valores, templates ou configuração global

### Requirement: Portabilidade dos formatos condicionais
O manifesto de calendário SHALL preservar a ordem das partes e as comparações e textos condicionais, com validação equivalente à edição local e sem transportar identificadores locais aninhados.

#### Scenario: Reutilizar uma definição com condição
- **WHEN** um layout com texto condicional é associado a regras equivalentes no destino
- **THEN** a comparação reconhece a mesma definição e preserva a ordem e os resultados condicionais
