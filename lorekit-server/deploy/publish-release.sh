#!/usr/bin/env bash
set -Eeuo pipefail

readonly ARCHIVE="${1:-}"
readonly LOREKIT_ROOT='/opt/lorekit'
readonly COMPOSE_FILE="${LOREKIT_ROOT}/compose.yaml"
readonly BACKEND_DIR="${LOREKIT_ROOT}/backend"
readonly PREVIOUS_DIR="${LOREKIT_ROOT}/backend.previous"
readonly IMAGE='lorekit-server:0.1.0'
readonly CANDIDATE_IMAGE='lorekit-server:deploy-candidate'
readonly PREVIOUS_IMAGE='lorekit-server:deploy-previous'

case "$ARCHIVE" in
  /tmp/lorekit-server-[0-9]*.tar.gz) ;;
  *)
    echo 'Caminho de pacote inválido.' >&2
    exit 2
    ;;
esac

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Pacote não encontrado: $ARCHIVE" >&2
  exit 2
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose não encontrado: $COMPOSE_FILE" >&2
  exit 2
fi

staging="$(mktemp -d /tmp/lorekit-backend.XXXXXX)"
had_previous_image=false

cleanup() {
  if [[ -n "${staging:-}" && "$staging" == /tmp/lorekit-backend.* ]]; then
    rm -rf -- "$staging"
  fi
  rm -f -- "$ARCHIVE" /tmp/lorekit-publish-release.sh
  sudo docker image rm "$CANDIDATE_IMAGE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

restore_previous_image() {
  if [[ "$had_previous_image" == true ]]; then
    sudo docker tag "$PREVIOUS_IMAGE" "$IMAGE"
    sudo docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate api || true
  fi
}

echo 'Extraindo pacote...'
tar -xzf "$ARCHIVE" -C "$staging" --no-same-owner

for required_file in Dockerfile package.json package-lock.json src/main.ts deploy/lorekit-admin.sh; do
  if [[ ! -e "${staging}/${required_file}" ]]; then
    echo "Arquivo obrigatório ausente no pacote: $required_file" >&2
    exit 2
  fi
done

echo 'Construindo imagem Docker...'
sudo docker build --pull -t "$CANDIDATE_IMAGE" "$staging"

if sudo docker image inspect "$IMAGE" >/dev/null 2>&1; then
  sudo docker tag "$IMAGE" "$PREVIOUS_IMAGE"
  had_previous_image=true
fi
sudo docker tag "$CANDIDATE_IMAGE" "$IMAGE"

echo 'Validando Compose e executando migrations...'
sudo docker compose -f "$COMPOSE_FILE" config --quiet
if ! sudo docker compose -f "$COMPOSE_FILE" run --rm migrate; then
  restore_previous_image
  exit 1
fi

echo 'Atualizando os fontes mantidos na VPS...'
sudo rm -rf -- "$PREVIOUS_DIR"
if [[ -e "$BACKEND_DIR" ]]; then
  sudo mv -- "$BACKEND_DIR" "$PREVIOUS_DIR"
fi
sudo mv -- "$staging" "$BACKEND_DIR"
staging=''
sudo chown -R "$(id -u):$(id -g)" "$BACKEND_DIR"

echo 'Instalando o comando lorekit-admin...'
sudo install -o root -g deploy -m 0750 \
  "${BACKEND_DIR}/deploy/lorekit-admin.sh" \
  /usr/local/bin/lorekit-admin

echo 'Recriando a API...'
if ! sudo docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate api; then
  restore_previous_image
  exit 1
fi

echo 'Aguardando o healthcheck público...'
healthy=false
for _ in {1..12}; do
  if curl --fail --silent --show-error https://api.lorekit.online/health; then
    printf '\n'
    healthy=true
    break
  fi
  sleep 3
done

if [[ "$healthy" != true ]]; then
  echo 'A nova API não passou no healthcheck; restaurando a imagem anterior.' >&2
  restore_previous_image
  exit 1
fi

sudo docker compose -f "$COMPOSE_FILE" ps
echo 'Publicação concluída.'
