## Why

As edições de texto do Lorekit não possuem uma experiência consistente de desfazer/refazer, e a troca de abas desmonta os editores, impedindo a continuidade de um histórico mantido apenas no campo. Um histórico de sessão por entidade permite recuperar alterações em diferentes campos e navegar entre entidades sem perder essa capacidade.

## What Changes

- Introduzir uma sequência de alterações textuais por entidade, compartilhada entre nome, campos simples, textos ricos e campos textuais personalizados, em ambos os editores disponíveis.
- Fazer Ctrl+Z desfazer a última etapa da entidade ativa e Ctrl+Y refazê-la, independentemente do campo da entidade em foco; editar nome e depois descrição permite desfazer descrição e depois nome.
- Adicionar botões Desfazer e Refazer à esquerda da pesquisa global, com disponibilidade e dicas contextualizadas pela entidade do painel ativo.
- Preservar o histórico durante a sessão, inclusive ao alternar abas, fechar e reabrir uma entidade e recarregar componentes pelo F5 interno; encerrar a sessão descarta o histórico.
- Agrupar digitação contínua em etapas, delimitar colagens e formatações e descartar o caminho de refazer da entidade quando houver uma nova edição após desfazer.
- Integrar restauração e salvamento automático, preservando formatação e evitando que gravações pendentes sobrescrevam o estado restaurado.
- Manter a edição da pesquisa e de formulários externos à entidade fora desse histórico.

## Capabilities

### New Capabilities

- `entity-edit-history`: Histórico de sessão de alterações textuais por entidade, seus atalhos, controles globais, agrupamento e integração com persistência.

### Modified Capabilities

Nenhuma. A seleção dos editores e o formato canônico de documentos continuam regidos pelas especificações existentes.

## Impact

- Frontend Angular: novo serviço de histórico de sessão e integração com inputs, textareas, `EditorComponent`, `EntityConfiguredFieldsComponent` e páginas que editam textos diretamente.
- Barra superior em `app.component.html`, resolução de entidade/painel via `TabManagerService` e ciclo de vida do workspace.
- Adaptadores de Editor.js e Tiptap, identificação estável dos campos e coordenação com `FlushableDebounce` e o fluxo de saves pendentes.
- Validação de comportamento em desktop e web, com ambos os editores e com múltiplos painéis.
- Sem migração de banco, formato persistido de histórico ou nova API de backend. Criação/exclusão de entidades, relacionamentos, imagens fora do texto e configuração de layouts não integram o histórico desta change.
