#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_USER="${LOREKIT_DEPLOY_USER:-deploy}"
LOREKIT_ROOT="/opt/lorekit"
SECRETS_DIR="${LOREKIT_ROOT}/secrets"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute este script com sudo/root." >&2
  exit 1
fi

for command_name in docker openssl; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Comando obrigatorio ausente: ${command_name}" >&2
    exit 1
  fi
done

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "Usuario de deploy inexistente: ${DEPLOY_USER}" >&2
  exit 1
fi

if ! docker inspect lorekit-postgres >/dev/null 2>&1; then
  echo "Container lorekit-postgres nao encontrado." >&2
  exit 1
fi

if [[ ! -r "${SECRETS_DIR}/postgres_admin_password" ]]; then
  echo "Secret postgres_admin_password ausente ou ilegivel." >&2
  exit 1
fi

usermod -aG docker "${DEPLOY_USER}"

install -d -m 0750 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${LOREKIT_ROOT}/backend"
install -d -m 0750 -o 10001 -g 10001 "${LOREKIT_ROOT}/data/blobs"

create_secret() {
  local secret_path="${SECRETS_DIR}/$1"

  if [[ ! -e "${secret_path}" ]]; then
    umask 077
    openssl rand -base64 48 >"${secret_path}"
  fi

  chown root:10001 "${secret_path}"
  chmod 0640 "${secret_path}"
}

create_secret postgres_api_password
create_secret postgres_migrator_password
create_secret jwt_secret

api_password="$(<"${SECRETS_DIR}/postgres_api_password")"
migrator_password="$(<"${SECRETS_DIR}/postgres_migrator_password")"
admin_password="$(<"${SECRETS_DIR}/postgres_admin_password")"

docker exec -i \
  -e PGPASSWORD="${admin_password}" \
  lorekit-postgres \
  psql \
    --username lorekit_admin \
    --dbname lorekit \
    --set ON_ERROR_STOP=1 \
    --set api_password="${api_password}" \
    --set migrator_password="${migrator_password}" <<'SQL'
SELECT format('CREATE ROLE lorekit_api LOGIN PASSWORD %L', :'api_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lorekit_api')
\gexec

SELECT format('CREATE ROLE lorekit_migrator LOGIN PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lorekit_migrator')
\gexec

ALTER ROLE lorekit_api LOGIN PASSWORD :'api_password';
ALTER ROLE lorekit_migrator LOGIN PASSWORD :'migrator_password';
GRANT CONNECT ON DATABASE lorekit TO lorekit_api, lorekit_migrator;
GRANT CREATE ON DATABASE lorekit TO lorekit_migrator;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION lorekit_migrator;
ALTER SCHEMA app OWNER TO lorekit_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

unset api_password migrator_password admin_password

chgrp "${DEPLOY_USER}" "${LOREKIT_ROOT}/compose.yaml" "${LOREKIT_ROOT}/caddy/Caddyfile"
chmod 0664 "${LOREKIT_ROOT}/compose.yaml" "${LOREKIT_ROOT}/caddy/Caddyfile"

echo "Bootstrap concluido. Encerre esta sessao SSH para que o grupo docker seja recarregado."
