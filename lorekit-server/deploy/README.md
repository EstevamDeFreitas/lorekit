# Deploy na VPS

Os manifests desta pasta assumem a infraestrutura em `/opt/lorekit`, com
PostgreSQL e Caddy já inicializados. Nenhum secret deve ser versionado ou copiado
para fora de `/opt/lorekit/secrets`.

## Primeiro bootstrap

Copie `bootstrap-vps.sh` para a VPS e execute uma única vez com `sudo`. O script:

- adiciona `deploy` ao grupo Docker;
- cria os três secrets adicionais, sem substituir valores existentes;
- cria ou atualiza os papéis `lorekit_api` e `lorekit_migrator`;
- entrega ao usuário de deploy apenas a escrita dos dois manifests;
- prepara o diretório de blobs para o UID/GID `10001` da API.

Depois do bootstrap, encerre a conexão SSH para recarregar os grupos do usuário.

## Publicação

Com o código em `/opt/lorekit/backend`:

```bash
docker build --pull -t lorekit-server:0.1.0 /opt/lorekit/backend
docker compose -f /opt/lorekit/compose.yaml config --quiet
docker compose -f /opt/lorekit/compose.yaml run --rm migrate
docker compose -f /opt/lorekit/compose.yaml up -d postgres api caddy
docker compose -f /opt/lorekit/compose.yaml ps
```

A API não publica porta no host. Caddy é o único componente exposto e encaminha
`https://api.lorekit.online` para `api:3000` pela rede `lorekit-edge`.

## Administração manual de contas

Não existe cadastro público. Instale o utilitário administrativo na VPS:

```bash
sudo install -o root -g deploy -m 0750 \
  /opt/lorekit/backend/deploy/lorekit-admin.sh \
  /usr/local/bin/lorekit-admin
```

Crie uma conta. A senha é solicitada duas vezes, de forma oculta, e nunca é
incluída na linha de comando ou gravada em arquivo:

```bash
lorekit-admin user:create \
  --email autor@example.com \
  --name "Nome do autor" \
  --vault-name "Minha biblioteca"
```

Outros comandos disponíveis:

```bash
lorekit-admin user:list
lorekit-admin user:disable --email autor@example.com
lorekit-admin user:enable --email autor@example.com
lorekit-admin user:reset-password --email autor@example.com
```

O PostgreSQL e o serviço `api` devem estar ativos. O utilitário inicia um
contêiner administrativo descartável na rede interna, usando as mesmas
credenciais restritas da API. A criação também gera a primeira biblioteca da
conta; desativação e troca de senha revogam todas as sessões existentes.
