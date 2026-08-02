# Lorekit Server

API de autentica??o e sincroniza??o do Lorekit. O servi?o usa NestJS com Fastify,
Drizzle ORM e PostgreSQL. A imagem de produ??o executa como UID/GID `10001`.

## Requisitos

- Node.js 22 ou superior.
- PostgreSQL 17 para execu??o e integra??o.
- O schema `app` deve pertencer ao papel `lorekit_migrator`.
- `lorekit_api` precisa de `CONNECT` no banco. Os demais grants s?o aplicados pelo runner de migrations.

## Configura??o

Segredos aceitam valor direto ou arquivo. A variante `*_FILE` tem preced?ncia e
deve ser usada em produ??o.

| Vari?vel | Padr?o | Finalidade |
|---|---:|---|
| `DATABASE_HOST` | `postgres` | Host PostgreSQL |
| `DATABASE_PORT` | `5432` | Porta PostgreSQL |
| `DATABASE_NAME` | `lorekit` | Banco |
| `DATABASE_USER` | `lorekit_api` | Papel de runtime |
| `DATABASE_PASSWORD_FILE` | obrigat?rio | Arquivo com senha de runtime |
| `DATABASE_MIGRATOR_USER` | `lorekit_migrator` | Papel de migrations |
| `DATABASE_MIGRATOR_PASSWORD_FILE` | obrigat?rio para migration | Senha do migrator |
| `DATABASE_SSL` | `false` | Exigir TLS na conex?o ao banco |
| `DATABASE_MAX_CONNECTIONS` | `10` | Pool m?ximo da API |
| `JWT_SECRET_FILE` | obrigat?rio | Segredo aleat?rio com ao menos 32 bytes |
| `JWT_ISSUER` | `https://api.lorekit.online` | Emissor JWT |
| `JWT_AUDIENCE` | `lorekit` | Audi?ncia JWT |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Vida do access token |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Vida m?xima da sess?o renov?vel |
| `CORS_ORIGINS` | `https://app.lorekit.online` | Origens separadas por v?rgula |
| `PORT` | `3000` | Porta HTTP |
| `APP_VERSION` | `dev` | Vers?o mostrada no healthcheck/OpenAPI |

O refresh token ? opaco, armazenado no banco apenas como SHA-256 e rotacionado a
cada uso. JWTs s?o curtos e uma sess?o revogada ? rejeitada imediatamente.

## Desenvolvimento

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Para iniciar localmente, configure ao menos `DATABASE_PASSWORD` e `JWT_SECRET`:

```bash
npm run start:dev
```

## Migrations

Gerar uma migration depois de alterar `src/database/schema.ts`:

```bash
npm run db:generate
```

Aplicar com o papel migrator:

```bash
npm run db:migrate
```

O runner tamb?m garante grants de tabelas e sequences para `lorekit_api` e
revoga desse papel o acesso ? tabela interna `app.__drizzle_migrations`.

O primeiro schema cria:

- `users`
- `refresh_sessions`
- `devices`
- `vaults`
- `vault_members`
- `sync_records`
- `sync_changes`
- `sync_operations`
- `blobs`
- `audit_events`

## Contas administrativas

N?o existe cadastro p?blico. A senha nunca ? aceita como argumento de processo.
Use um arquivo tempor?rio protegido ou `LOREKIT_NEW_USER_PASSWORD_FILE`.

```bash
npm run admin -- user:create \
  --email autor@example.com \
  --name "Autor" \
  --password-file /run/secrets/new_user_password

npm run admin -- user:list
npm run admin -- user:disable --email autor@example.com
npm run admin -- user:enable --email autor@example.com
npm run admin -- user:reset-password \
  --email autor@example.com \
  --password-file /run/secrets/new_user_password
```

Criar uma conta tamb?m cria sua primeira biblioteca e a associa??o `owner`.
Desativa??o e troca de senha revogam todas as sess?es existentes.

## HTTP

| M?todo | Rota | Descri??o |
|---|---|---|
| `GET` | `/health` | Readiness da API e PostgreSQL |
| `GET` | `/openapi.json` | Especifica??o OpenAPI |
| `POST` | `/auth/login` | Cria dispositivo e sess?o |
| `POST` | `/auth/refresh` | Rotaciona refresh token |
| `POST` | `/auth/logout` | Revoga a sess?o atual |
| `POST` | `/auth/revoke-all` | Revoga todas as sess?es da conta |

## Imagem

```bash
docker build -t lorekit-server:0.1.0 .
docker run --rm lorekit-server:0.1.0 node --version
```

Contrato de volumes/segredos para a VPS:

```text
/run/secrets/postgres_api_password
/run/secrets/postgres_migrator_password
/run/secrets/jwt_secret
/data/blobs
```

Os arquivos de segredo montados precisam ser leg?veis pelo UID `10001`. A porta
`3000` deve permanecer apenas na rede Docker `lorekit-edge`; n?o deve ser publicada
diretamente no host. PostgreSQL continua somente na rede `lorekit-backend`.

Antes de iniciar a API em um novo deploy, execute uma inst?ncia one-shot da imagem
com `node dist/database/migrate.js` e as credenciais do migrator. O processo normal
da API usa apenas `lorekit_api`.
