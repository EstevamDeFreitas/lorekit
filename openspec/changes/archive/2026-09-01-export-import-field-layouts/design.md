## Context

Os layouts persistem como `UiConfigPayload` em configuracoes por escopo ou em templates. Itens de campos dinamicos atualmente usam tokens com o ID local do banco (`dynamic:<uuid>`), que nao sao portaveis. O editor ja conhece o catalogo de campos e cria campos dinamicos; a secao "Campos Globais" em Settings e o ponto central para configuracoes e templates globais.

## Goals / Non-Goals

**Goals:**

- Definir um contrato JSON versionado, independente de IDs locais, para um layout de uma entidade.
- Oferecer exportacao no editor de layout e importacao na tela principal de Campos Globais.
- Fazer uma prevalidacao atomica que resolva campos dinamicos antes de modificar o banco.
- Reutilizar campos dinamicos equivalentes e impedir campos homonimos com definicao conflitante.

**Non-Goals:**

- Exportar valores preenchidos nas entidades, configuracoes individuais ou configuracoes por entidade-pai.
- Sincronizar layouts automaticamente entre maquinas ou manter um catalogo remoto de layouts.
- Alterar os campos originais previstos pelo schema da entidade.

## Decisions

### Documento JSON portavel e versionado

O documento tera um identificador de formato, uma versao, `entityTable`, `layout` (colunas, altura da linha e itens) e uma lista de `dynamicFields`. Campos originais permanecerao como tokens `schema:<key>`. Para campos dinamicos, o documento usara uma chave semantica derivada do nome normalizado, enquanto a lista carregara nome, tipo, opcoes, indicador de editor e entidade de destino, quando aplicavel.

Na importacao, os tokens semanticos serao convertidos para os UUIDs locais somente depois que todos os campos forem resolvidos. Isso evita exportar IDs de SQLite que nao existem em outra instalacao. Exportar o `UiConfigPayload` bruto foi descartado porque ele preservaria esses IDs locais e quebraria o layout importado.

### Prevalidacao antes de qualquer persistencia

O servico de configuracao recebera uma operacao de analise/importacao que valida formato, versao, entidade, campos de schema, geometria basica e todos os campos dinamicos. Ela retornara um plano com campos a criar, campos a reutilizar, layout local resolvido e conflitos. A interface exibira os erros e uma previa/resumo antes de confirmar.

Somente apos uma validacao sem conflitos e uma decisao de destino confirmada a operacao criara campos e salvará o layout. A alternativa de criar cada campo durante a leitura foi descartada porque deixaria alteracoes parciais quando um conflito fosse encontrado mais adiante.

### Igualdade de campos dinamicos

O nome sera comparado de forma normalizada (sem espacos nas extremidades e sem distinguir maiusculas/minusculas). Para ser reutilizavel, o campo local deve ter a mesma definicao relevante: tipo, configuracao de opcoes ou proporcao de imagem, indicador de editor e entidade de destino. Mesmo nome com qualquer diferenca sera um erro bloqueante, conforme a decisao do produto; nao havera duplicacao silenciosa nem sobrescrita de campos existentes.

### Destino somente para configuracao global ou template

A importacao sera iniciada em Settings > Campos Globais. A entidade vem do arquivo, nao da selecao atual da tela. Se essa entidade ainda nao tiver configuracao global, o layout sera salvo como global. Se ja houver uma, a interface apresentara exatamente "Substituir", "Criar novo template" e "Cancelar". A criacao de template pedira um nome, com sugestao derivada da importacao, para evitar uma sobrescrita por nome no comportamento atual de `saveTemplate`.

### Entrada e saida de arquivo

A exportacao produzira um `Blob` JSON e acionara o salvamento compativel com a janela Electron. A importacao de arquivo usara um seletor restrito a JSON e a entrada colada usara o mesmo analisador, mantendo um unico caminho de validacao. A possibilidade de depender apenas de handlers IPC foi descartada para nao ampliar a superficie do preload quando a API de arquivos do renderer atender ao fluxo.

## Risks / Trade-offs

- [Versoes futuras do layout podem ser incompativeis] -> O identificador e a versao do formato permitem mensagens claras e adaptadores de migracao futuros.
- [Campos de schema podem divergir entre versoes do app] -> A importacao valida todos os tokens antes de gravar e mostra os campos indisponiveis.
- [Um documento malicioso pode conter grande volume de itens] -> Validar tipos, limites razoaveis e geometria antes de montar o layout ou persistir dados.
- [Nomes semelhantes podem representar campos distintos] -> A comparacao por nome e definicao falha de modo seguro ao encontrar diferencas, exigindo ajuste explicito do arquivo ou do campo local.

## Migration Plan

Nenhuma migracao de banco e necessaria. Layouts existentes continuam usando os tokens locais atuais internamente; somente o adaptador de exportacao os transforma em referencias portaveis. Em caso de falha de importacao, a prevalidacao impede gravacoes. Caso seja necessario reverter a funcionalidade, os registros existentes de configuracao e campos dinamicos permanecem compativeis.
