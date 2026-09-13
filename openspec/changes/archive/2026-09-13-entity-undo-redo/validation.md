# Validação da implementação

Data: 2026-09-13.

## Testes automatizados

- Suíte Angular em ChromeHeadless: 147 testes aprovados, incluindo sequência entre campos, isolamento por entidade, agrupamento, composição, capturas fora de ordem, falhas de persistência e comandos concorrentes.
- Integração com inputs, textarea, botões, atalhos, pesquisa e diálogo de configuração.
- Editor.js e Tiptap reais: restauração antes do autosave, fechamento imediato, campo oculto, remontagem e troca de motor com formatação, menção, imagem e lista canônicas.
- SQLite real: campos dinâmicos independentes, criação de valores ausentes, remoção de template e atualização de texto JSON sem restaurar números ou campos vizinhos.

## Interface e persistência

O script isolado `scripts/entity-history-qa.cjs` foi executado com o Electron instalado e o servidor Angular local na porta 4401. Ele usa uma pasta temporária, sem acessar o banco pessoal, conta ou backend de produção.

- Desktop e web: fluxo nome → texto rico → dois desfazeres → dois refazeres, alternando botões e Ctrl+Z/Ctrl+Y, aprovado nos dois motores.
- F5 interno e três ciclos de fechar/reabrir: histórico e conteúdo preservados; controles desmontados desregistrados.
- Documento de aproximadamente 120 KB: conteúdo completo preservado após restauração e reabertura nos dois motores desktop.
- Campo personalizado oculto: desfazer/refazer e persistência aprovados em desktop e web.
- Dois painéis: edição/restauração isolada e ativação por foco aprovadas.
- Capturas em 1200×800 e 500×800 inspecionadas: botões antes da pesquisa, sem sobreposição; nomes acessíveis, dicas de campo/atalho, indisponibilidade e foco implementados.

## Builds e escopo

Comandos finais executados: `npm.cmd test -- --watch=false --browsers=ChromeHeadless`, `npm.cmd run build`, `npm.cmd run build:web`, `git diff --check` e `openspec.cmd validate entity-undo-redo --strict`.

Os builds mantêm avisos existentes de tamanho de bundle/CSS, Sass `@import`, CommonJS de sql.js e imports não utilizados em áreas não relacionadas. Não houve alteração de dependências.

O histórico dura somente a sessão da aplicação. F5 interno preserva as etapas; recarregar a janela completamente ou encerrar/trocar o workspace encerra a sessão.
