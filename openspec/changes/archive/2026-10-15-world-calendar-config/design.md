# Design

## Context

Ver proposal.md para motivação e specs/ para os contratos de comportamento. Timeline guarda timeUnitName; Event e GreatMark combinam posições REAL, intervalos e texto de exibição; Age guarda intervalos associados à timeline. O editor atual calcula pixels por ano, arredonda posições e constrói a régua inteira. Portanto, apenas adicionar um seletor de calendário não fornece precisão diária nem zoom suficiente.

DynamicField usa opções JSON e DynamicFieldValue persiste valores textuais; os novos tipos slider/list/chart já possuem normalização e portabilidade em uma mudança existente, cujas integrações devem ser preservadas. O schema local e local-migrations.ts registram migrações numeradas e capturam alterações para sincronização. O registro de sync exige correspondência com a allowlist do servidor. PRODUCT.md e a implementação existente estabelecem operação offline e identidade visual escura com Inter e componentes reutilizáveis.

## Goals / Non-Goals

**Goals:** separar cálculo, apresentação e organização narrativa; reutilizar um motor puro em todos os seletores; assegurar conversão reversível e validação prévia; manter identidade visual e navegação existentes; impedir mudanças silenciosas na cronologia.

**Non-Goals:** usar Date/Intl como calendário fictício, introduzir um relógio em execução, universalizar instantes entre calendários ou transformar toda era narrativa em regra de numeração. As exclusões funcionais adicionais estão em proposal.md.

## Decisions

### 1. Modelo versionado por mundo

Criar Calendar com worldId, nome, descrição e metadados; CalendarRevision com calendarId, número de revisão, versão do contrato e regras JSON validadas. As regras contêm meses com IDs estáveis, ou daysPerYear no modo sem meses, semana, relógio, marcos/contagens, formatos e estações. Usar referências explícitas para localizar usos e bloquear exclusão; manter integração com relacionamentos/personalização conforme os padrões existentes.

JSON permite salvar a configuração coerente como uma unidade e evita sincronizar partes de uma semana ou mês separadamente. Alternativa: tabelas para cada mês e dia. Isso melhora consultas isoladas, mas aumenta complexidade transacional e de conflitos sem necessidade nesta primeira versão.

Mudanças em durações, ordem estrutural dos meses/dias, âncoras de contagem ou limites sazonais publicam revisão nova. Datas utilizadas continuam ligadas à revisão antiga. Rótulos e formatos podem ser atualizados na revisão sem alterar coordenadas. Revisões estruturais referenciadas não são sobrescritas; conflitos de alterações de apresentação seguem o mecanismo existente de sync. As revisões concorrentes têm UUIDs distintos, sem depender apenas de número sequencial.

### 2. Cronologia canônica própria

O motor recebe uma revisão validada e opera com ano canônico inteiro assinado, mês identificado por ID estável, dia e horário opcionais. O ano canônico zero é técnico, independentemente de a apresentação permitir ano zero. Dias são contados desde o primeiro dia desse ano. Prefixos acumulados de meses e divisão inteira com piso garantem conversões também para anos negativos.

Persistir um CalendarDate versionado contendo calendarId, revisionId, precisão, ano canônico e componentes presentes. Ordinal de dia e subdia são projeções derivadas/cacheáveis, nunca a única informação. Não armazenar século, década, dia da semana ou texto formatado como fonte de verdade. Não multiplicar todo o tempo por segundos em um único número grande: manter dia inteiro e segundos locais do subdia separados. Validar todos os inteiros e produtos com Number.isSafeInteger; rejeitar limites que excedam representação exata com erro de faixa, sem aceitar corrupção ou arredondamento.

Precisão anual ou mensal representa um intervalo de possibilidade [início, fim exclusivo), não uma data exata. Data diária sem horário representa o dia inteiro. Horário presente identifica subdia em segundos locais. Ordenar por limite inferior, indicando imprecisão; não afirmar ordem intradiária entre itens sem horário. Intervalos de eventos exigem que os limites sejam ordenáveis sem contradição: para faixas parciais, fim cujo limite inferior anteceda o limite superior possível do início requer revisão de precisão, salvo mesmo valor parcial tratado como ocorrência de precisão parcial. A projeção visual não altera o valor salvo.

Alternativa: Date, timestamps Unix e frações de ano. Foram descartados porque impõem meses, unidades e limites terrestres ou perdem exatidão e significado de datas parciais.

### 3. Ano, semana e relógio

Na primeira versão, todos os anos repetem a mesma estrutura. O assistente inicial pode distribuir um total desejado por uma quantidade de meses, mas depois o total é calculado; nunca salvar dois totais divergentes. No modo sem meses, daysPerYear é a regra. Meses e dias têm nomes não vazios; duplicatas são sinalizadas como ambíguas na edição e resolvidas por IDs internos.

