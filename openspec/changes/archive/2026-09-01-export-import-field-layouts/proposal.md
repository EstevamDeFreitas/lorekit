## Why

As configuracoes de layout de campos e os campos dinamicos associados ficam isolados no banco local de cada instalacao. Exportar e importar um layout torna possivel reutilizar configuracoes entre maquinas ou projetos sem recria-las manualmente.

## What Changes

- Permitir exportar um layout de campos como um arquivo JSON portavel, incluindo a entidade de destino, os itens do grid e as definicoes dos campos dinamicos usados pelo layout.
- Adicionar importacao na tela principal de configuracao global de campos, aceitando a selecao de um arquivo JSON ou a colagem do seu conteudo.
- Detectar a entidade de destino a partir do documento importado e validar seu formato, seus campos de schema e seus campos dinamicos antes de persistir qualquer alteracao.
- Criar os campos dinamicos ausentes que forem referenciados pela importacao; interromper a importacao quando um campo de mesmo nome possuir uma definicao incompativel.
- Quando ja existir uma configuracao global para a entidade importada, solicitar que o usuario escolha entre substitui-la, criar um novo template ou cancelar.

## Capabilities

### New Capabilities

- `field-layout-portability`: exportar e importar layouts de campos com seus metadados e dependencias de campos dinamicos.

### Modified Capabilities

- Nenhuma.

## Impact

- Afeta o editor de layout de campos, a secao "Campos Globais" das configuracoes, o modelo e o servico de configuracao de campos dinamicos.
- Pode exigir integracao de selecao/gravação de arquivo no Electron ou uso de APIs do navegador compatíveis com o aplicativo desktop.
- Nenhuma alteracao de banco obrigatoria e nenhuma dependencia externa planejada.
