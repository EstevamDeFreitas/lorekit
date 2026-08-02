#!/usr/bin/env bash
set -Eeuo pipefail

readonly ROOT='/opt/lorekit'
readonly CONFIG="${ROOT}/secrets/restic.env"
readonly BLOBS="${ROOT}/data/blobs"
readonly COMPOSE="${ROOT}/compose.yaml"

if [[ "$(id -u)" -ne 0 ]]; then
  echo 'Execute este comando com sudo.' >&2
  exit 2
fi
if [[ ! -f "$CONFIG" ]]; then
  echo "Configuração ausente: $CONFIG" >&2
  exit 2
fi
if ! command -v restic >/dev/null 2>&1; then
  echo 'restic não está instalado na VPS.' >&2
  exit 2
fi

set -a
# O arquivo é root:root 0600 e contém RESTIC_REPOSITORY, RESTIC_PASSWORD e,
# quando necessário, as credenciais do provedor externo.
source "$CONFIG"
set +a
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY ausente}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD ausente}"

staging="$(mktemp -d /tmp/lorekit-backup.XXXXXX)"
cleanup() {
  if [[ -n "${staging:-}" && "$staging" == /tmp/lorekit-backup.* ]]; then
    rm -rf -- "$staging"
  fi
}
trap cleanup EXIT

echo 'Gerando dump consistente do PostgreSQL...'
docker exec lorekit-postgres \
  pg_dump --format=custom --no-owner --no-acl --username=lorekit_admin --dbname=lorekit \
  >"$staging/lorekit.pgdump"

echo 'Enviando backup criptografado do banco, blobs e manifests...'
restic backup \
  --tag lorekit-vps \
  "$staging/lorekit.pgdump" \
  "$BLOBS" \
  "$COMPOSE" \
  "${ROOT}/caddy/Caddyfile"

echo 'Aplicando retenção e validando o repositório externo...'
restic forget --tag lorekit-vps --keep-daily 7 --keep-weekly 5 --keep-monthly 12 --prune
restic check
echo 'Backup externo concluído e verificado.'