Semana contínua usa ordinal e âncora de dia da semana no primeiro dia do ano canônico zero. No reinício mensal, usa índice do dia no mês; no modo sem meses, o reinício ocorre a cada ano. Quando semanas estão desligadas, ocultar nomes e a escala semanal.

Relógio mantém três níveis positivos inteiros, com defaults 24/60/60 e rótulos editáveis. dayDurationTerrestrialSeconds é opcional e positivo; entrada em horas é convertida para segundos terrestres. A proporção entre tempo local e terrestre serve somente para informar durações, não estabelece simultaneidade entre calendários. Na conversão de valores decimais, manter representação decimal normalizada para evitar deriva acumulada; a cronologia local não depende dessa equivalência.

### 4. Contagem dos anos e períodos narrativos

CalendarYearCount contém ID, marco em data canônica diária, nome/descrição, nomes e abreviações dos lados e primeiro ano posterior 0 ou 1. Toda data pode ser apresentada por qualquer contagem compatível. A data persistida continua canônica; trocar a contagem é apresentação.

A virada é civil: ocorre na virada anual do calendário, não no aniversário do marco. O trecho inicial posterior é o primeiro ano configurado; se há trecho anterior no mesmo ano, ele é ano 1 anterior. Anos anteriores contam regressivamente. Se a âncora é o primeiro dia do ano, o ano civil imediatamente anterior é ano 1 anterior; se começa no meio do ano, o trecho anterior desse ano é ano 1 e o ano civil anterior é ano 2. Isso evita datas duplicadas dentro de um mesmo lado/ano. O lado escolhido valida que mês e dia pertençam ao trecho válido do ano junto ao marco. Uma data anual junto ao marco representa apenas o trecho correspondente ao lado escolhido, e não todo o ano civil. Prévia explicará essas fronteiras e ano zero.

Décadas e séculos agrupam a numeração exibida em cada lado, começando em 1 quando não há zero e em 0 quando configurado no lado posterior. As fronteiras na régua são obtidas pelo motor, incluindo trechos parciais junto ao marco.

Age existente mantém o papel de período narrativo. Ao converter, criar contagem com origem registrada em um plano de conversão e preservar Age como fonte consultável, ocultando somente sua representação duplicada quando marcado como convertido. Conteúdo, imagens e personalização permanecem associados à fonte e disponíveis na contagem via vínculo de origem; não apagar nem mover assets compartilhados. O fim antigo de Age permanece no registro narrativo e não limita automaticamente a contagem posterior. Alternativa de mover todas as eras foi rejeitada pela existência de sobreposições e pela diferença entre intervalo histórico e referência cronológica.

### 5. Formatação e estações

Formatos são sequências versionadas de componentes permitidos e literais; sem eval ou linguagem executável. Oferecer presets curto/narrativo, preenchimento mínimo, ordinal e nomes. Cada preset tem variantes por precisão (ano, mês, dia, dia com horário), evitando heurísticas para remover palavras soltas de um formato diário. Builder visual é entrada principal; tokens avançados mapeiam para a mesma estrutura validada. Nunca analisar um texto formatado para recuperar a data.

Estações usam IDs, nome/cor e limites inclusivos de mês/dia ou dia do ano. Se fim precede início, pertencimento inclui os dois lados da virada. Sobreposições e lacunas são válidas. Não alteram duração de meses nem geram eventos. Exibir estações no seletor e como camada opcional da timeline, sem depender apenas de cores.

### 6. Vínculo da timeline e motor de régua

Adicionar referência opcional a calendário/revisão, contagem e formato na Timeline; adicionar valores estruturados opcionais de início/fim aos eventos e marcos. Manter colunas legadas e texto como proveniência e projeção livre. Novas datas são calculadas exclusivamente pelo motor; unidades textuais continuam para timelines sem vínculo.

Separar transformação coordenada/pixel, gerador de limites da régua e layout das faixas. Usar origem local ao viewport para não construir um canvas de largura proporcional a toda a história; gerar limites somente no intervalo visível com margem. Régua adapta escala à densidade e também permite escolha explícita. Meses têm larguras proporcionais a seus dias; semanas de reinício mensal têm trechos parciais nos limites do mês. Zoom preserva data sob cursor ou centro. Agrupar eventos por faixa visível e permitir abrir lista ou aproximar.

