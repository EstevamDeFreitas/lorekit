## Purpose

Compartilhar definições de itens Ironpaw entre instalações por pacotes portáveis, validando conflitos e imagens antes de modificar o catálogo de destino.

## ADDED Requirements

### Requirement: Exportar definições portáveis
O gerenciador SHALL exportar um item, uma seleção ou todo o catálogo ativo em JSON com formato identificado, versão, sistema Ironpaw, metadados de pacote, identidades portáveis e definições completas. O arquivo MUST NOT incluir identificadores locais do banco, caminhos de arquivo locais ou dados de personagens. Imagens incluídas SHALL ser transportadas no pacote; falhas de leitura MUST impedir exportação incompleta, oferecendo exportação explícita apenas com ícones.

#### Scenario: Exportar seleção com imagem
- **WHEN** o usuário exporta itens selecionados com imagens disponíveis
- **THEN** o pacote contém somente essas definições e seus recursos visuais necessários e pode ser interpretado em outra instalação sem os caminhos originais

### Requirement: Validar antes de importar
O gerenciador SHALL aceitar arquivo JSON ou texto colado pelo mesmo fluxo de validação. SHALL validar formato, versão, tipos, categorias, propriedades, identidades, referências e imagens antes de apresentar prévia. Versões não suportadas, identidades duplicadas, números inválidos ou recursos ausentes MUST ser recusados sem alterações. Limites de tamanho e quantidade SHALL ser informados ao usuário quando excedidos.

#### Scenario: Versão desconhecida
- **WHEN** o pacote declara versão não suportada
- **THEN** o usuário recebe erro de compatibilidade e nenhum item ou imagem é criado

#### Scenario: Validar por dois meios
- **WHEN** o mesmo JSON é fornecido por arquivo ou texto colado
- **THEN** a validação e a classificação de conflitos são equivalentes

### Requirement: Prévia e resolução de conflitos
A prévia SHALL listar novos itens, equivalentes e conflitos por identidade portável, sem usar o nome como identidade. Conteúdo equivalente SHALL ser reutilizado sem duplicação. Conflitos SHALL exigir escolha entre manter existente, atualizar definição ou importar como cópia. Atualizar MUST NOT modificar posses já distribuídas; copiar SHALL gerar nova identidade portável. Cancelar MUST NOT modificar o catálogo.

#### Scenario: Reimportar pacote
- **WHEN** um pacote já importado é importado novamente sem diferenças
- **THEN** seus itens são reconhecidos como equivalentes e não são duplicados

#### Scenario: Mesmo nome com identidades distintas
- **WHEN** dois itens compartilham o nome mas possuem identidades portáveis diferentes
- **THEN** a prévia os trata como definições distintas

#### Scenario: Definição alterada após a prévia
- **WHEN** um item local muda entre validar e aplicar sua atualização importada
- **THEN** o sistema solicita nova validação em vez de sobrescrever usando uma prévia desatualizada

### Requirement: Aplicação integral e recursos seguros
Importar SHALL aplicar as escolhas como uma operação integral, incluindo disponibilidade de imagens e persistência. Uma falha MUST preservar o estado anterior e MUST NOT publicar uma importação parcial à sincronização. Recursos importados SHALL ser imagens raster validadas, sem execução de conteúdo, leitura de caminhos fornecidos pelo pacote ou download de URLs externas.

#### Scenario: Falha durante aplicação
- **WHEN** a gravação de uma imagem ou a persistência do catálogo falha
- **THEN** o catálogo anterior permanece íntegro, nenhuma referência quebrada é publicada e a interface permite tentar novamente

#### Scenario: Recurso externo no pacote
- **WHEN** um pacote usa caminho local, URL remota ou imagem não permitida como recurso
- **THEN** a importação é recusada antes de modificar dados
