# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O Lorekit atende principalmente autores de mundos e mestres/jogadores de RPG. Eles usam o produto para organizar lore, entidades do cenário e fichas jogáveis durante a criação e a preparação de sessões.

## Product Purpose

O Lorekit centraliza worldbuilding e conecta esse conteúdo a fichas jogáveis. O sucesso do produto é permitir que a pessoa encontre, edite e reutilize informações do seu mundo com segurança, incluindo o gerenciamento de personagens e regras do Ironpaw.

## Positioning

O Lorekit une um workspace de worldbuilding a ferramentas de ficha dentro do mesmo contexto de dados. O conteúdo narrativo, as entidades do mundo e as decisões da ficha permanecem ligados e reutilizáveis, sem exigir um serviço online para o uso principal.

## Operating Context

O uso principal acontece no desktop Windows, em um aplicativo Electron que executa o frontend Angular. A pessoa alterna entre entidades do mundo, documentos, relações e fichas Ironpaw; prepara material antes de uma sessão e consulta ou ajusta a ficha durante o uso do sistema. Sincronização e backup em nuvem são recursos opcionais, enquanto a operação normal permanece local e offline.

## Capabilities and Constraints

- O produto gerencia mundos, documentos, locais, personagens, espécies, culturas, organizações, relações e outros conteúdos de worldbuilding.
- As fichas Ironpaw reutilizam entidades do Lorekit e incluem vocações, espécies, atributos, recursos, inventário e regras narrativas.
- O Gerenciador de Conteúdo do Ironpaw cadastra itens, suas características, compatibilidades, cores, efeitos narrativos e dados específicos por categoria.
- Itens podem ser compartilhados por importação e exportação em formato estruturado; cópias usadas em fichas preservam seu próprio estado.
- O produto funciona offline-first, com dados locais e persistência em SQLite via sql.js; serviços de nuvem são opcionais.
- A distribuição principal é desktop Windows/Electron, com frontend Angular standalone e roteamento hash.
- A interface e a documentação voltada ao usuário são em português.
- As regras do Ironpaw fornecidas em `Sistema Ironpaw (1).md` são a referência de domínio para as funcionalidades desse módulo.
- O padrão visual existente do Lorekit deve ser preservado e evoluído de forma consistente nas novas superfícies.

## Brand Commitments

- O nome do produto é Lorekit.
- A experiência deve manter a identidade e os padrões visuais já existentes no aplicativo.
- A terminologia de worldbuilding e Ironpaw deve permanecer clara em português.

## Evidence on Hand

- Código do aplicativo em `lorekit-frontend/src/app/` e processo Electron em `main.js`/`preload.js`.
- Rotas e componentes existentes de worldbuilding e Ironpaw.
- Modelo e documentação de importação de itens em `lorekit-frontend/src/app/models/irpw-item.model.ts` e `docs/ironpaw-item-import-format.md`.
- Regras de domínio fornecidas pelo usuário em `C:\Users\Estevam\Downloads\Sistema Ironpaw (1).md`.
- Não há depoimentos, métricas de uso ou materiais de marketing confirmados no repositório; trabalhos futuros não devem fabricá-los.

## Product Principles

- Dados do usuário permanecem disponíveis localmente e sob seu controle.
- Worldbuilding e ficha devem funcionar como partes conectadas do mesmo workspace.
- Conteúdo narrativo e efeitos manuais devem permanecer explícitos, sem automações que inventem regras.
- Reutilização e compartilhamento devem preservar a autoria e a independência das cópias.
- Novas superfícies devem respeitar os padrões existentes e reduzir o esforço de organização.