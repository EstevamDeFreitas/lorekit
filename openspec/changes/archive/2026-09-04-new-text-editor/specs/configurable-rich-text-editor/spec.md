## Purpose

Permitir que cada instalação do Lorekit escolha uma experiência de edição rica contínua sem sacrificar a compatibilidade e a portabilidade dos documentos já armazenados.

## ADDED Requirements

### Requirement: Seleção global do editor de texto rico
O sistema SHALL disponibilizar em Configurações Gerais uma escolha global entre Editor.js e Tiptap para todos os campos de texto rico. A escolha SHALL ser persistida como configuração do aplicativo, e uma instalação que não possua valor válido SHALL usar Editor.js como padrão.

#### Scenario: Instalação existente sem preferência
- **WHEN** uma pessoa abre um campo de texto rico em uma instalação sem preferência de editor persistida
- **THEN** o campo é aberto com Editor.js e nenhuma configuração de conteúdo existente é alterada

#### Scenario: Seleção do Tiptap
- **WHEN** uma pessoa seleciona Tiptap em Configurações Gerais e confirma a alteração
- **THEN** os campos de texto rico abertos posteriormente usam Tiptap até que a preferência seja alterada novamente

#### Scenario: Abrangência da preferência
- **WHEN** uma pessoa abre um documento, uma descrição de entidade ou um campo dinâmico do tipo editor após selecionar um editor
- **THEN** cada campo usa o editor globalmente selecionado

### Requirement: Troca segura de editor ativo
O sistema MUST NOT descartar conteúdo não salvo ao alterar a preferência global de editor. A alteração SHALL valer para novas instâncias de editor e o sistema SHALL informar que campos já abertos devem ser reabertos para adotar a nova experiência.

#### Scenario: Alteração com campo rico aberto
- **WHEN** uma pessoa altera a preferência enquanto há um campo de texto rico aberto
- **THEN** o campo aberto mantém sua instância atual e o sistema informa que a nova preferência será aplicada ao reabrir o campo

### Requirement: Edição Tiptap compatível com o documento Lorekit
Quando Tiptap estiver selecionado, o sistema SHALL permitir editar parágrafos, títulos, listas ordenadas e não ordenadas, checklists aninhados, citações, tabelas, imagens, negrito, itálico, cor, destaque, links e menções. Ao salvar, o sistema SHALL persistir exclusivamente o documento Lorekit versionado, e não o formato interno do editor.

#### Scenario: Reabertura em editores diferentes
- **WHEN** uma pessoa salva conteúdo usando Tiptap e posteriormente abre o mesmo campo usando Editor.js, ou o inverso
- **THEN** os blocos e formatações canônicos compatíveis permanecem disponíveis sem migração de banco de dados

#### Scenario: Exportação após edição no Tiptap
- **WHEN** uma pessoa exporta um campo salvo usando Tiptap como texto ou Markdown
- **THEN** o resultado é produzido a partir do documento Lorekit e mantém a semântica dos blocos suportados

### Requirement: Menções a entidades no Tiptap
Quando Tiptap estiver selecionado, o sistema SHALL oferecer sugestões de entidades após a pessoa digitar `@`, usando a mesma busca de entidades do Lorekit. Uma menção inserida SHALL persistir a tabela, o identificador e o rótulo da entidade; ao ativá-la, o sistema SHALL abrir a entidade referenciada.

#### Scenario: Inserção de menção
- **WHEN** uma pessoa digita `@` seguido de uma consulta que possui entidades correspondentes e escolhe uma sugestão
- **THEN** o editor substitui a consulta por uma menção identificável e preserva sua referência ao salvar

#### Scenario: Navegação por menção persistida
- **WHEN** uma pessoa ativa uma menção que foi salva anteriormente em um campo Tiptap
- **THEN** o Lorekit abre o editor da entidade referenciada

### Requirement: Preservação de recursos canônicos no Tiptap
O sistema SHALL preservar legenda e opções de apresentação de imagens, conteúdo e legenda de citações, itens aninhados de lista e dados de blocos não totalmente editáveis durante a abertura e o salvamento pelo Tiptap. O sistema MUST NOT remover silenciosamente esses dados.

#### Scenario: Imagem com apresentação personalizada
- **WHEN** uma pessoa abre no Tiptap uma imagem canônica que possui legenda, largura ou opções visuais
- **THEN** a imagem mantém essas informações ao ser salva sem edição ou após edição compatível

#### Scenario: Bloco com limitação de edição
- **WHEN** um documento contém um bloco que o Tiptap não consegue editar integralmente
- **THEN** o sistema apresenta uma indicação de limitação e mantém os dados originais ao salvar
