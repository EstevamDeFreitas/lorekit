# Spec Delta

## ADDED Requirements

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
