#!/usr/bin/env bash
set -Eeuo pipefail

readonly COMPOSE_FILE="${LOREKIT_COMPOSE_FILE:-/opt/lorekit/compose.yaml}"

print_help() {
  cat <<'EOF'
Administração de contas do Lorekit

Uso:
  lorekit-admin.sh user:create --email EMAIL [--name NOME] [--vault-name NOME]
  lorekit-admin.sh user:list
  lorekit-admin.sh user:disable --email EMAIL
  lorekit-admin.sh user:enable --email EMAIL
  lorekit-admin.sh user:reset-password --email EMAIL

A senha é solicitada de forma oculta para criação e redefinição. Ela não é
incluída nos argumentos do processo nem gravada em arquivo.

Variável opcional:
  LOREKIT_COMPOSE_FILE  Caminho do Compose (padrão: /opt/lorekit/compose.yaml)
EOF
}

run_admin() {
  docker compose -f "$COMPOSE_FILE" run --rm -T --no-deps \
    api node dist/admin-cli.js "$@"
}

assert_no_password_option() {
  local argument
  for argument in "$@"; do
    case "$argument" in
      --password-file|--password-stdin)
        echo "As opções de senha são gerenciadas pelo próprio utilitário." >&2
        exit 2
        ;;
    esac
  done
}

run_with_password() {
  local command="$1"
  shift
  assert_no_password_option "$@"

  local password
  local confirmation
  read -r -s -p 'Senha (mínimo de 12 caracteres): ' password
  printf '\n'
  read -r -s -p 'Confirme a senha: ' confirmation
  printf '\n'

  if [[ "$password" != "$confirmation" ]]; then
    unset password confirmation
    echo 'As senhas não coincidem.' >&2
    exit 2
  fi

  if (( ${#password} < 12 )); then
    unset password confirmation
    echo 'A senha deve conter ao menos 12 caracteres.' >&2
    exit 2
  fi

  printf '%s\n' "$password" | run_admin "$command" "$@" --password-stdin
  unset password confirmation
}

main() {
  local command="${1:-}"
  if [[ -z "$command" || "$command" == '--help' || "$command" == '-h' ]]; then
    print_help
    return
  fi
  shift

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Arquivo Compose não encontrado: $COMPOSE_FILE" >&2
    exit 2
  fi

  case "$command" in
    user:create|user:reset-password)
      run_with_password "$command" "$@"
      ;;
    user:list|user:disable|user:enable)
      run_admin "$command" "$@"
      ;;
    *)
      echo "Comando desconhecido: $command" >&2
      print_help >&2
      exit 2
      ;;
  esac
}

main "$@"