Arraste trabalha com unidade explícita e prévia. Para datas exatas, deslocamento preserva duração em dias/subdias. Para datas parciais, ajuste segue sua precisão e preserva a faixa de possibilidade. Se o calendário torna esses objetivos incompatíveis (por exemplo, intervalo mensal entre meses com durações diferentes), impedir o movimento silencioso e oferecer edição dos limites em formulário. Criar eventos no canvas preenche a precisão correspondente à escala; horários são editados pelo formulário, sem ampliar a régua além de dias nesta mudança.

### 7. Conversão em plano transacional

O serviço de planejamento lê a timeline, gera um snapshot com assinatura das fontes e produz correspondências sem escrever. Modos iniciais: uma unidade antiga equivale a ano ou dia, com posição/data de referência escolhidas. Frações, períodos atravessando contagens e valores inválidos exigem associação manual; não inferir a partir de texto livre. Permitir mapeamento por item quando o modelo uniforme não atende.

A revisão inclui eventos, marcos, eras, usos compartilhados, antes/depois e erros bloqueantes. A confirmação verifica se as fontes mudaram desde a prévia. Persistir vínculo, datas, contagens e proveniência numa transação local com persistência pausada até commit e captura de sync coerente. Falha antes de commit reverte tudo; falha ao persistir em disco mantém estado de erro e impede anunciar sucesso. Usar coordenação de persistência do projeto e testar a recuperação. Uma nova tentativa usa identificadores do plano para não duplicar contagens.

Guardar snapshot e mapeamento de projeção para remoção do vínculo e auditoria; datas criadas depois da migração recebem projeção livre derivada do ordinal, coerente com o mapeamento. Para voltar a cronologia livre, manter datas como histórico inativo e colunas numéricas utilizáveis. Não restaurar um snapshot antigo por cima de edições recentes. Troca de calendário exige associação explícita, sem supor origem comum ou que mesmo ordinal significa mesmo instante.

### 8. Campo dinâmico e portabilidade

Adicionar calendar-date ao catálogo, opções e valores JSON versionados. Política fixa mantém associação por mundo (worldId para calendarId/revisionId); política selecionável deriva opções do mundo da entidade. Cada valor inclui suas referências e contagem de apresentação. Se não houver mundo inequívoco, exigir contexto antes de selecionar. Definições globais não podem impor calendário de um mundo a outro.

Reutilizar CalendarDatePicker em eventos, marcos, eras/referências e campos configurados. Configuração muda com plano de impacto dos valores existentes; não reserializar datas por nova regra sem revisão.

Exportação de layouts aumenta a versão do documento, mantém leitores de versões anteriores e inclui manifesto de dependências com chaves locais ao arquivo, regra necessária e rótulos. Remover IDs de calendário, revisão, mundo e contagem das opções exportadas, substituindo-os por chaves portáveis, inclusive referências aninhadas. Seleção livre não exporta os calendários usados pelos valores; layouts nunca exportam valores. Importação resolve mundo, calendários e contagens existentes antes de comparar definições. A confirmação final continua aplicando regras atuais de conflitos e destino global/template. Não criar calendários automaticamente ao importar layout nesta versão.

### 9. UX/UI com Impeccable

Modo Operate e identidade herdada: Inter, tema escuro, acentos do sistema, personalização, botões e inputs existentes. Nenhuma redefinição global de DESIGN.md é necessária. A captura disponível denominada glass-timeline-desktop.png mostra outra superfície do workspace, portanto não serve como prova visual da timeline; validar telas atuais por execução ou evidências corretas antes da implementação visual.

Direção funcional proposta: lista de calendários filtrada por mundo e editor de página inteira, com navegação por Estrutura, Semana, Tempo, Contagem dos anos, Estações e Formatos. Prévia lateral mostra mês/ano, total de dias, exemplo curto/narrativo e relógio; em viewport estreito vira seção acessível sem competir com formulário. Estado inicial oferece configuração simples válida e ajuste progressivo; semanas, equivalência terrestre e horário são opcionais. Seções avançadas não impedem o primeiro calendário utilizável.

Editor usa rascunho e ação Salvar explícita, diferenciando mudanças de apresentação de publicação estrutural. Manter aviso de alterações pendentes integrado ao workspace. Erros junto ao campo, resumo para foco em erro e status de salvamento acessível. Reordenação tem botões além de arraste. Seletor de datas adapta campos ao calendário e mostra precisão antes do horário. Revisão de migração usa etapas de escolha, correspondência, eras e confirmação com comparação antes/depois; repetir uma etapa preserva o rascunho.

Durante apply, usar Impeccable para confirmar composição das novas superfícies com o usuário dentro da identidade existente, ler craft-floor imediatamente antes de editar UI e executar inspeção visual limitada a duas rodadas: desktop/viewport estreito juntos, correção em lote e confirmação. Essa confirmação trata composição, não reabre as decisões funcionais destes artefatos.

