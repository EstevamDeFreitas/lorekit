# Tasks

## 1. Contratos e motor de calendário

- [x] 1.1 Definir contratos versionados de calendário, revisão, contagem, estação e data com precisão; verificar normalização, JSON inválido e limites de inteiros seguros em testes de domínio.
- [x] 1.2 Implementar estrutura anual com meses de durações diferentes e modo sem meses; verificar totais e conversão ida/volta entre componentes e ordinal, incluindo anos negativos e ano canônico zero.
- [x] 1.3 Implementar semanas contínuas e reinício mensal/anual no modo sem meses; verificar viradas de mês/ano, âncora inicial e ausência de semanas.
- [x] 1.4 Implementar relógio 24/60/60 configurável, nomes próprios e equivalência terrestre opcional; verificar faixas de horário, precisão decimal e exemplo de 30 horas locais em 36 horas terrestres.
- [x] 1.5 Implementar contagem dos anos por marcos com lados antes/depois e primeiro ano zero/um; verificar ida/volta de datas, marcos no começo/meio do ano e rejeição de componentes fora do trecho válido junto ao marco.
- [x] 1.6 Implementar precisão anual/mensal/diária, horário opcional e intervalos de possibilidade; verificar ausência de meia-noite implícita e validação de limites de eventos.
- [x] 1.7 Implementar builder de formatos e variantes por precisão, nomes/ordinais e preenchimento mínimo; verificar formatos curto/narrativo, números largos e tokens desconhecidos sem execução de conteúdo.
- [x] 1.8 Implementar estações recorrentes inclusivas, sobreposições e virada anual; verificar pertencimento aos limites e preservação da duração do ano.
- [x] 1.9 Documentar os contratos e exemplos de calendário em docs; verificar que exemplos de datas e contagem correspondem às fixtures aprovadas pelos testes do motor.

## 2. Persistência, revisões e sincronização

- [x] 2.1 Adicionar entidades Calendar/CalendarRevision e referências opcionais de timeline/evento/marco com migração numerada aditiva; verificar banco legado, execução repetida da migração e preservação integral dos campos antigos.
- [x] 2.2 Implementar CRUD por mundo, consultas de usos e bloqueio de exclusão referenciada; verificar isolamento entre mundos e compartilhamento por duas timelines.
- [x] 2.3 Implementar publicação de revisão estrutural e atualizações de apresentação; verificar que reduzir mês mantém datas na revisão anterior e renomear mês não muda coordenadas.
- [x] 2.4 Integrar novas entidades, contratos e referências ao registro de sync local e schema/allowlist do servidor; verificar transporte ida/volta, revisões concorrentes e payload com dependência ainda indisponível.
- [x] 2.5 Documentar migração, backup, revisão e limites de downgrade; verificar que restauração e reabertura local preservam calendários e registros legados numa fixture de banco.

## 3. Superfícies de calendário e seletor compartilhado

- [x] 3.1 Aplicar Impeccable às novas superfícies em modo Operate, inspecionando identidade e componentes atuais e confirmando composição dentro do escopo funcional; verificar a direção revisável e os fluxos de editor, seletor e conversão antes das edições de UI.
- [x] 3.2 Criar lista por mundo, navegação e editor de calendário de página inteira, integrado às abas do workspace; verificar criar dois calendários, alternar mundo e reabrir sem perda de rascunho.
- [x] 3.3 Criar seções Estrutura e Semana com configuração simples inicial, reordenação por teclado e prévia do ano; verificar mês inválido, ano sem meses e ambas as políticas semanais no fluxo.
- [x] 3.4 Criar seções Tempo e Contagem dos anos com relógio, duração terrestre opcional e múltiplos marcos; verificar exemplos antes/depois, ano zero e avisos de fronteira do marco.
- [x] 3.5 Criar seções Estações e Formatos com prévia por precisão; verificar estação que cruza a virada, sobreposição e construção do exemplo 37º dia do Sexto mês, ano 4 pós-revolução.
- [x] 3.6 Implementar CalendarDatePicker compartilhado com calendário, contagem, precisão e horário opcional; verificar teclado, valor vazio, calendário sem meses e limites com testes de interação significativos.
- [x] 3.7 Implementar rascunho, Salvar, estados de erro/sucesso e proteção de alterações pendentes; verificar falha de persistência, saída da aba e edição estrutural de calendário utilizado sem anunciar sucesso indevido.
- [x] 3.8 Documentar configuração e seleção de datas para o usuário; verificar que instruções correspondem aos nomes e passos entregues e não expõem termos técnicos desnecessários na UI.

## 4. Conversão de timelines e eras

- [x] 4.1 Implementar planejamento somente leitura de posições legadas por ano/dia e associação manual; verificar números negativos/fracionários, texto de data preservado e prévia sem alterações no banco.
- [x] 4.2 Implementar revisão individual das eras como contagem ou período narrativo, com vínculo de origem e preservação de conteúdo/assets; verificar eras sobrepostas, limites revisados e fim narrativo preservado.
- [x] 4.3 Criar fluxo de vinculação com calendário/revisão, correspondência, eras e comparação final; verificar avisos de compartilhamento, cancelamento em cada etapa e erros bloqueantes antes de salvar.
- [x] 4.4 Implementar commit transacional, snapshot/proveniência, checagem de fontes alteradas e idempotência do plano; verificar falhas antes de commit, falha de gravação em disco e repetição sem duplicar contagens.
- [x] 4.5 Implementar troca de calendário/revisão e retorno à cronologia livre com projeção preservada; verificar datas incompatíveis, eventos criados após conversão e manutenção de contagens usadas por outras timelines.
- [x] 4.6 Documentar o significado da transformação das eras e o fluxo de retorno; verificar os exemplos contra testes de migração de uma timeline com eventos, marcos e eras.

