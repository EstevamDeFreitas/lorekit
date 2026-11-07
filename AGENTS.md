# Instruções do projeto

- Sempre consulte os arquivos relevantes em `.github/prompts` antes de trabalhar no projeto.
- Antes de criar ou alterar uma interface, procure componentes reutilizáveis em `lorekit-frontend/src/app/components` e siga os padrões existentes das telas relacionadas. Prefira reutilizar ou ampliar um componente existente a criar outro controle com a mesma função.
- Para ações convencionais, prefira `app-button` ou `app-icon-button`. Use a ação primária amarela e a secundária zinc existentes; não crie botões primários verdes. Use `nativeType="button"` em `app-button` para ações que não enviam formulários.
- Controles nativos específicos, como opções de listas, seletores de cor, menus e ferramentas de edição, podem permanecer próprios quando os componentes existentes não preservarem sua semântica, acessibilidade ou interação.
