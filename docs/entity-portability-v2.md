# Exportação/importação de entidades v2

## Uso

No cabeçalho do personagem, escolha **Exportar .lorekit**. Selecione a inclusão dos filhos, revise os avisos, prepare a prévia e baixe o arquivo. A prévia congela os dados exportados e expira em 30 minutos.

Na barra de pesquisa, escolha **Importar**, abra um `.lorekit` v2 e selecione o mundo de destino. Resolva cada referência externa escolhendo uma entidade elegível ou removendo o vínculo; menções removidas viram texto. Definições dinâmicas equivalentes são reutilizadas. Para nomes com definições diferentes, informe um novo nome, gere a prévia novamente e escolha **Criar cópia**. Nenhum registro existente é sobrescrito. Workspaces somente leitura não permitem importação.

## Conteúdo e limites

Inclui personagem, descendentes opcionais, valores e definições dinâmicas, organização da ficha, personalização, imagens, documentos próprios e seus filhos, e estado armazenado da ficha Ironpaw. A exportação não segue pais, irmãos ou outros consumidores de campos compartilhados. Referências externas não puxam os registros apontados. Ciclos, múltiplos donos indevidos, dados inacessíveis e vínculos entre mundos são rejeitados.

Inventário Ironpaw mantém snapshots, quantidades, equipamento e imagens, desvinculando IDs do catálogo de origem. Favoritos herdados de espécie/vocação são omitidos com aviso e aceite. A carteira inclui novas cópias das definições/unidades de moeda usadas. Links, moodboards e outros anexos sem adaptador exigem omissão explícita. Blocos de editor opacos não são exportados; prepare conteúdo suportado antes de tentar novamente. URLs remotas de imagem arbitrárias não são baixadas automaticamente.

| Limite | Valor |
| --- | --- |
| Arquivo completo | 100 MiB |
| Manifesto UTF-8 | 8 MiB |
| Registros | 5.000 |
| Profundidade | 64 |
| Imagens | 2.000 |
| Uma imagem | 25 MiB |

São limites de rejeição, não promessa de desempenho máximo. O perfil de memória de grandes pacotes ainda precisa ser medido.

## Formato

ZIP **STORE**, sem compressão: `manifest.json` e `assets/<chave>`. Manifesto `format: lorekit-entity-bundle`, `version: 2`, entidades `schemaVersion: 1`. Chaves são locais ao pacote; IDs do banco de origem, caminhos locais e metadados de sincronização não são publicados. Menções, relações, galerias, tokens de layout, ficha e carteira são reescritos na importação.

A validação rejeita arquivos comprimidos/encriptados, symlinks, nomes duplicados, caminhos fora do pacote, entradas extras, tipos/colunas desconhecidos e conteúdo JSON fora do contrato. CRC32, SHA-256, tamanho e assinatura raster verificam os recursos. PNG, JPEG, WebP, GIF e AVIF são aceitos; assinatura não equivale à decodificação completa da imagem. Arquivos v1 e backups completos não são compatíveis com este importador.

## Persistência e retomada

A aplicação serializa operações, pausa sync, revalida permissões/identidade/destino e insere linhas em transação. Imagens usam novas identidades, journal local e outbox normal de blobs. Uma confirmação local (`_EntityImportReceipts`, migração 10) evita duplicar o mesmo plano em retries. Uma nova importação intencional cria outra cópia. Falhas antes do commit desfazem linhas e compensam imagens; falhas de persistência depois do commit preservam os recursos para retomada. O journal não transforma disco e SQLite em uma transação única.

## Validação desta entrega

- `npm run test:entity-portability`: suíte de regressão, conteúdo/ZIP e round trips SQLite; **63/63 testes passaram**.
- Typechecks da aplicação e specs e builds de produção desktop e web passaram. Os builds mantêm avisos de orçamento/estilos/CommonJS já existentes.
- Navegador com dois workspaces sintéticos em modo desktop e IPC Electron simulado: exportação de personagem/filho/imagem/documento/ficha, remoção de referência externa, renomeação de campo conflitante e importação; linhas persistidas e preservação da definição existente conferidas.
- Navegador web com dois workspaces isolados, IndexedDB real e HTTP de autenticação/sync simulado: mesmo fluxo completo passou, incluindo persistência do banco e assets. Não foram usadas contas/dados reais.
- SQLite: rollback, retry concorrente sem duplicação, reimportação intencional, destino alterado, falha de persistência após commit, reabertura do banco e contrato de payload sync entre dois bancos isolados.

Ainda pendentes: execução em Electron real, autenticação e serviços web reais, rede offline/online e sync com servidor e dois dispositivos reais. Nenhum teste local acima comprova essas integrações. O validador CLI OpenSpec permaneceu pendente devido ao bloqueio anterior da revisão automática de aprovação.