## 5. Eventos e navegação temporal

- [x] 5.1 Integrar datas e intervalos estruturados aos formulários de eventos e grandes marcos usando o seletor compartilhado; verificar precisão parcial, horário opcional, intervalos entre anos e timeline sem calendário.
- [x] 5.2 Refatorar coordenadas e geração da régua para viewport com origem local e limites calculados pelo motor; verificar que visão diária de milhares de anos gera somente divisões visíveis com margem.
- [x] 5.3 Implementar escalas século/década/ano/mês/semana/dia, seletor e Ir para data; verificar data focal, ausência de escalas indisponíveis, lados do marco e proporção 40/20 entre meses.
- [x] 5.4 Implementar arraste com ajuste temporal, prévia e alternativa por formulário; verificar duração preservada, precisão parcial e bloqueio contextual quando ambas não podem ser preservadas.
- [x] 5.5 Implementar agrupamento por densidade, acesso aos itens e camada sazonal opcional; verificar contagem do grupo, abertura de todos os eventos e estações identificáveis sem depender só de cor.
- [x] 5.6 Documentar escalas, ajuste e precisão na timeline; verificar o percurso completo de zoom e reposicionamento em uma fixture com dois calendários distintos.

## 6. Campo dinâmico e portabilidade

- [x] 6.1 Adicionar calendar-date ao modelo, catálogo e editor de configuração de campos, com política fixa por mundo ou selecionável; verificar que os tipos slider/list/chart e demais tipos legados continuam disponíveis.
- [x] 6.2 Integrar edição/renderização dos valores com o seletor e persistência versionada; verificar valor vazio, precisão anual, data inválida preservando último valor válido e seleção limitada ao mundo.
- [x] 6.3 Implementar plano de impacto da troca de configuração fixa e estados de dependência ausente; verificar múltiplos mundos, referência indisponível e confirmação antes de alterar valores existentes.
- [x] 6.4 Evoluir documento de layout com manifesto de referências portáveis e leitores anteriores; verificar que exportação não contém IDs locais aninhados nem valores e que versões futuras são rejeitadas.
- [x] 6.5 Implementar associação de mundo/calendário/revisão/contagem antes da comparação de campos importados; verificar equivalência, diferenças aceitas explicitamente, conflito de mesmo nome e cancelamento sem mutações.
- [x] 6.6 Documentar o campo e as referências de calendário no formato de layout; verificar exemplos exportados/importados e regressão dos documentos legados e dos campos visuais existentes.

## 7. Integração e revisão final

- [x] 7.1 Executar testes relevantes de motor, migrações, serviços, seletores, timeline e portabilidade pelo runner do frontend, além de npm run build em lorekit-frontend; verificar ausência de falhas e registrar os resultados.
- [x] 7.2 Executar cenários completos de dois calendários num mundo e duas timelines compartilhando um deles, conversão de banco legado, troca de revisão e reabertura offline; verificar consistência entre eventos, marcos e campos dinâmicos.
- [x] 7.3 Verificar integração com sincronização habilitada/desabilitada e referências recebidas fora de ordem; confirmar preservação de dados, estado pendente compreensível e recuperação após chegada das regras.
- [ ] 7.4 Aplicar revisão visual Impeccable em uma rodada conjunta desktop/viewport estreito, corrigir achados em lote e confirmar em no máximo uma segunda rodada; verificar editor, seletor, migração e timeline com teclado, foco, contraste e textos longos.
- [x] 7.5 Conferir cobertura dos cenários das quatro especificações, documentação e limitações declaradas; verificar que nenhum item excluído foi implementado implicitamente e registrar pendências reais antes de marcar tarefas concluídas.


## 8. Refinamento de formatos solicitado pelo usuário

- [x] 8.1 Adicionar contrato e avaliação declarativa de textos condicionais com E/OU, limites inclusivos/exclusivos e resultado desconhecido; testar precisão parcial, ausência de horário, calendário sem meses e comparações inválidas.
- [x] 8.2 Permitir reordenar partes por controles acessíveis e editar condições/resultados no montador, com prévia imediata e rascunho preservado; testar interação e limites do exemplo do dia 13.
- [x] 8.3 Preservar formatos existentes e transportar partes ordenadas e condicionais na portabilidade; testar exportação/importação com regras equivalentes e sem IDs locais.
- [x] 8.4 Documentar campos, limites, lógica de informação desconhecida e compatibilidade; manter proposta, design e especificações coerentes com o refinamento autorizado.
- [x] 8.5 Executar testes relevantes e build de produção; registrar os resultados e manter a pendência real de inspeção visual.


## 9. Correção do campo dinâmico e apresentação compacta

- [x] 9.1 Substituir o formulário embutido por input compacto com botão lateral e painel CDK fora da área recortada; comparar com ComboBox, limitar à viewport e oferecer rolagem do sistema e operação por teclado.
- [x] 9.2 Gravar imediatamente a confirmação no renderer e verificar o percurso completo com SQLite: escolha de calendário/data, leitura após reabertura, precisão anual, calendário fixo, cancelamento, data inválida e restrição por mundo.
- [x] 9.3 Atualizar documentação e especificação do fluxo, executar testes relevantes e build e registrar o resultado sem substituir a inspeção visual pendente por testes de componente.
