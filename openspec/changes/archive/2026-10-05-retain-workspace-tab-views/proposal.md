## Why

Ao alternar entre abas abertas, o workspace destrói a tela atual e monta novamente a próxima. Isso repete carregamentos e inicializações custosos, especialmente no moodboard, e perde estado transitório da interface.

Manter vivas as instâncias das abas abertas deve tornar o retorno imediato, preservando edição e contexto sem deixar componentes inativos processarem ações ou gravarem estado obsoleto.

## What Changes

- Reter em memória a instância de cada aba aberta e reanexá-la ao alternar, liberando-a ao fechar a aba.
- Definir ativação e desativação explícitas para suspender interações globais e descarregar saves pendentes antes de uma tela ficar inativa.
- Coordenar a invalidação das instâncias retidas após recarga de componentes ou reconciliação de conteúdo remoto.
- Manter os pedidos de persistência integrados ao coordenador único do banco e evitar instâncias duplicadas para a mesma aba.

## Capabilities

### New Capabilities

- `workspace-tabs`: ciclo de vida das instâncias de abas abertas, isolamento de interações inativas, salvamento ao alternar e invalidação após refresh.

### Modified Capabilities

Nenhuma.

## Impact

- Shell do workspace: `TabManagerService`, `WorkspacePaneComponent` e o host dinâmico das telas.
- Ciclo de vida dos editores e páginas com listeners globais, em especial o editor de moodboard.
- Contrato de flush de saves pendentes e integração com refresh interno, histórico e sincronização remota.
- Persistência existente via `DbProvider` e `DatabasePersistenceCoordinator`; sem mudança no formato dos dados ou do layout serializado.