## Risks / Trade-offs

- Configuração anual repetitiva limita calendários irregulares -> manter versão das regras e adiar intercalação/bissextos explicitamente.
- Datas parciais e marcos no meio do ano têm limites pouco intuitivos -> mostrar precisão, trecho válido e prévia; validar inversão para ambas as contagens.
- Nova revisão pode fragmentar usos -> listar por revisão e migrar somente vínculos confirmados; não apagar histórico utilizado.
- Regras JSON são uma unidade de conflito -> versões estruturais imutáveis e preservação dos UUIDs concorrentes.
- Sync pode entregar referências antes das regras -> resolver dependências, preservar payload e mostrar estado pendente; transação local não promete atomicidade distribuída.
- Canvas antigo escala com toda a história -> refatorar projeção e régua por viewport antes de habilitar zoom diário.
- Banco local atualizado não garante downgrade seguro -> backup antes da migração e restauração de backup como rollback de versão; preservar colunas antigas sem prometer leitores antigos das novas regras.
- Campos globais atravessam mundos -> política fixa por mundo e associação explícita na portabilidade.

## Migration Plan

1. Implementar/testar motor e contratos, então adicionar schema e migração numerada após a versão presente no momento do apply (atualmente 9), sem ativar calendários nas timelines existentes.
2. Atualizar registro de sync, schema e allowlist do servidor com contratos compatíveis antes de clientes sincronizarem novas entidades. Estados com dependência ausente não são interpretados como outro calendário.
3. Disponibilizar cadastro e seletor, mantendo usos legados. Integrar timeline com novo motor e campo dinâmico/portabilidade.
4. Converter cada timeline apenas por plano revisado e confirmado, incluindo snapshot/proveniência e teste de rollback por falha.
5. Verificar banco legado, reabertura offline, dependências de sync, importação antiga e nova, precisão e navegação extensa. Rollback do aplicativo exige restaurar backup; desfazer vínculo usa projeção preservada e não exclui dados compartilhados.


## Refinamento: ordem e textos condicionais nos formatos

Cada variante mantém uma lista ordenada de partes. Botões de subir/descer reordenam componentes, texto literal e texto condicional, inclusive por teclado. A prévia usa imediatamente essa ordem e a persistência mantém a organização.

Uma parte condicional possui modo all/any, entre uma e vinte comparações e textos para verdadeiro, falso e desconhecido. Comparações permitidas: menor, menor ou igual, igual, diferente, maior ou igual, maior e intervalo inclusivo. Campos numéricos: dia, mês, ano exibido na contagem selecionada, posição do dia da semana, dia do ano, hora, minuto e segundo. Dia é relativo ao mês ou ao ano quando não há meses. Semana começa em 1 e depende de estar habilitada.

A avaliação usa lógica de três valores. Componentes não conhecidos pela precisão da data, horário ausente, mês inexistente e semana desabilitada produzem desconhecido. E é falso se alguma comparação for falsa; OU é verdadeiro se alguma comparação for verdadeira; nos demais casos, qualquer componente desconhecido torna o resultado desconhecido. O texto desconhecido vazio não exibe nada. Não executar expressões, scripts ou templates fornecidos pelo usuário.

O exemplo padrão usa dia menor que 13: dias 1 a 12 mostram Dia de luz e, do dia 13 em diante, Dia da noite. O operador é editável para incluir ou excluir o limite. Formatos sem condicionais continuam válidos. Regras condicionais são apresentação, mantêm o contrato de regras v1 e participam do manifesto de layout v3, sem IDs locais. Aplicativos anteriores que desconhecem essa parte não conseguem utilizar o formato; a restauração de uma versão anterior continua exigindo backup compatível.


## Refinamento: campo dinâmico compacto

O campo de calendário na ficha usa input de apresentação com data formatada, botão de calendário embutido e ação de limpar quando preenchido. A edição estruturada abre em CDK ConnectedOverlay, seguindo o padrão do ComboBox existente: origem no input, posições abaixo/acima, reposicionamento ao mudar tamanho, limites da viewport e fechamento ao rolar um ancestral. O painel possui foco protegido, Escape, restauração de foco e rolagem scrollbar-dark. As escolhas de mundo/calendário reutilizam ComboBox. A grade de uma linha não contém o formulário expandido.

A seleção é rascunho até Usar data. A confirmação emite o valor validado, fecha o painel e descarrega imediatamente o debounce do renderer de campos dinâmicos. Trocar calendário sem confirmar não grava nem reinterpreta o valor existente. Referências ausentes preservam o conteúdo original, exibem estado de erro e permitem limpeza explícita. O input principal apresenta a data selecionada; entradas por componentes e precisões continuam no seletor compartilhado.
