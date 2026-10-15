# Calendários do mundo

Um mundo pode ter vários calendários. Várias linhas do tempo podem usar o mesmo calendário; seus eventos continuam independentes.

## Regras e datas

O ano repete sua estrutura de meses. Cada mês tem nome, abreviação e quantidade de dias; o total anual é a soma dos meses. Um calendário sem meses usa diretamente os dias por ano. Anos bissextos e dias intercalares não fazem parte desta versão.

Semanas podem continuar entre meses ou reiniciar a cada mês. No calendário sem meses, o reinício ocorre a cada ano. A semana pode ser desabilitada.

Horas por dia, minutos por hora e segundos por minuto são configuráveis. A equivalência terrestre é opcional: um dia de 30 horas locais pode durar 36 horas terrestres, tornando cada hora local equivalente a 72 minutos terrestres. Essa equivalência mede duração; não indica que datas de calendários diferentes sejam simultâneas.

Uma data pode indicar apenas o ano, o mês ou o dia. Horário exige um dia definido. Deixar o horário vazio significa que ele é desconhecido, e não meia-noite.

## Contagem dos anos

Uma contagem possui um marco de referência e nomes para antes e depois dele. Por exemplo: antes da Revolução (AR) e pós-revolução (PR). O primeiro ano posterior pode ser zero ou um; o lado anterior começa em um e conta regressivamente.

A virada acompanha o ano do calendário. Quando o marco começa no meio de um ano, os trechos antes e depois dele são os primeiros anos de seus respectivos lados. O próximo ano civil altera a contagem. Uma data no primeiro ano precisa pertencer ao trecho válido do lado escolhido.

Várias contagens podem apresentar a mesma data sem alterar sua posição. Com doze meses, Sexto mês com 40 dias e origem no começo do ano, a data canônica de ano 3, mês 6, dia 37 aparece como:

- `37/06/0004 PR`, no formato curto.
- `37º dia do Sexto mês, ano 4 pós-revolução`, no formato narrativo.

Formatos possuem variantes por precisão, para que uma data anual não ganhe dia e mês inventados. Estações são intervalos recorrentes; podem cruzar a virada anual e se sobrepor.

## Contrato e preservação

As regras e as datas usam contratos JSON com versão 1. Datas registram calendário, revisão, ano canônico, precisão e somente componentes conhecidos. Ano canônico zero é uma coordenada técnica, independente do ano zero exibido. O motor calcula ordinais de dias com divisão inteira, inclusive para anos negativos; horários permanecem separados dos dias para evitar perda de precisão.

Rótulos e formatos não deslocam datas. Mudanças estruturais publicam uma revisão, mantendo os usos existentes nas regras anteriores até uma migração revisada. Calendários e revisões referenciados não podem ser excluídos.

As migrações do banco adicionam entidades e colunas sem ativar calendários em linhas do tempo antigas. Os campos numéricos e textuais antigos permanecem preservados. Mantenha um backup do vault antes de atualizar; voltar a uma versão anterior do aplicativo requer restaurar um backup compatível, pois versões antigas não conhecem os novos contratos.

Calendários funcionam offline. A sincronização opcional transporta regras e vínculos; uma revisão ainda indisponível é informada e a data é preservada para resolução posterior.


## Configurar e salvar

Abra **Calendários** na navegação do workspace, escolha o mundo e clique em **Novo calendário**. O ponto de partida usa doze meses de trinta dias. Crie outro calendário no mesmo mundo para representar culturas ou tradições diferentes; cada um mantém suas regras.

O editor organiza **Estrutura**, **Semana**, **Tempo**, **Contagem dos anos**, **Estações** e **Formatos** na navegação lateral. O formulário fica ao centro e a prévia à direita; em áreas menores, a prévia passa para baixo. Os botões de seta reordenam meses e dias sem exigir arraste. Alterações permanecem no rascunho até **Salvar calendário**; **Descartar** recupera a última configuração salva. A saída com alterações pendentes é bloqueada para permitir essa escolha.

Em **Tempo**, informe horas por dia, minutos por hora e segundos por minuto. Para equivalência terrestre, escolha a unidade e clique em **Aplicar duração** antes de salvar. Em **Formatos**, abra a variante desejada, adicione componentes e textos literais e confira a data de exemplo. **Usar data** aplica a seleção; **Limpar** remove uma data opcional. Um horário só é incluído quando você o habilita.

## Associar uma linha do tempo

Na linha do tempo, abra a configuração de calendário. O assistente tem quatro etapas:

1. **Calendário**: selecione calendário, revisão, contagem e formato do mesmo mundo.
2. **Correspondência das datas**: informe se uma unidade antiga representa um ano ou um dia e associe uma posição a uma data. Gere as correspondências e revise cada acontecimento. Posições fracionárias exigem associação manual; o texto da data antiga é preservado.
3. **Eras existentes**: escolha individualmente quais continuam como períodos narrativos e quais originam contagens dos anos. As contagens entram no calendário compartilhado. O fim narrativo, o registro de origem, textos e imagens permanecem preservados.
4. **Revisão final**: compare as posições anteriores com as datas propostas e use **Confirmar transformação**. Cancelar em qualquer etapa não aplica o plano.

Os períodos convertidos podem ser consultados na timeline em **Períodos de origem das contagens**. Editar o período de origem não altera silenciosamente o marco da contagem: a configuração do calendário mantém sua própria referência.

Para trocar revisão ou calendário, repita a revisão dos vínculos. Um calendário diferente exige associação explícita das datas. Para voltar, use **Remover vínculo e manter cronologia livre**. O aplicativo projeta as datas atuais, inclusive acontecimentos novos, nas posições livres e preserva as datas estruturadas para consulta; contagens compartilhadas permanecem no calendário.

