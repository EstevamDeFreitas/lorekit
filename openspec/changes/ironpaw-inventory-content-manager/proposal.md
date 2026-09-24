## Why

A ficha Ironpaw possui uma aba de inventário sem funcionalidade, e o Gerenciador de Conteúdo ainda é um componente vazio. Jogadores precisam cadastrar e compartilhar itens reutilizáveis, organizar suas posses visualmente e distinguir equipamentos vestidos, armas em uso e recursos consumíveis, respeitando as regras narrativas do sistema.

## What Changes

- Disponibilizar o Gerenciador de Conteúdo abaixo de Vocações, integrado às abas do workspace, inicialmente com um catálogo de itens Ironpaw.
- Cadastrar itens comuns, ferramentas, consumíveis, armas, proteções e vestíveis, com propriedades específicas, raridade opcional e característica de item único.
- Implementar mochila em grid expansível de uma célula por item/pilha, quantidades, reordenação, uso de consumíveis e edição das cópias do personagem.
- Disponibilizar capacete, armadura, calças, botas, luvas, arma primária, arma secundária e arco/arma reserva; permitir equipar por arraste ou comandos acessíveis.
- Separar definições do catálogo das cópias possuídas; alterações no catálogo não modificam fichas silenciosamente.
- Importar e exportar pacotes JSON versionados, incluindo imagens portáveis, prévia de validação, resolução de conflitos e aplicação atômica, seguindo a experiência da portabilidade de layouts.
- Mostrar benefícios contextuais e calcular a contribuição da proteção principal ao máximo de PR sem restaurar PR gasto ao trocar equipamentos.
- Preservar dados existentes e integrar persistência, histórico e sincronização. Redução automática de dano, encaixe de itens de múltiplas células, capacidade/peso, comércio e automação geral de efeitos ficam fora desta entrega.

## Capabilities

### New Capabilities
- `ironpaw-item-catalog`: cadastro e navegação do catálogo com características aderentes às regras Ironpaw.
- `ironpaw-inventory-equipment`: cópias por personagem, mochila visual, equipamentos e contribuição explícita de proteção aos PR.
- `ironpaw-content-portability`: compartilhamento validado e atômico de definições de itens e imagens.

### Modified Capabilities

Nenhuma. As regras existentes de vocação, espécie e portabilidade de layouts permanecem vigentes; o novo fluxo de itens possui contrato próprio.

## Impact

- Frontend Angular: componentes Ironpaw existentes, novos componentes de inventário/catálogo, navegação lateral, registro de componentes do workspace e serviços tipados.
- SQLite: evolução aditiva de `IRPWItem`, associação explícita com `Item`, JSON versionado em `IRPWCharacterSheet.inventory` e extensão compatível de `defensepoints`.
- Infraestrutura: migrações, triggers/contratos de sincronização, histórico, armazenamento de imagens e operações transacionais com persistência em disco/browser.
- Compatibilidade: preservar fichas antigas, configurações de item legadas e os fluxos desktop/web; não requer serviço externo nem nova dependência obrigatória.
- Referência de domínio: documento fornecido pelo usuário, `Sistema Ironpaw (1).md`, especialmente Armas, Proteções e Itens e Pontos de Resistência.
