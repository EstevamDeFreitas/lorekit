## Purpose

Permitir que o Lorekit mantenha conteúdo rico portável e estável, independentemente do editor de texto usado para criá-lo ou exibi-lo.

## ADDED Requirements

### Requirement: Formato canônico versionado para conteúdo rico
O sistema SHALL persistir novos conteúdos ricos como um documento Lorekit versionado, sem depender do formato serializado de um editor específico. O documento SHALL representar títulos, parágrafos, listas ordenadas e não ordenadas, checklists e seus itens aninhados, citações, tabelas, imagens, formatação inline, links e menções a entidades.

#### Scenario: Salvamento de conteúdo editado
- **WHEN** uma pessoa salva um campo de texto rico usando o editor disponível
- **THEN** o valor persistido identifica o formato Lorekit e sua versão, e não é um documento de saída do editor concreto

#### Scenario: Preservação de menção
- **WHEN** uma pessoa salva conteúdo que contém uma menção a uma entidade do Lorekit
- **THEN** o documento persistido mantém a referência da entidade e o rótulo da menção sem depender de atributos HTML do editor

### Requirement: Adaptação independente de editor
O sistema SHALL converter o documento Lorekit para o formato exigido pelo editor ativo e converter o conteúdo salvo por esse editor de volta para o documento Lorekit. A troca ou inclusão de um editor SHALL exigir somente um adaptador desse editor, sem mudar a representação persistida, as prévias ou os consumidores de conteúdo rico.

#### Scenario: Carregamento no Editor.js
- **WHEN** um campo contém um documento Lorekit válido e é aberto no editor atual
- **THEN** o sistema fornece ao Editor.js uma representação equivalente que preserva os recursos suportados

#### Scenario: Inclusão de outro editor
- **WHEN** o sistema adicionar um editor diferente do Editor.js
- **THEN** o novo editor consome e produz o mesmo documento Lorekit sem exigir migração dos campos já persistidos

### Requirement: Compatibilidade com conteúdo anterior
O sistema SHALL aceitar conteúdo legado persistido como saída do Editor.js e conteúdo de texto puro. O sistema SHALL convertê-los para o modelo Lorekit em memória e SHALL gravá-los no formato canônico somente quando forem salvos novamente.

#### Scenario: Abertura de documento legado do Editor.js
- **WHEN** uma pessoa abre um campo que contém dados legados válidos do Editor.js
- **THEN** o conteúdo é exibido com seus blocos e formatações compatíveis preservados

#### Scenario: Abertura de texto sem JSON
- **WHEN** uma pessoa abre um campo que contém texto sem formato JSON válido
- **THEN** o sistema o apresenta como conteúdo textual editável sem perder o texto original

#### Scenario: Migração preguiçosa ao salvar
- **WHEN** uma pessoa salva um campo carregado de conteúdo legado ou texto puro
- **THEN** apenas esse campo passa a ser persistido como documento Lorekit versionado

### Requirement: Preservação diante de capacidades diferentes
O sistema SHALL preservar no documento Lorekit qualquer recurso que o editor ativo não consiga editar ou renderizar integralmente. O sistema MUST NOT descartar silenciosamente blocos, atributos de apresentação, formatação inline, imagens ou menções durante uma conversão.

#### Scenario: Recurso não suportado pelo editor ativo
- **WHEN** um documento Lorekit contém um recurso que o editor ativo não suporta
- **THEN** o sistema mantém o recurso no documento persistido e apresenta uma indicação controlada de limitação em vez de removê-lo

### Requirement: Consumidores independentes do Editor.js
As prévias de documentos e as exportações de texto e Markdown SHALL derivar seu resultado do documento Lorekit, sem interpretar diretamente a estrutura persistida do Editor.js.

#### Scenario: Prévia de documento canônico
- **WHEN** um documento Lorekit é exibido em uma prévia do moodboard
- **THEN** a prévia apresenta os tipos de bloco e o texto equivalente sem exigir dados do Editor.js

#### Scenario: Exportação de documento canônico
- **WHEN** uma pessoa exporta conteúdo rico em texto ou Markdown
- **THEN** o resultado é gerado a partir do documento Lorekit e preserva a semântica dos blocos suportados