## Navegar e editar acontecimentos

As escalas são séculos, décadas, anos, meses, semanas e dias. Meses e semanas só aparecem quando existem no calendário. **Ir para data** centraliza a seleção. Os controles de zoom mantêm a data focal; Ctrl + roda amplia na posição do ponteiro. A régua é calculada para a região visível, sem construir todos os dias de milhares de anos.

Meses usam suas durações reais: um mês de quarenta dias ocupa o dobro de um de vinte dias na mesma escala. Eventos e marcos usam o seletor compartilhado nos formulários. Se o acontecimento só é conhecido pelo ano, selecione essa precisão; ampliar a timeline não inventa o dia nem o horário.

A timeline com calendário mantém as barras, os eventos pontuais em losango, os marcos circulares e o índice narrativo da cronologia livre, incluindo cores, ícones, imagens e descrições. O calendário define as datas e a régua temporal.

Arraste o corpo do acontecimento para movê-lo e escolha ajuste por dia, semana, mês ou ano. Eventos e marcos mantêm suas faixas verticais; arraste para cima ou para baixo para reorganizá-los. Arraste as extremidades de uma barra para alterar apenas o início ou o fim, ou abra o formulário para editar as datas pelo seletor. A barra acompanha o arraste antes da gravação. Eventos podem ter início e fim iguais, formando um ponto único, e podem ser ampliados novamente pelas extremidades tanto na cronologia livre quanto com calendário. O redimensionamento preserva a precisão das datas, mas pode alterar a duração, inclusive entre meses com tamanhos diferentes. A movimentação preserva duração e precisão; quando isso não é possível, a interface informa o impedimento e a edição por formulário permite revisar as datas. A gravação precisa terminar antes de sair da aba. Acontecimentos próximos são agrupados e o grupo oferece acesso individual a todos eles. A exibição opcional de estações inclui seus nomes.

## Campo de data do calendário

Na configuração de campos, escolha **Data do calendário**. A política pode ser um calendário fixo por mundo ou um calendário selecionável pelo usuário. Configure a permissão de horário. O campo usa os calendários do mundo da entidade; quando há mais de um contexto, escolha o mundo da data.

Datas existentes mantêm a revisão em que foram registradas. Se uma regra ainda não chegou pela sincronização, o campo informa a dependência ausente e preserva o valor original. Alterar uma configuração fixa com valores existentes abre uma revisão de impacto: cada valor precisa ser validado ou associado explicitamente antes da confirmação. Uma data inválida não substitui o último valor válido.

Para exportação e importação de layouts com esse campo, consulte [Referências portáveis de calendário](calendar-layout-portability.md).

## Limites desta versão

Não há anos bissextos, dias intercalares, ciclos lunares, feriados nem conversão automática entre calendários. A duração terrestre compara intervalos, sem definir uma origem universal entre mundos ou calendários.


## Organizar formatos e usar textos condicionais

Em **Formatos**, abra a variante desejada e use as setas de cada parte para mover componentes e textos para cima ou para baixo. A ordem da lista é a ordem de exibição. A prévia atualiza o rascunho; **Salvar calendário** confirma as mudanças.

**Adicionar texto condicional** cria uma parte que pode ser posicionada como as demais. Escolha o componente, a comparação e o valor, depois informe **Se verdadeiro**, **Caso contrário** e, opcionalmente, **Quando faltar informação**. O exemplo inicial usa **Dia menor que 13**: dias 1 a 12 mostram “Dia de luz”; dia 13 em diante, “Dia da noite”. Para incluir o dia 13 no primeiro grupo, escolha **Menor ou igual a**. **Entre** inclui os dois limites.

As comparações podem usar dia, número do mês, ano exibido na contagem selecionada, número do dia da semana, dia do ano, hora, minuto e segundo. Sem meses, Dia é o dia do ano. O número da semana segue sua ordem configurada, começando em 1. Combine várias comparações com **Todas as condições (E)** ou **Qualquer condição (OU)** e adicione outras partes condicionais para criar rótulos independentes.

Uma data anual não informa dia nem mês; um dia sem horário não informa hora zero. Esses componentes ficam desconhecidos. Em E, uma condição falsa basta para o resultado falso; em OU, uma verdadeira basta para o verdadeiro. Quando as demais comparações não determinam o resultado, aplica-se **Quando faltar informação**. Deixe esse texto vazio para omitir a parte.

As condições não alteram a data, o tamanho do dia ou as estações. São regras de apresentação, sem execução de scripts. A ordem e as condições acompanham a exportação de layouts. Formatos anteriores continuam funcionando; versões antigas do aplicativo que não conhecem partes condicionais não podem interpretar esse novo formato.


## Preencher a data na ficha

O campo dinâmico mostra um input compacto com a data formatada e um botão de calendário embutido. Clique no input ou no botão para abrir a seleção. O painel aparece sobre a ficha, usa a rolagem padrão do aplicativo e não depende da altura reservada ao campo.

No painel, escolha o mundo quando houver mais de um contexto e o calendário quando a configuração permitir. Defina a precisão e os componentes da data e clique em **Usar data** para confirmar e gravar o campo. A seleção fecha e o input mostra o valor salvo. Fechar pelo botão, Escape ou fora do painel mantém o valor anterior. Trocar apenas o calendário não converte nem grava automaticamente uma data.

O botão de limpar remove explicitamente o valor. Calendário fixo mantém a associação configurada, e regras ainda indisponíveis mostram um aviso preservando o valor original.
