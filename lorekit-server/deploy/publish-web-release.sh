#!/usr/bin/env bash
set -Eeuo pipefail

readonly ARCHIVE="${1:-}"
readonly ROOT='/opt/lorekit'
readonly WEB_DIR="${ROOT}/web"
readonly PREVIOUS_WEB="${ROOT}/web.previous"
readonly CADDY_FILE="${ROOT}/caddy/Caddyfile"
readonly PREVIOUS_CADDY="${ROOT}/caddy/Caddyfile.previous"
readonly COMPOSE_FILE="${ROOT}/compose.yaml"

case "$ARCHIVE" in
  /tmp/lorekit-web-[0-9]*.tar.gz) ;;
  *) echo 'Caminho de pacote web inválido.' >&2; exit 2 ;;
esac

[[ -f "$ARCHIVE" ]] || { echo "Pacote não encontrado: $ARCHIVE" >&2; exit 2; }
[[ -f "$COMPOSE_FILE" ]] || { echo "Compose não encontrado: $COMPOSE_FILE" >&2; exit 2; }

staging="$(mktemp -d /tmp/lorekit-web.XXXXXX)"
published=false

cleanup() {
  if [[ -n "${staging:-}" && "$staging" == /tmp/lorekit-web.* ]]; then
    rm -rf -- "$staging"
  fi
  rm -f -- "$ARCHIVE" /tmp/lorekit-publish-web-release.sh
}
trap cleanup EXIT

rollback() {
  trap - ERR
  if [[ "$published" == true ]]; then
    sudo rm -rf -- "$WEB_DIR"
    [[ -d "$PREVIOUS_WEB" ]] && sudo mv -- "$PREVIOUS_WEB" "$WEB_DIR"
    [[ -f "$PREVIOUS_CADDY" ]] && sudo cp -- "$PREVIOUS_CADDY" "$CADDY_FILE"
    sudo docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate caddy || true
  fi
}
trap rollback ERR

tar -xzf "$ARCHIVE" -C "$staging" --no-same-owner
[[ -f "$staging/index.html" ]] || { echo 'index.html ausente no pacote web.' >&2; exit 2; }
[[ -f "$staging/Caddyfile.production" ]] || { echo 'Caddyfile.production ausente no pacote web.' >&2; exit 2; }

echo 'Validando o Caddyfile candidato...'
sudo docker run --rm \
  -v "$staging/Caddyfile.production:/etc/caddy/Caddyfile:ro" \
  caddy:2.11.4-alpine caddy validate --config /etc/caddy/Caddyfile

sudo rm -rf -- "$PREVIOUS_WEB"
if [[ -d "$WEB_DIR" ]]; then sudo mv -- "$WEB_DIR" "$PREVIOUS_WEB"; fi
if [[ -f "$CADDY_FILE" ]]; then sudo cp -- "$CADDY_FILE" "$PREVIOUS_CADDY"; fi
sudo mv -- "$staging" "$WEB_DIR"
staging=''
sudo install -o root -g root -m 0644 "$WEB_DIR/Caddyfile.production" "$CADDY_FILE"
sudo rm -f -- "$WEB_DIR/Caddyfile.production"
published=true

if ! sudo docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate caddy; then
  rollback
  exit 1
fi

healthy=false
for _ in {1..12}; do
  if curl --fail --silent --show-error https://api.lorekit.online/health >/dev/null \
    && curl --fail --silent --show-error https://app.lorekit.online/ | grep -q '<app-root'; then
    healthy=true
    break
  fi
  sleep 3
done

if [[ "$healthy" != true ]]; then
  echo 'Smoke test web falhou; restaurando a versão anterior.' >&2
  rollback
  exit 1
fi

echo 'Validando asset publicado e endpoint de login...'
index_html="$(curl --fail --silent --show-error https://app.lorekit.online/)"
asset_path="$(printf '%s' "$index_html" | grep -oE '(src|href)="[^"]+\.(js|css)"' | head -n 1 | cut -d '"' -f 2)"
if [[ -z "$asset_path" ]] || ! curl --fail --silent --show-error "https://app.lorekit.online/${asset_path#./}" >/dev/null; then
  echo 'Smoke test de asset estático falhou.' >&2
  rollback
  exit 1
fi
login_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST https://api.lorekit.online/auth/login \
  --header 'Origin: https://app.lorekit.online' \
  --header 'Content-Type: application/json' \
  --data '{"email":"smoke-test@invalid.local","password":"invalid-password","platform":"web","deviceName":"deploy-smoke","appVersion":"deploy"}')"
if [[ "$login_status" != '401' ]]; then
  echo "Smoke test de login retornou HTTP $login_status; esperado 401." >&2
  rollback
  exit 1
fi

echo 'Publicação web concluída.'
