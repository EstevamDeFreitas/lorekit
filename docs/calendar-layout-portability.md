# Referências portáveis de calendário

O documento de layout passa a usar versão 3. Os leitores continuam aceitando documentos de versões 1 e 2 e rejeitam versões futuras desconhecidas. A exportação contém definições de campos e organização visual; não contém valores de entidades.

## Exportar e associar

Um campo de calendário fixo exporta um manifesto de referências com chave local ao arquivo, nomes descritivos e regras de calendário. IDs de mundo, calendário, revisão, campo e período de origem do banco são removidos. IDs internos de meses, contagens, dias, estações e formatos são normalizados dentro do documento.

Na importação, associe cada referência a um mundo e a um calendário/revisão já existentes no destino. Escolha a contagem e o formato correspondentes. **Validar associações** prepara a comparação; diferenças de estrutura, relógio, nomes, contagens, estações ou formatos exigem aceite explícito. O importador não cria calendários nem converte datas automaticamente.

Somente após resolver as referências o aplicativo compara campos pelo nome e pela definição completa. Um campo com mesmo nome e definição incompatível continua sendo conflito; aceitar diferenças de calendário não autoriza sobrescrever esse campo. Cancelar a associação ou a importação não altera campos nem layouts.

Exemplo: um layout com “Nascimento”, fixado no calendário Imperial do mundo de origem, exporta uma referência do arquivo. No destino, associe essa referência ao mundo e à revisão pretendidos. Com regras equivalentes, um campo de mesma definição pode ser reutilizado. Com regras diferentes, revise as diferenças e escolha explicitamente contagem e formato antes de confirmar.

## Contratos e sincronização

As entidades Calendar e CalendarRevision participam do registro de sincronização local e da allowlist do servidor. O servidor usa registros genéricos em JSON no schema existente de sync, sem tabelas físicas de calendário adicionais em PostgreSQL. Cada revisão possui identidade própria; revisões estruturais concorrentes são preservadas separadamente. A escolha de revisão de cada vínculo é explícita.

Datas e regras permanecem contratos de versão 1, independentes da versão 3 do arquivo de layout. O transporte preserva referências ainda não disponíveis. A ausência temporária de regras não permite substituir a data por outro calendário ou outra revisão.
