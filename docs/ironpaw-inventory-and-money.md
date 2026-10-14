# Inventário, catálogo e dinheiro

## Itens compartilhados

A definição do item é compartilhada entre o Gerenciador de Conteúdo e as fichas que o utilizam. Alterações de nome, descrição, efeitos, aparência e regras no catálogo atualizam os inventários automaticamente. Quantidade, anotações e posição pertencem a cada ficha.

A criação rápida abre em um modal em **Inventário → Adicionar item → Criar item**. O item é salvo no catálogo e adicionado à mochila. Abra **Ações** no item ou clique em um equipamento para equipar, guardar, usar ou remover sem navegar até o fim do inventário. A edição da definição no menu afeta o catálogo e todas as fichas vinculadas.

Ao passar o mouse ou focar um equipamento pelo teclado, seus efeitos aparecem em uma dica. Se uma alteração do catálogo reduzir o limite de pilha, as unidades são divididas sem perda de quantidade. Equipamentos que perdem compatibilidade voltam à mochila; armas que passam a exigir duas mãos liberam o espaço secundário. Itens cujo registro de origem foi removido preservam a última definição conhecida.

O formato de inventário continua na versão 1: o snapshot é uma cópia de segurança e o identificador de origem mantém o vínculo. Formatos incompatíveis permanecem preservados.

## Configurações monetárias

Crie configurações em **Gerenciador de Conteúdo → Dinheiro**. Cada registro da tabela `IRPWCurrency` define nome, descrição/região e unidades ordenadas da menor para a maior. A ficha guarda seus saldos na coluna `wallet` de `IRPWCharacterSheet`, em um envelope de versão 1. A migração local 9 adiciona a estrutura e a configuração participa do contrato de sincronização.

Cada unidade pode indicar quantas unidades equivalem a uma da próxima. A última unidade não tem conversão. Uma conversão vazia mantém o saldo independente.

- Cobre (100) → Prata (100) → Ouro: 250 cobres e 199 pratas tornam-se 50 cobres, 1 prata e 2 ouros.
- Centavos (100) → Reais: 250 centavos tornam-se 50 centavos e 2 reais.
- Créditos, sem conversão: saldo em unidades inteiras.
- Várias unidades sem conversão: saldos independentes, sem limite de conversão.

No inventário, o dinheiro aparece acima dos equipamentos. Use **Configurar** para adicionar uma ou mais configurações à ficha. Os saldos são salvos ao alterar cada campo, com conversão automática para as unidades seguintes. **Converter**, dentro de **Configurar**, aplica as regras atuais após uma alteração da configuração. São aceitas quantidades inteiras não negativas dentro da precisão segura do JavaScript. Não há cotação nem troca automática entre configurações regionais diferentes.

Uma unidade com saldo não pode ser removida de uma configuração; uma configuração com saldo não pode ser retirada da ficha. Zere ou transfira os saldos manualmente antes dessas ações.

## Poderes e magias

Os cards usam uma grade responsiva, título maior e grau/custo próximos ao nome. Descrição e efeitos ficam à direita nas telas maiores. Básico/Menor usa verde, Intermediário/Médio azul e Mestre/Maior roxo, sempre acompanhados do nome do grau. Os detalhes e a edição ficam em seções expansíveis. A preparação de rolagem usa um botão de dados com identificação acessível.

A resistência permanente e temporária usa caixas inteiras. Valores fracionários antigos são arredondados ao carregar; a vida continua com suas regras próprias.
